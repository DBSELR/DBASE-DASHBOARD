# Project Architecture Overview

## 1. Summary

This repository is an Ionic React frontend application for an office dashboard. The app consumes an external backend API for most business features, including meeting management, attendance, user profiles, requests, payroll, and more.

There is also a local Python AI backend under `ai-backend/` that provides face-recognition attendance support and bridges to the external API.

## 2. Frontend

### 2.1 Technology stack

- React 18
- Ionic React 8
- Vite
- Capacitor
- React Router v5
- Axios for HTTP requests
- Moment.js for date handling
- Firebase, SignalR, MUI, Recharts, jsPDF, XLSX, and other supporting libraries

### 2.2 Main frontend files

- `src/App.tsx` — top-level Ionic app and routing
- `src/config.ts` — API base URL configuration
- `src/pages/Meetings/MeetingMaster.tsx` — meeting creation form
- `src/pages/Meetings/MeetingDashboard.tsx` — meeting summary dashboard
- `src/pages/Meetings/MeetingList.tsx` — meeting list with edit/update support
- `ai-backend/app.py` — Python AI backend service

### 2.3 API configuration

The frontend uses `src/config.ts` to determine the backend URL:

```ts
export const API_BASE = import.meta.env.DEV
  ? "http://localhost:25918/api/"
  : (import.meta.env.VITE_API_BASE ?? "https://api.dbasesolutions.in/api/");
```

- Development: `http://localhost:25918/api/`
- Production: `VITE_API_BASE` or fallback to `https://api.dbasesolutions.in/api/`

### 2.4 Routing

The `App.tsx` file defines page routes inside Ionic router outlet. Meeting-related routes are:

- `/meeting-master` → `MeetingMaster`
- `/meeting-dashboard` → `MeetingDashboard`
- `/meeting-list` → `MeetingList`

### 2.5 Meeting pages

#### 2.5.1 `MeetingMaster.tsx`

This page supports creating new meeting records.

- Loads employee list from `GET ${API_BASE}Employee/Load_Employees`
- Supports form fields:
  - Year
  - Month
  - Week name
  - Frequency
  - Meeting date
  - Project
  - Owners
  - Participants
  - Remarks
- Validates required values before submit
- Sends meeting payload to `POST ${API_BASE}Meeting/SaveMeeting`

#### 2.5.2 `MeetingDashboard.tsx`

This page provides a meeting summary dashboard and filtered table.

- Loads meetings from `GET ${base}/Meeting/GetMeetings`
- Builds a month dropdown from 2014 to current month
- Allows filtering by:
  - Period
  - Project (hardcoded list: `Beat`, `Boat`, `Unicode`, `React`)
- Displays dashboard cards for:
  - Total meetings
  - Completed meetings
  - Pending meetings
  - Escalated meetings
- Clicking a card filters the table rows by meeting status
- Attachment links use `API_BASE` root normalization

#### 2.5.3 `MeetingList.tsx`

This page shows the detailed meeting list and supports editing.

- Loads meetings from `GET ${base}/Meeting/GetMeetings`
- Reads current user details from `localStorage.user` or `localStorage.userData`
- Determines role by user type and employee code
- Admin-like users can see all meetings
- Other users see meetings where they are owner or participant
- Maintains edit state per row for:
  - Status
  - Remarks
  - Attachment file
- Submits updates to `POST ${base}/Meeting/UpdateMeetingStatus`
- Uses authorization token from `localStorage.token` if available

### 2.6 General frontend behavior

- The project is a Capacitor / Ionic app, so it is built to run as a web app and mobile app.
- Many pages share the same `API_BASE` pattern and often call endpoints like `Employee/*`, `Leave/*`, `Sources/*`, `Penalty/*`, `Checkin/*`, etc.
- The frontend does not contain the business API implementation. It only calls the external backend.

## 3. Backend

### 3.1 Backend stack

The repository includes a separate AI backend under `ai-backend/`:

- Flask
- Flask-Cors
- Flask-Mail
- PyJWT
- OpenCV
- Ultralytics YOLO
- Keras-FaceNet
- TensorFlow
- Waitress (commented for production readiness)

### 3.2 AI backend purpose

`ai-backend/app.py` is a separate Python service that:

- loads face recognition embeddings
- performs face detection and recognition on images
- logs attendance status (Morning In, Lunch Out, Lunch In, Evening Out)
- communicates with the external DBASE API at `http://localhost:25918/api/Checkin/*`
- exposes its own endpoints for frontend/AIScanner usage

### 3.3 AI backend endpoints

The local AI backend exposes these routes:

- `POST /login` — returns a JWT token for admin access
- `POST /register_employee` — registers a new embedding from uploaded employee images
- `POST /recognize` — recognizes faces in a submitted base64 image
- `POST /send_attendance` — sends email with attendance report
- `GET /get_attendance` — fetches attendance for a date
- `GET /list_reports` — lists attendance report dates
- `GET /download_report/<filename>` — downloads a CSV attendance report
- `DELETE /delete_report/<filename>` — hides a report (frontend-only behavior)

### 3.4 AI backend integration with external API

The AI backend does not use a local database. Instead:

- It keeps `saved_embeddings` in memory while the service is running
- It syncs embeddings from the external API using `Checkin/DownloadAllModels`
- It saves new embeddings to the external API using `Checkin/UploadModel`
- Attendance logs are pushed to `Checkin/AILogAttendance`
- Attendance data is fetched by `AIGetAttendanceByDate` and `AIGetAttendanceDates`

Requests to external API include header:

- `x-api-key: dbase-ai-master-key-2026`

### 3.5 Running the backend

From the repo root:

```bash
cd ai-backend
pip install -r requirements.txt
python app.py
```

This starts the AI backend on `http://0.0.0.0:5000` by default.

## 4. Database / Data layer

### 4.1 In-repo DB status

- There is no database schema or database server implementation in this repository.
- The primary business data storage is external and belongs to the destination API server at `API_BASE`.
- The local `ai-backend` service only proxies and stores face embeddings in memory.

### 4.2 External API data assumptions

The frontend and AI backend together rely on external API endpoints that imply these data entities:

#### Meeting-related entities
- Meeting record fields used in the frontend:
  - `id`
  - `financialYear`
  - `monthName`
  - `meetingStatus`
  - `projectName`
  - `meetingType`
  - `meetingOwner`
  - `participants`
  - `attachment`
  - `frequencyType`
  - `remarks`
  - `createdBy`

#### Employee-related entities
- User fields expected in `localStorage.user`:
  - `EmpCode`, `empCode`, `Username`, `username`
  - `userType`, `UserType`
- Employee API endpoints include:
  - `Employee/Load_Employees`
  - `Employee/ChangePassword`
  - other employee-related load/save endpoints used across the app

#### Attendance / Checkin entities
- Face-recognition attendance data uses fields such as:
  - `empId`
  - `name`
  - `morningIn`
  - `lunchOut`
  - `lunchIn`
  - `eveningOut`
- Model storage uses:
  - `Emp_ID`
  - `Emp_Name`
  - `ModelName`
  - `ModelBase64`

### 4.3 Database conclusion

The actual database is external to this codebase. It is provided by the backend server at `localhost:25918/api/` in development or by production API at `https://api.dbasesolutions.in/api/`.

The internal code here does not include SQL schema or migration files.

## 5. How to run the project

### 5.1 Frontend

From repo root:

```bash
npm install
npm run dev
```

- The app uses Vite and Ionic React.
- It expects the backend API to be reachable at `http://localhost:25918/api/` in development.

### 5.2 AI backend

```bash
cd ai-backend
pip install -r requirements.txt
python app.py
```

### 5.3 Environment

- For frontend development, you may set `VITE_API_BASE` to change the production API URL.
- The frontend default development API URL is hard-coded by `src/config.ts`.

## 6. Notes

- This repo is mainly frontend + an AI proxy service; the main business backend is not included.
- Meeting features work if the external API supports the endpoints described above.
- The AI backend is built for attendance recognition and integrates with the same external API through the `Checkin` endpoints.
- The database schema and backend implementation are outside this repository.
