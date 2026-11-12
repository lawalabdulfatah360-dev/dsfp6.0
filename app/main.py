"""
Main FastAPI Application for JobSphere - Job Tracking Application.
Handles authentication, job posting, application submissions, and ATS tracking pipeline.
"""

import os
import shutil
import uuid
import mimetypes
from typing import Optional, List

# Ensure Windows registry does not serve wrong MIME types for CSS/JS
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/javascript", ".js")
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, EmailStr, Field

from app.database import get_db, init_db
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
    get_current_user,
    get_current_admin,
    get_current_applicant,
    security
)

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOAD_DIR = os.path.join(os.path.dirname(BASE_DIR), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

app = FastAPI(
    title="JobSphere - Job Tracking & ATS Application",
    description="Application for posting job openings, candidate applications, and hiring pipeline tracking.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Pydantic Schemas ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2)
    role: str = Field(..., pattern="^(admin|applicant)$")
    company_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class JobCreate(BaseModel):
    title: str = Field(..., min_length=3)
    department: str
    location: str
    job_type: str = "Full-time"  # Full-time, Part-time, Remote, Contract, Internship
    salary_range: Optional[str] = None
    experience_level: Optional[str] = "Mid Level"  # Entry Level, Mid Level, Senior, Lead
    description: str
    requirements: Optional[str] = None
    status: str = "Open"


class JobUpdate(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    salary_range: Optional[str] = None
    experience_level: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    status: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(Submitted|Under Review|Interview Scheduled|Offer Extended|Rejected)$")
    admin_notes: Optional[str] = None


# --- Seed Initial Data ---
def seed_sample_data():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as count FROM users")
    count = cursor.fetchone()["count"]

    if count == 0:
        admin_pass = hash_password("Admin123!")
        applicant_pass = hash_password("User123!")

        # Create Admin
        cursor.execute(
            """INSERT INTO users (email, password_hash, full_name, role, company_name)
               VALUES (?, ?, ?, 'admin', ?)""",
            ("admin@jobtrack.com", admin_pass, "Alexander Vance", "BlueSky Tech Corp")
        )
        admin_id = cursor.lastrowid

        # Create Applicant
        cursor.execute(
            """INSERT INTO users (email, password_hash, full_name, role, company_name)
               VALUES (?, ?, ?, 'applicant', NULL)""",
            ("applicant@example.com", applicant_pass, "Sarah Connor")
        )
        applicant_id = cursor.lastrowid

        # Seed Jobs
        sample_jobs = [
            (
                "Senior Cloud & DevOps Engineer",
                "Infrastructure & Cloud",
                "Remote (Global)",
                "Full-time",
                "$130,000 - $160,000 / yr",
                "Senior",
                "We are seeking an experienced Cloud Engineer to design, scale, and automate our cloud deployment infrastructure.\n\nKey Responsibilities:\n- Architect resilient infrastructure on AWS/GCP with Terraform\n- Maintain CI/CD automated deployment pipelines\n- Monitor system telemetry, latency, and fault tolerance\n- Partner with security teams to enforce compliance",
                "- 4+ years of production experience with AWS or GCP\n- Strong proficiency in Docker, Kubernetes, and Terraform\n- Solid background in Python, Bash, or Go\n- Experience with Prometheus, Datadog, or Grafana",
                "Open",
                admin_id
            ),
            (
                "Product UI/UX Designer",
                "Product & Design",
                "New York, NY (Hybrid)",
                "Full-time",
                "$95,000 - $120,000 / yr",
                "Mid Level",
                "Join our core design squad to craft intuitive, delightful user experiences for our next-generation web & mobile products.\n\nKey Responsibilities:\n- Conduct customer research and design interactive prototypes in Figma\n- Build and maintain our light blue design system components\n- Collaborate closely with product managers and engineers",
                "- 3+ years of experience in digital product design\n- Outstanding portfolio demonstrating web application workflows\n- Expert knowledge of Figma, component variants, and design tokens\n- Strong empathy for user feedback and accessible design (WCAG)",
                "Open",
                admin_id
            ),
            (
                "Full-Stack Python & Web Developer",
                "Engineering",
                "San Francisco, CA (or Remote)",
                "Full-time",
                "$115,000 - $145,000 / yr",
                "Mid Level",
                "Looking for a passionate Full-Stack developer comfortable building high-performance REST APIs and modern web interfaces.\n\nKey Responsibilities:\n- Develop performant microservices using FastAPI and SQLite/PostgreSQL\n- Build responsive, accessible frontend dashboards\n- Write unit and integration tests for core business flows",
                "- Proficiency in Python 3, FastAPI, or Django/Flask\n- Strong understanding of JavaScript/TypeScript, HTML5, CSS\n- Familiarity with relational database design and query optimization\n- Passion for clean, readable, documented code",
                "Open",
                admin_id
            ),
            (
                "Product Growth Marketing Lead",
                "Marketing",
                "Chicago, IL (Hybrid)",
                "Full-time",
                "$85,000 - $110,000 / yr",
                "Mid Level",
                "Lead customer acquisition, search marketing, and product growth experiments across key B2B channels.",
                "- 3+ years experience in B2B SaaS growth or performance marketing\n- Data-driven mindset with Google Analytics, Mixpanel, or SQL\n- Excellent written and verbal communication",
                "Open",
                admin_id
            )
        ]

        cursor.executemany(
            """INSERT INTO jobs (title, department, location, job_type, salary_range, experience_level, description, requirements, status, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            sample_jobs
        )

        # Seed sample application for demo
        cursor.execute("SELECT id FROM jobs WHERE title = ?", ("Senior Cloud & DevOps Engineer",))
        job_row = cursor.fetchone()
        if job_row:
            job_id = job_row["id"]
            cursor.execute(
                """INSERT INTO applications (job_id, user_id, full_name, email, phone, portfolio_url, cover_letter, status, admin_notes)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    job_id,
                    applicant_id,
                    "Sarah Connor",
                    "applicant@example.com",
                    "+1 (555) 019-2834",
                    "https://github.com/sarahconnor-cloud",
                    "I am very excited about the Senior Cloud & DevOps Engineer position. I have over 5 years of experience deploying scalable Kubernetes clusters and automated CI/CD pipelines.",
                    "Under Review",
                    "Strong background in Terraform and Kubernetes. High priority for initial screen."
                )
            )

        conn.commit()

    conn.close()


@app.on_event("startup")
def startup_event():
    init_db()
    seed_sample_data()


# ==========================================================
# AUTH ENDPOINTS
# ==========================================================

@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM users WHERE email = ?", (user_data.email.lower().strip(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="An account with this email address already exists.")

    hashed = hash_password(user_data.password)
    cursor.execute(
        """INSERT INTO users (email, password_hash, full_name, role, company_name)
           VALUES (?, ?, ?, ?, ?)""",
        (
            user_data.email.lower().strip(),
            hashed,
            user_data.full_name.strip(),
            user_data.role,
            user_data.company_name.strip() if user_data.company_name else None
        )
    )
    user_id = cursor.lastrowid
    conn.commit()

    cursor.execute("SELECT id, email, full_name, role, company_name, created_at FROM users WHERE id = ?", (user_id,))
    new_user = dict(cursor.fetchone())
    conn.close()

    token = create_access_token(data={"sub": str(user_id), "role": new_user["role"]})

    return {
        "message": "Account created successfully.",
        "access_token": token,
        "token_type": "bearer",
        "user": new_user
    }


@app.post("/api/auth/login")
def login(login_data: UserLogin):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, email, password_hash, full_name, role, company_name, created_at FROM users WHERE email = ?",
        (login_data.email.lower().strip(),)
    )
    user = cursor.fetchone()
    conn.close()

    if not user or not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password. Please verify your credentials.",
        )

    user_dict = {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role": user["role"],
        "company_name": user["company_name"],
        "created_at": user["created_at"]
    }

    token = create_access_token(data={"sub": str(user["id"]), "role": user["role"]})

    return {
        "message": "Login successful.",
        "access_token": token,
        "token_type": "bearer",
        "user": user_dict
    }


@app.get("/api/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}


# ==========================================================
# JOB LISTING & MANAGEMENT ENDPOINTS
# ==========================================================

@app.get("/api/jobs")
def get_jobs(
    q: Optional[str] = Query(None, description="Search keyword in title, department, description"),
    department: Optional[str] = None,
    job_type: Optional[str] = None,
    experience_level: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    request: Request = None
):
    """
    Get job postings. Publicly visible.
    If authenticated as an applicant, returns `has_applied` boolean for each job.
    If authenticated as admin, includes total applicant count.
    """
    # Detect current user if token present
    current_user_id = None
    user_role = None
    auth_header = request.headers.get("Authorization") if request else None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        payload = decode_token(token)
        if payload and "sub" in payload:
            current_user_id = int(payload["sub"])
            user_role = payload.get("role")

    conn = get_db()
    cursor = conn.cursor()

    query = """
    SELECT j.*, u.full_name as poster_name, u.company_name as poster_company,
           (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as applicant_count
    """

    if current_user_id and user_role == "applicant":
        query += f", (SELECT COUNT(*) FROM applications WHERE job_id = j.id AND user_id = {current_user_id}) as user_applied"
    else:
        query += ", 0 as user_applied"

    query += " FROM jobs j JOIN users u ON j.created_by = u.id WHERE 1=1"
    params = []

    # If applicant or guest, only show 'Open' jobs unless admin explicitly filtered
    if user_role != "admin":
        query += " AND j.status = 'Open'"
    elif status_filter:
        query += " AND j.status = ?"
        params.append(status_filter)

    if q:
        query += " AND (j.title LIKE ? OR j.department LIKE ? OR j.location LIKE ? OR j.description LIKE ?)"
        term = f"%{q.strip()}%"
        params.extend([term, term, term, term])

    if department:
        query += " AND j.department = ?"
        params.append(department)

    if job_type:
        query += " AND j.job_type = ?"
        params.append(job_type)

    if experience_level:
        query += " AND j.experience_level = ?"
        params.append(experience_level)

    query += " ORDER BY j.created_at DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    jobs = []
    for row in rows:
        item = dict(row)
        item["has_applied"] = bool(item.pop("user_applied", 0))
        jobs.append(item)

    return {"jobs": jobs}


@app.get("/api/jobs/{job_id}")
def get_job_detail(job_id: int, request: Request = None):
    current_user_id = None
    auth_header = request.headers.get("Authorization") if request else None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        payload = decode_token(token)
        if payload and "sub" in payload:
            current_user_id = int(payload["sub"])

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """SELECT j.*, u.full_name as poster_name, u.company_name as poster_company,
                  (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as applicant_count
           FROM jobs j JOIN users u ON j.created_by = u.id
           WHERE j.id = ?""",
        (job_id,)
    )
    job = cursor.fetchone()

    if not job:
        conn.close()
        raise HTTPException(status_code=404, detail="Job opening not found.")

    job_dict = dict(job)

    # Check if applicant applied
    job_dict["has_applied"] = False
    if current_user_id:
        cursor.execute("SELECT id, status, applied_at FROM applications WHERE job_id = ? AND user_id = ?", (job_id, current_user_id))
        app_row = cursor.fetchone()
        if app_row:
            job_dict["has_applied"] = True
            job_dict["my_application"] = dict(app_row)

    conn.close()
    return {"job": job_dict}


@app.post("/api/jobs", status_code=status.HTTP_201_CREATED)
def create_job(job_data: JobCreate, current_admin: dict = Depends(get_current_admin)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """INSERT INTO jobs (title, department, location, job_type, salary_range, experience_level, description, requirements, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            job_data.title.strip(),
            job_data.department.strip(),
            job_data.location.strip(),
            job_data.job_type,
            job_data.salary_range.strip() if job_data.salary_range else None,
            job_data.experience_level,
            job_data.description.strip(),
            job_data.requirements.strip() if job_data.requirements else None,
            job_data.status,
            current_admin["id"]
        )
    )
    job_id = cursor.lastrowid
    conn.commit()

    cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
    new_job = dict(cursor.fetchone())
    conn.close()

    return {"message": "Job opening created successfully.", "job": new_job}


@app.put("/api/jobs/{job_id}")
def update_job(job_id: int, job_data: JobUpdate, current_admin: dict = Depends(get_current_admin)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM jobs WHERE id = ?", (job_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Job opening not found.")

    updates = []
    params = []

    for field, val in job_data.dict(exclude_unset=True).items():
        if val is not None:
            updates.append(f"{field} = ?")
            params.append(val.strip() if isinstance(val, str) else val)

    if updates:
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(job_id)
        query = f"UPDATE jobs SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()

    cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
    updated_job = dict(cursor.fetchone())
    conn.close()

    return {"message": "Job opening updated successfully.", "job": updated_job}


@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: int, current_admin: dict = Depends(get_current_admin)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, title FROM jobs WHERE id = ?", (job_id,))
    job = cursor.fetchone()
    if not job:
        conn.close()
        raise HTTPException(status_code=404, detail="Job opening not found.")

    cursor.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
    conn.commit()
    conn.close()

    return {"message": f"Job opening '{job['title']}' was deleted successfully."}


# ==========================================================
# APPLICATION & PIPELINE TRACKING ENDPOINTS
# ==========================================================

@app.post("/api/jobs/{job_id}/apply", status_code=status.HTTP_201_CREATED)
async def apply_for_job(
    job_id: int,
    full_name: str = Form(...),
    email: EmailStr = Form(...),
    phone: str = Form(...),
    portfolio_url: Optional[str] = Form(None),
    cover_letter: Optional[str] = Form(None),
    resume: Optional[UploadFile] = File(None),
    current_applicant: dict = Depends(get_current_applicant)
):
    conn = get_db()
    cursor = conn.cursor()

    # Verify job exists and is Open
    cursor.execute("SELECT id, title, status FROM jobs WHERE id = ?", (job_id,))
    job = cursor.fetchone()
    if not job:
        conn.close()
        raise HTTPException(status_code=404, detail="Job opening not found.")
    if job["status"] != "Open":
        conn.close()
        raise HTTPException(status_code=400, detail="This job opening is currently closed for new applications.")

    # Check for existing application
    cursor.execute("SELECT id FROM applications WHERE job_id = ? AND user_id = ?", (job_id, current_applicant["id"]))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="You have already submitted an application for this position.")

    # Handle resume upload
    saved_filename = None
    original_filename = None

    if resume and resume.filename:
        original_filename = os.path.basename(resume.filename)
        ext = os.path.splitext(original_filename)[1]
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_name)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(resume.file, buffer)

        saved_filename = unique_name

    cursor.execute(
        """INSERT INTO applications (job_id, user_id, full_name, email, phone, portfolio_url, cover_letter, resume_filename, resume_original_name, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted')""",
        (
            job_id,
            current_applicant["id"],
            full_name.strip(),
            str(email).strip().lower(),
            phone.strip(),
            portfolio_url.strip() if portfolio_url else None,
            cover_letter.strip() if cover_letter else None,
            saved_filename,
            original_filename
        )
    )
    application_id = cursor.lastrowid
    conn.commit()

    cursor.execute(
        """SELECT a.*, j.title as job_title, j.department as job_department
           FROM applications a JOIN jobs j ON a.job_id = j.id
           WHERE a.id = ?""",
        (application_id,)
    )
    new_app = dict(cursor.fetchone())
    conn.close()

    return {
        "message": "Your application has been submitted successfully! You can track its progress in your dashboard.",
        "application": new_app
    }


@app.get("/api/applications/my")
def get_my_applications(current_applicant: dict = Depends(get_current_applicant)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """SELECT a.*, j.title as job_title, j.department as job_department,
                  j.location as job_location, j.job_type as job_type, j.status as job_status
           FROM applications a
           JOIN jobs j ON a.job_id = j.id
           WHERE a.user_id = ?
           ORDER BY a.applied_at DESC""",
        (current_applicant["id"],)
    )
    rows = cursor.fetchall()
    conn.close()

    return {"applications": [dict(r) for r in rows]}


@app.get("/api/admin/applications")
def get_all_applications(
    job_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    current_admin: dict = Depends(get_current_admin)
):
    conn = get_db()
    cursor = conn.cursor()

    query = """
    SELECT a.*, j.title as job_title, j.department as job_department,
           j.location as job_location, u.company_name as poster_company
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    JOIN users u ON j.created_by = u.id
    WHERE 1=1
    """
    params = []

    if job_id:
        query += " AND a.job_id = ?"
        params.append(job_id)

    if status_filter:
        query += " AND a.status = ?"
        params.append(status_filter)

    if search:
        query += " AND (a.full_name LIKE ? OR a.email LIKE ? OR j.title LIKE ?)"
        s = f"%{search.strip()}%"
        params.extend([s, s, s])

    query += " ORDER BY a.applied_at DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return {"applications": [dict(r) for r in rows]}


@app.get("/api/admin/jobs/{job_id}/applications")
def get_applications_for_job(job_id: int, current_admin: dict = Depends(get_current_admin)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """SELECT a.*, j.title as job_title, j.department as job_department
           FROM applications a
           JOIN jobs j ON a.job_id = j.id
           WHERE a.job_id = ?
           ORDER BY a.applied_at DESC""",
        (job_id,)
    )
    rows = cursor.fetchall()
    conn.close()

    return {"applications": [dict(r) for r in rows]}


@app.patch("/api/admin/applications/{application_id}/status")
def update_application_status(
    application_id: int,
    status_data: StatusUpdate,
    current_admin: dict = Depends(get_current_admin)
):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, job_id, full_name, email, status FROM applications WHERE id = ?", (application_id,))
    application = cursor.fetchone()
    if not application:
        conn.close()
        raise HTTPException(status_code=404, detail="Application not found.")

    updates = ["status = ?", "updated_at = CURRENT_TIMESTAMP"]
    params = [status_data.status]

    if status_data.admin_notes is not None:
        updates.append("admin_notes = ?")
        params.append(status_data.admin_notes.strip())

    params.append(application_id)

    query = f"UPDATE applications SET {', '.join(updates)} WHERE id = ?"
    cursor.execute(query, params)
    conn.commit()

    cursor.execute(
        """SELECT a.*, j.title as job_title, j.department as job_department
           FROM applications a JOIN jobs j ON a.job_id = j.id
           WHERE a.id = ?""",
        (application_id,)
    )
    updated_app = dict(cursor.fetchone())
    conn.close()

    return {
        "message": f"Application status updated to '{status_data.status}'.",
        "application": updated_app
    }


@app.get("/api/applications/{application_id}/resume")
def download_resume(
    application_id: int,
    current_user: dict = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM applications WHERE id = ?", (application_id,))
    app_data = cursor.fetchone()
    conn.close()

    if not app_data:
        raise HTTPException(status_code=404, detail="Application not found.")

    # Only admin or the applicant who owns the application can download the resume
    if current_user["role"] != "admin" and current_user["id"] != app_data["user_id"]:
        raise HTTPException(status_code=403, detail="Unauthorized to download this file.")

    if not app_data["resume_filename"]:
        raise HTTPException(status_code=404, detail="No resume file was attached to this application.")

    file_path = os.path.join(UPLOAD_DIR, app_data["resume_filename"])
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Resume file is no longer available on the server.")

    original_name = app_data["resume_original_name"] or "resume.pdf"
    return FileResponse(file_path, filename=original_name, media_type="application/octet-stream")


@app.get("/api/admin/stats")
def get_admin_stats(current_admin: dict = Depends(get_current_admin)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as total_jobs FROM jobs")
    total_jobs = cursor.fetchone()["total_jobs"]

    cursor.execute("SELECT COUNT(*) as open_jobs FROM jobs WHERE status = 'Open'")
    open_jobs = cursor.fetchone()["open_jobs"]

    cursor.execute("SELECT COUNT(*) as total_applications FROM applications")
    total_applications = cursor.fetchone()["total_applications"]

    cursor.execute("""
    SELECT status, COUNT(*) as count
    FROM applications
    GROUP BY status
    """)
    status_breakdown = {row["status"]: row["count"] for row in cursor.fetchall()}

    cursor.execute("SELECT COUNT(DISTINCT user_id) as total_candidates FROM applications")
    total_candidates = cursor.fetchone()["total_candidates"]

    conn.close()

    return {
        "total_jobs": total_jobs,
        "open_jobs": open_jobs,
        "total_applications": total_applications,
        "total_candidates": total_candidates,
        "status_breakdown": {
            "Submitted": status_breakdown.get("Submitted", 0),
            "Under Review": status_breakdown.get("Under Review", 0),
            "Interview Scheduled": status_breakdown.get("Interview Scheduled", 0),
            "Offer Extended": status_breakdown.get("Offer Extended", 0),
            "Rejected": status_breakdown.get("Rejected", 0),
        }
    }


# ==========================================================
# STATIC FILES SERVING & SPA ROOT
# ==========================================================

@app.get("/")
def serve_index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file, media_type="text/html")
    return {"message": "JobSphere API is active. Static files will be served here."}

CSS_DIR = os.path.join(STATIC_DIR, "css")
JS_DIR = os.path.join(STATIC_DIR, "js")
os.makedirs(CSS_DIR, exist_ok=True)
os.makedirs(JS_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/css", StaticFiles(directory=CSS_DIR), name="css")
app.mount("/js", StaticFiles(directory=JS_DIR), name="js")
