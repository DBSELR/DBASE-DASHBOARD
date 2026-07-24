from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_mail import Mail, Message
import base64
import json
import requests
import threading
import time
import cv2
import numpy as np
import pickle
import csv
from datetime import datetime, timedelta
from ultralytics import YOLO
from keras_facenet import FaceNet
import os
import jwt
from functools import wraps

app = Flask(__name__)
CORS(app)

app.config['SECRET_KEY'] = 'your_secret_key'

# Flask-Mail configuration
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'projectfinalrss01@gmail.com'
app.config['MAIL_PASSWORD'] = 'pfnbzsjuzqubsfuo'
app.config['MAIL_DEFAULT_SENDER'] = 'projectfinalrss01@gmail.com'

mail = Mail(app)

import io

# ── In-memory embedding store ──────────────────────────────────────────────
saved_embeddings = {}        # { "Name (EmpID)": np.ndarray }
embeddings_lock = threading.Lock()

# ── Sync from DB ───────────────────────────────────────────────────────────
def sync_embeddings_from_db():
    try:
        response = requests.get(
            "http://localhost:25918/api/Checkin/DownloadAllModels",
            headers={"x-api-key": "dbase-ai-master-key-2026"},
            timeout=10
        )
        if response.status_code != 200:
            print(f"[Sync] HTTP {response.status_code}")
            return

        data = response.json()
        if not (data.get("success") and "models" in data):
            print("[Sync] Unexpected response structure")
            return

        new_embeddings = {}
        for item in data["models"]:
            emp_name = item.get("empName", "")
            emp_id   = item.get("empId", "")
            key      = f"{emp_name} ({emp_id})" if emp_id else emp_name

            raw_bytes = base64.b64decode(item["modelBase64"])

            # Try JSON double[] first (stored by .NET UploadModel)
            try:
                embedding_list = json.loads(raw_bytes.decode("utf-8"))
                new_embeddings[key] = np.array(embedding_list, dtype=np.float64)
                continue
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass

            # Fallback: legacy pickle format (stored by Flask register_employee)
            try:
                new_embeddings[key] = pickle.loads(raw_bytes)
            except Exception as e:
                print(f"[Sync] Cannot deserialize embedding for {key}: {e}")

        with embeddings_lock:
            saved_embeddings.clear()
            saved_embeddings.update(new_embeddings)

        print(f"[Sync] Loaded {len(saved_embeddings)} embeddings from DB")

    except Exception as e:
        print(f"[Sync] Error: {e}")


def start_periodic_sync(interval_seconds=600):
    """Refresh embeddings every 10 minutes so new registrations are picked up."""
    def _loop():
        while True:
            time.sleep(interval_seconds)
            sync_embeddings_from_db()

    t = threading.Thread(target=_loop, daemon=True)
    t.start()


# ── YOLO + FaceNet models ──────────────────────────────────────────────────
sync_embeddings_from_db()
start_periodic_sync(600)

yolo_model = YOLO('best.pt')
embedder   = FaceNet()

# ── Recognition helpers ────────────────────────────────────────────────────

# How close (L2) a face must be to count as a match.
# FaceNet same-person pairs typically < 0.5; different-person pairs > 0.6.
MATCH_THRESHOLD = 0.52
# The best match must be at least this much closer than the 2nd-best.
# Prevents ties where two people look similarly different.
MARGIN_REQUIRED = 0.08
# Minimum face crop size (pixels). Smaller crops are too blurry to embed well.
MIN_FACE_PX = 64


def recognize_person(face_embedding):
    """
    Nearest-neighbour search with confidence margin check.
    Returns (name, distance) where name == "Unknown" if no confident match.
    """
    with embeddings_lock:
        items = list(saved_embeddings.items())

    if not items:
        return "Unknown", 1.0

    dists = sorted(
        [(np.linalg.norm(face_embedding - emb), name) for name, emb in items]
    )

    best_dist, best_name = dists[0]

    if best_dist > MATCH_THRESHOLD:
        return "Unknown", best_dist

    # With only one person registered skip margin check
    if len(dists) == 1:
        return best_name, best_dist

    second_dist = dists[1][0]
    if (second_dist - best_dist) < MARGIN_REQUIRED:
        # Too ambiguous — two people look too similar in this frame
        return "Unknown", best_dist

    return best_name, best_dist


def recognize_from_image(frame):
    if frame is None:
        return []

    results = yolo_model.predict(source=frame, save=False, conf=0.5)
    output = []

    for result in results[0].boxes:
        # ── Quality gate ──────────────────────────────────────────────────
        det_conf = float(result.conf[0])
        if det_conf < 0.65:
            continue

        x1, y1, x2, y2 = map(int, result.xyxy[0])
        face = frame[y1:y2, x1:x2]

        if face.size == 0:
            continue

        face_h, face_w = face.shape[:2]
        if face_w < MIN_FACE_PX or face_h < MIN_FACE_PX:
            continue

        # ── Embed + match ─────────────────────────────────────────────────
        face_resized  = cv2.resize(face, (160, 160))
        face_embedding = embedder.embeddings([face_resized])[0]

        name, dist = recognize_person(face_embedding)
        # Normalise distance to 0–100 confidence (lower dist = higher confidence)
        confidence_pct = max(0, round((1.0 - dist / MATCH_THRESHOLD) * 100))

        status = None
        if name != "Unknown":
            status = log_attendance(name)

        output.append({
            "name":       name,
            "status":     status,        # slot logged, "Cooldown", or None
            "confidence": confidence_pct,
            "distance":   round(dist, 4),
        })

        label = f"{name} ({confidence_pct}%)" if name != "Unknown" else "Unknown"
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    return output


# ── Attendance cooldown tracker ────────────────────────────────────────────
attendance_tracker = {}

def log_attendance(original_name):
    emp_id = "-"
    name   = original_name
    if "(" in name and ")" in name:
        emp_id = name.split("(")[1].replace(")", "").strip()
        name   = name.split("(")[0].strip()

    current_time = datetime.now()
    timestamp    = current_time.strftime('%H:%M:%S')
    today_date   = current_time.strftime('%Y-%m-%d')

    tracker = attendance_tracker.get(original_name, {"last_scan": None, "count": 0, "date": today_date})

    if tracker["date"] != today_date:
        tracker = {"last_scan": None, "count": 0, "date": today_date}

    if tracker["last_scan"]:
        elapsed_min = (current_time - tracker["last_scan"]).total_seconds() / 60.0
        if elapsed_min < 15:
            return "Cooldown"

    slots = ["Morning In", "Lunch Out", "Lunch In", "Evening Out"]
    if tracker["count"] >= 4:
        return "Cooldown"

    status_logged         = slots[tracker["count"]]
    tracker["count"]     += 1
    tracker["last_scan"]  = current_time
    attendance_tracker[original_name] = tracker

    def push_to_main_db():
        try:
            payload = {
                "image":   "data:image/jpeg;base64,AI_SERVICE_STREAM",
                "empId":   emp_id,
                "empName": name,
                "name":    name,
                "time":    timestamp,
                "date":    today_date,
                "status":  status_logged,
            }
            headers = {"x-api-key": "dbase-ai-master-key-2026"}
            requests.post(
                "http://localhost:25918/api/Checkin/AILogAttendance",
                json=payload, headers=headers, timeout=2
            )
        except Exception as e:
            print(f"[DB Push] {e}")

    threading.Thread(target=push_to_main_db, daemon=True).start()
    return status_logged


# ── Auth decorator ─────────────────────────────────────────────────────────
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get('x-api-key')
        if not api_key:
            return jsonify({'success': False, 'message': 'API Key is missing!'}), 401
        if api_key != 'dbase-ai-master-key-2026':
            return jsonify({'success': False, 'message': 'API Key is invalid!'}), 401
        return f('Admin', *args, **kwargs)
    return decorated


# ── Email helper ───────────────────────────────────────────────────────────
def send_attendance_email(faculty_email):
    today_date = datetime.now().strftime('%Y-%m-%d')
    filename   = f'attendance_{today_date}.csv'
    if not os.path.isfile(filename):
        return {"success": False, "message": "No attendance data found."}
    try:
        msg = Message(
            subject=f"Attendance Report - {today_date}",
            recipients=[faculty_email],
            body=f"Attached is the attendance report for {today_date}."
        )
        with open(filename, 'rb') as attachment:
            msg.attach(filename, "text/csv", attachment.read())
        mail.send(msg)
        return {"success": True, "message": "Attendance report sent successfully."}
    except Exception as e:
        return {"success": False, "message": f"Error sending email: {str(e)}"}


# ── Routes ─────────────────────────────────────────────────────────────────

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    if not data:
        return jsonify({'success': False, 'message': 'Missing JSON payload'}), 400
    username = data.get('username')
    password = data.get('password')
    if username == 'admin' and password == 'password':
        token = jwt.encode(
            {'user': username, 'exp': datetime.utcnow() + timedelta(hours=24)},
            app.config['SECRET_KEY'], algorithm="HS256"
        )
        return jsonify({'success': True, 'token': token})
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401


@app.route('/register_employee', methods=['POST'])
@token_required
def register_employee(current_user):
    name = request.form.get('name')
    if not name:
        return jsonify({"success": False, "message": "Name is required"}), 400
    if name in saved_embeddings:
        return jsonify({"success": False, "message": "You have already registered!"}), 400

    files = request.files.getlist('images') or request.files.getlist('images[]')
    if not files:
        return jsonify({"success": False, "message": "No images provided"}), 400

    embeddings_list = []

    for file in files:
        if file.filename == '':
            continue
        try:
            nparr = np.frombuffer(file.read(), np.uint8)
            img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                continue

            results = yolo_model.predict(source=img, save=False, conf=0.5)
            for result in results[0].boxes:
                det_conf = float(result.conf[0])
                if det_conf < 0.65:
                    continue
                x1, y1, x2, y2 = map(int, result.xyxy[0])
                face = img[y1:y2, x1:x2]
                if face.size == 0:
                    continue
                fh, fw = face.shape[:2]
                if fw < MIN_FACE_PX or fh < MIN_FACE_PX:
                    continue
                face_resized   = cv2.resize(face, (160, 160))
                face_embedding = embedder.embeddings([face_resized])[0]
                embeddings_list.append(face_embedding)
                break  # one face per image
        except Exception as e:
            print(f"[Register] Error on {file.filename}: {e}")
            continue

    if not embeddings_list:
        return jsonify({"success": False, "message": "No quality faces detected in the provided images."}), 400

    avg_embedding = np.mean(embeddings_list, axis=0)

    with embeddings_lock:
        saved_embeddings[name] = avg_embedding

    # Persist to DB
    try:
        emp_id     = "-"
        clean_name = name
        if "(" in name and ")" in name:
            emp_id     = name.split("(")[1].replace(")", "").strip()
            clean_name = name.split("(")[0].strip()

        single_array_bytes = pickle.dumps(avg_embedding)
        model_base64       = base64.b64encode(single_array_bytes).decode('utf-8')

        payload = {
            "Emp_ID":      emp_id,
            "Emp_Name":    clean_name,
            "ModelName":   "embedding_train",
            "ModelBase64": model_base64,
        }
        headers = {"x-api-key": "dbase-ai-master-key-2026"}
        requests.post(
            "http://localhost:25918/api/Checkin/UploadModel",
            json=payload, headers=headers, timeout=5
        )
    except Exception as e:
        print(f"[Register] DB upload error: {e}")

    return jsonify({
        "success": True,
        "message": f"Successfully registered {name} with {len(embeddings_list)} image(s)!"
    })


@app.route('/recognize', methods=['POST'])
def recognize():
    data        = request.json
    image_data  = data['image'].split(',')[1]
    image_bytes = base64.b64decode(image_data)
    image_array = np.frombuffer(image_bytes, np.uint8)
    image       = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    face_results = recognize_from_image(image)

    # Keep backward-compat `name` list that the frontend currently reads
    name_list   = [r["name"] for r in face_results]
    conf_list   = [r["confidence"] for r in face_results]

    return jsonify(
        success=True,
        name=name_list,
        confidence=conf_list,
        results=face_results,
    )


@app.route('/send_attendance', methods=['POST'])
@token_required
def send_attendance(current_user):
    data          = request.json
    faculty_email = data.get('email')
    if faculty_email:
        return jsonify(send_attendance_email(faculty_email))
    return jsonify({"success": False, "message": "Invalid email."})


@app.route('/get_attendance', methods=['GET'])
@token_required
def get_attendance(current_user):
    date_param = request.args.get('date') or datetime.now().strftime('%Y-%m-%d')
    try:
        api_headers = {"x-api-key": "dbase-ai-master-key-2026"}
        response    = requests.get(
            f"http://localhost:25918/api/Checkin/AIGetAttendanceByDate?date={date_param}",
            headers=api_headers
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                formatted = [
                    {
                        "Emp ID":     row.get("empId", ""),
                        "Name":       row.get("name", ""),
                        "Morning In": row.get("morningIn", ""),
                        "Lunch Out":  row.get("lunchOut", ""),
                        "Lunch In":   row.get("lunchIn", ""),
                        "Evening Out":row.get("eveningOut", ""),
                    }
                    for row in data.get("data", [])
                ]
                return jsonify({"success": True, "data": formatted})
        return jsonify({"success": True, "data": []})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})


@app.route('/list_reports', methods=['GET'])
@token_required
def list_reports(current_user):
    try:
        api_headers = {"x-api-key": "dbase-ai-master-key-2026"}
        response    = requests.get(
            "http://localhost:25918/api/Checkin/AIGetAttendanceDates",
            headers=api_headers
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                reports = [
                    {"date": d, "filename": f"attendance_{d}.csv"}
                    for d in data.get("dates", [])
                ]
                return jsonify({"success": True, "reports": reports})
        return jsonify({"success": True, "reports": []})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})


@app.route('/download_report/<filename>', methods=['GET'])
@token_required
def download_report(current_user, filename):
    if not filename.startswith('attendance_') or not filename.endswith('.csv'):
        return jsonify({"success": False, "message": "Invalid filename."}), 400

    date_param  = filename.replace('attendance_', '').replace('.csv', '')
    api_headers = {"x-api-key": "dbase-ai-master-key-2026"}
    try:
        response = requests.get(
            f"http://localhost:25918/api/Checkin/AIGetAttendanceByDate?date={date_param}",
            headers=api_headers
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                output = io.StringIO()
                writer = csv.writer(output)
                writer.writerow(['Emp ID', 'Name', 'Morning In', 'Lunch Out', 'Lunch In', 'Evening Out'])
                for row in data.get("data", []):
                    writer.writerow([
                        row.get("empId", ""), row.get("name", ""),
                        row.get("morningIn", ""), row.get("lunchOut", ""),
                        row.get("lunchIn", ""),  row.get("eveningOut", ""),
                    ])
                mem = io.BytesIO()
                mem.write(output.getvalue().encode('utf-8'))
                mem.seek(0)
                return send_file(mem, as_attachment=True, download_name=filename, mimetype='text/csv')
        return jsonify({"success": False, "message": "Failed to fetch DB data."}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})


@app.route('/delete_report/<filename>', methods=['DELETE'])
@token_required
def delete_report(current_user, filename):
    return jsonify({"success": True, "message": "Report hidden successfully."})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
