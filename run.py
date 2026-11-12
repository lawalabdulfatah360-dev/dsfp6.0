"""
Entrypoint launcher for JobSphere - Job Tracking Application.
Starts Uvicorn server serving the FastAPI backend and responsive SPA frontend.
"""

import uvicorn
import webbrowser
import threading
import time

def open_browser():
    time.sleep(1.2)
    url = "http://127.0.0.1:8000"
    print(f"Opening JobSphere in your default web browser at {url}...")
    try:
        webbrowser.open(url)
    except Exception:
        pass

if __name__ == "__main__":
    print("=" * 60)
    print(" JobSphere — Job Tracking & Application Pipeline Platform")
    print(" Primary Theme: Light Blue (#0284c7 / #38bdf8)")
    print(" Backend: FastAPI (Asynchronous REST API)")
    print(" Frontend: Responsive SPA with Live ATS Pipeline")
    print(" Server: http://127.0.0.1:8000")
    print("=" * 60)

    # Launch browser automatically
    threading.Thread(target=open_browser, daemon=True).start()

    # Start FastAPI with Uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

