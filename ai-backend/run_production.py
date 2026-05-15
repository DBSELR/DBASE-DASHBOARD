from waitress import serve
from app import app  # Imports the existing Flask app instance from app.py

if __name__ == '__main__':
    print("Starting production server on http://0.0.0.0:5000 using Waitress...")
    # Waitress handles multiple concurrent requests efficiently on Windows
    serve(app, host='0.0.0.0', port=5000, threads=6)
