from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_mail import Mail, Message
import base64
import requests
import threading
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

# Setup empty dictionary for embeddings
saved_embeddings = {}

def sync_embeddings_from_db():
    try:
        response = requests.get("http://localhost:25918/api/Checkin/DownloadAllModels", 
                                headers={"x-api-key": "dbase-ai-master-key-2026"}, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and "models" in data:
                global saved_embeddings
                saved_embeddings.clear()
                for item in data["models"]:
                    model_bytes = base64.b64decode(item["modelBase64"])
                    emp_name = item.get("empName", "")
                    emp_id = item.get("empId", "")
                    key = f"{emp_name} ({emp_id})" if emp_id else emp_name
                    saved_embeddings[key] = pickle.loads(model_bytes)
                print(f"Synced {len(saved_embeddings)} embeddings from DB")
    except Exception as e:
        print(f"Error syncing from DB: {e}")

sync_embeddings_from_db()

yolo_model = YOLO('best.pt')
embedder = FaceNet()

def recognize_from_image(frame):
    if frame is None:
        print("Error: Could not load image.")
        return

    recognized_names = []
    unknown_count = 0

    results = yolo_model.predict(source=frame, save=False, conf=0.5)

    for result in results[0].boxes:
        x1, y1, x2, y2 = map(int, result.xyxy[0])
        face = frame[y1:y2, x1:x2]

        if face.size == 0:
            continue

        face_resized = cv2.resize(face, (160, 160))
        face_embedding = embedder.embeddings([face_resized])[0]

        name = recognize_person(face_embedding, saved_embeddings, threshold=0.9)
        recognized_names.append(name)

        if name == "Unknown":
            unknown_count += 1
        else:
            status = log_attendance(name)
            if status and status != "Cooldown":
                recognized_names.append(f"{name} ({status})")

        label = f"Welcome {name}" if name != "Unknown" else "Unknown"
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    if recognized_names:
        return recognized_names
    else:
        return None

def recognize_person(face_embedding, saved_embeddings, threshold=0.9):
    """Identify the person based on face embeddings."""
    min_dist = float('inf')
    name = "Unknown"
    for person_name, embedding in saved_embeddings.items():
        dist = np.linalg.norm(face_embedding - embedding)
        if dist < min_dist:
            min_dist = dist
            name = person_name
    if min_dist > threshold:
        name = "Unknown"
    return name

attendance_tracker = {} # memory store for today's scans: { "name": { "last_scan": datetime, "count": 0, "date": "YYYY-MM-DD" } }

def log_attendance(original_name):
    """Log attendance in sequential slots with a 15-minute cooldown via in-memory tracker."""
    
    emp_id = "-"
    name = original_name
    if "(" in name and ")" in name:
        emp_id = name.split("(")[1].replace(")", "").strip()
        name = name.split("(")[0].strip()
        
    current_time = datetime.now()
    timestamp = current_time.strftime('%H:%M:%S')
    today_date = current_time.strftime('%Y-%m-%d')

    tracker = attendance_tracker.get(original_name, {"last_scan": None, "count": 0, "date": today_date})
    
    if tracker["date"] != today_date:
        tracker = {"last_scan": None, "count": 0, "date": today_date}

    if tracker["last_scan"]:
        time_diff_mins = (current_time - tracker["last_scan"]).total_seconds() / 60.0
        if time_diff_mins < 15:
            return "Cooldown"

    slots = ["Morning In", "Lunch Out", "Lunch In", "Evening Out"]
    if tracker["count"] >= 4:
        return "Cooldown"
        
    status_logged = slots[tracker["count"]]
    tracker["count"] += 1
    tracker["last_scan"] = current_time
    attendance_tracker[original_name] = tracker
        
    def push_to_main_db():
        try:
            payload = {
                "empId": emp_id,
                "name": name,
                "time": timestamp,
                "date": today_date,
                "status": status_logged
            }
            headers = {"x-api-key": "dbase-ai-master-key-2026"}
            requests.post("http://localhost:25918/api/Checkin/AILogAttendance", json=payload, headers=headers, timeout=2)
        except Exception as e:
            print(f"API Bridge Error: {e}")
            
    threading.Thread(target=push_to_main_db).start()
        
    return status_logged

def send_attendance_email(faculty_email):
    """Send the attendance report to the faculty email."""
    today_date = datetime.now().strftime('%Y-%m-%d')
    filename = f'attendance_{today_date}.csv'

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

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get('x-api-key')
        if not api_key:
            return jsonify({'success': False, 'message': 'API Key is missing!'}), 401
        
        # Hardcoded master integration key for DBASE-DASHBOARD cross-origin communication
        if api_key != 'dbase-ai-master-key-2026':
            return jsonify({'success': False, 'message': 'API Key is invalid!'}), 401
            
        return f('Admin', *args, **kwargs)
    return decorated

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    if not data:
        return jsonify({'success': False, 'message': 'Missing JSON payload'}), 400
        
    username = data.get('username')
    password = data.get('password')
    
    if username == 'admin' and password == 'password':
        token = jwt.encode({
            'user': username,
            'exp': datetime.utcnow() + timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
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

    files = request.files.getlist('images')
    if not files or len(files) == 0:
        files = request.files.getlist('images[]')
    
    if not files or len(files) == 0:
        return jsonify({"success": False, "message": "No images provided"}), 400

    embeddings = []
    
    for file in files:
        if file.filename == '':
            continue
        try:
            in_memory_file = file.read()
            nparr = np.frombuffer(in_memory_file, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                continue
                
            results = yolo_model.predict(source=img, save=False, conf=0.5)
            for result in results[0].boxes:
                x1, y1, x2, y2 = map(int, result.xyxy[0])
                face = img[y1:y2, x1:x2]
                if face.size == 0: continue
                face_resized = cv2.resize(face, (160, 160))
                face_embedding = embedder.embeddings([face_resized])[0]
                embeddings.append(face_embedding)
                break  # Process only one face per image
        except Exception as e:
            print(f"Error processing image {file.filename}: {e}")
            continue
            
    if not embeddings:
         return jsonify({"success": False, "message": "No faces detected in the provided images."}), 400
         
    # Average embeddings (using mean per dimension across the multiple images)
    avg_embedding = np.mean(embeddings, axis=0)
    
    # Save to dictionary
    saved_embeddings[name] = avg_embedding
    
    # Save to database
    try:
        emp_id = "-"
        clean_name = name
        if "(" in name and ")" in name:
            emp_id = name.split("(")[1].replace(")", "").strip()
            clean_name = name.split("(")[0].strip()

        single_array_bytes = pickle.dumps(avg_embedding)
        model_base64 = base64.b64encode(single_array_bytes).decode('utf-8')
        
        payload = {
            "Emp_ID": emp_id,
            "Emp_Name": clean_name,
            "ModelName": "embedding_train",
            "ModelBase64": model_base64
        }
        headers = {"x-api-key": "dbase-ai-master-key-2026"}
        requests.post("http://localhost:25918/api/Checkin/UploadModel", json=payload, headers=headers, timeout=5)
    except Exception as e:
        print(f"DB Upload Error: {e}")
        
    return jsonify({"success": True, "message": f"Successfully registered {name} with {len(embeddings)} image(s)!"})

@app.route('/recognize', methods=['POST'])
def recognize():
    data = request.json
    image_data = data['image'].split(',')[1]
    image_bytes = base64.b64decode(image_data)
    image_array = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    faces = recognize_from_image(image)

    return jsonify(success=True, name=faces)

@app.route('/send_attendance', methods=['POST'])
@token_required
def send_attendance(current_user):
    data = request.json
    faculty_email = data.get('email')
    if faculty_email:
        response = send_attendance_email(faculty_email)
        return jsonify(response)
    else:
        return jsonify({"success": False, "message": "Invalid email."})

@app.route('/get_attendance', methods=['GET'])
@token_required
def get_attendance(current_user):
    date_param = request.args.get('date')
    if not date_param:
        date_param = datetime.now().strftime('%Y-%m-%d')
    try:
        api_headers = {"x-api-key": "dbase-ai-master-key-2026"}
        response = requests.get(f"http://localhost:25918/api/Checkin/AIGetAttendanceByDate?date={date_param}", headers=api_headers)
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                formatted = []
                for row in data.get("data", []):
                    formatted.append({
                        "Emp ID": row.get("empId", ""),
                        "Name": row.get("name", ""),
                        "Morning In": row.get("morningIn", ""),
                        "Lunch Out": row.get("lunchOut", ""),
                        "Lunch In": row.get("lunchIn", ""),
                        "Evening Out": row.get("eveningOut", "")
                    })
                return jsonify({"success": True, "data": formatted})
        return jsonify({"success": True, "data": []})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route('/list_reports', methods=['GET'])
@token_required
def list_reports(current_user):
    try:
        api_headers = {"x-api-key": "dbase-ai-master-key-2026"}
        response = requests.get("http://localhost:25918/api/Checkin/AIGetAttendanceDates", headers=api_headers)
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                reports = [{"date": d, "filename": f"attendance_{d}.csv"} for d in data.get("dates", [])]
                return jsonify({"success": True, "reports": reports})
        return jsonify({"success": True, "reports": []})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route('/download_report/<filename>', methods=['GET'])
@token_required
def download_report(current_user, filename):
    if not filename.startswith('attendance_') or not filename.endswith('.csv'):
        return jsonify({"success": False, "message": "Invalid filename."}), 400
        
    date_param = filename.replace('attendance_', '').replace('.csv', '')
    try:
        api_headers = {"x-api-key": "dbase-ai-master-key-2026"}
        response = requests.get(f"http://localhost:25918/api/Checkin/AIGetAttendanceByDate?date={date_param}", headers=api_headers)
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                output = io.StringIO()
                writer = csv.writer(output)
                writer.writerow(['Emp ID', 'Name', 'Morning In', 'Lunch Out', 'Lunch In', 'Evening Out'])
                for row in data.get("data", []):
                    writer.writerow([
                        row.get("empId", ""),
                        row.get("name", ""),
                        row.get("morningIn", ""),
                        row.get("lunchOut", ""),
                        row.get("lunchIn", ""),
                        row.get("eveningOut", "")
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
    # Instead of deleting from database, we just return true.
    # The frontend will hide it using localStorage persistence.
    return jsonify({"success": True, "message": "Report hidden successfully."})

if __name__ == "__main__":
    # In a true production environment, consider using Waitress or Gunicorn.
    # For now, we disabled debug mode and bound to 0.0.0.0.
    app.run(host="0.0.0.0", port=5000, debug=False)
