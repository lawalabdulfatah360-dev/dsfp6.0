# 💼 JobSphere — Job Tracking & Application Pipeline

A full-stack modern web application for job tracking, candidate management, and applicant pipeline tracking. Designed with an elegant **light blue** theme (`#0284c7` / `#38bdf8`), **FastAPI** backend, and an interactive **single-page web dashboard**.

---

## ✨ Features

### 🛡️ Admin / Employer Portal
- **Post Job Openings**: Create new positions with title, department, employment type (Full-time, Remote, Contract, etc.), experience level, salary range, responsibilities, and qualifications.
- **Manage Openings**: Edit details, toggle status between **Open** and **Closed**, and delete obsolete postings.
- **ATS Candidate Pipeline**:
  - View all incoming applications per job or across all openings.
  - Candidate details: Name, Email, Phone, Portfolio link, and Cover Letter.
  - **Resume Viewer & Download**: Download original resume files submitted by candidates (PDF, DOCX, TXT).
  - **5-Stage Pipeline Status Tracker**: Advance candidates from `Submitted` ➔ `Under Review` ➔ `Interview Scheduled` ➔ `Offer Extended` (or `Rejected`).
  - **Hiring Team Internal Notes**: Add screening feedback, interview impressions, or evaluation notes.
- **Live Recruitment Metrics**: Instant stats on total active openings, total applications, candidates in review, and offers extended.

### 👤 Applicant / Job Seeker Portal
- **Interactive Job Board**: Search positions by keywords, department, employment type, or experience level.
- **Detailed Job Overviews**: Clean modal view of role responsibilities and requirements.
- **1-Click Application Flow**: Submit name, contact info, portfolio link, cover letter, and upload resume files.
- **"My Applications" Real-Time Tracker**:
  - Live progress stepper visually reflecting where each application stands in the hiring process (`Submitted` ➔ `Under Review` ➔ `Interview Scheduled` ➔ `Offer Extended`).
  - View employer feedback and interview status updates.
  - Prevent duplicate applications to the same job.

### 🔐 Strict User Authentication & Roles
- Secure token-based authentication (JWT + PBKDF2-HMAC password hashing).
- Distinct roles: `admin` (Employer) vs. `applicant` (Job Seeker).
- Route-level security protecting admin-only actions (creating jobs, reviewing applicants, updating stages).
- **Instant Demo Switcher Bar**: Switch between pre-configured Admin and Applicant profiles with a single click for quick testing.

---

## 🎨 Color Palette (Light Blue)

| Element | Color Hex | Preview |
|---|---|---|
| **Primary Theme** | `#0284c7` | Sky Blue 600 |
| **Accent / Hover** | `#38bdf8` | Light Sky 400 |
| **Gradients & Glows** | `linear-gradient(135deg, #0284c7, #38bdf8)` | Sky Blend |
| **Soft Backgrounds** | `#f0f9ff` / `#e0f2fe` | Sky 50 & 100 |
| **Card Borders** | `#bae6fd` | Light Sky 200 |

---

## 🚀 Quick Start

### Option 1: Double-click Windows Launcher
Double-click `start.bat` in the project root folder. It will automatically check your Python environment, install any missing dependencies, start the server, and open your browser!

### Option 2: Run via Terminal
```bash
# 1. Activate the virtual environment
.\.venv\Scripts\activate

# 2. Run the application
python run.py
```

The application will start at:
👉 **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

Interactive Swagger API docs are available at:
👉 **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**

---

## 🔑 Pre-Seeded Demo Credentials

You can test either role immediately using the top bar buttons or logging in manually:

| Role | Email | Password | Pre-populated Data |
|---|---|---|---|
| **Admin** | `admin@jobtrack.com` | `Admin123!` | 4 active job postings, ATS candidate pipeline |
| **Applicant** | `applicant@example.com` | `User123!` | 1 active application under review |

*You can also register brand-new applicant or admin accounts using the "Create Account" modal.*

---

## 📂 Project Structure

```text
DSFP 6.0/
├── app/
│   ├── __init__.py
│   ├── database.py         # SQLite schema initialization & database connection
│   ├── auth.py             # JWT token handling, password hashing & FastAPI role dependencies
│   ├── main.py             # FastAPI REST API routes, schemas, and static file serving
│   └── static/
│       ├── index.html      # Responsive Single-Page Application (HTML5 + Lucide Icons)
│       ├── css/
│       │   └── style.css   # Light blue theme styling, responsive grid, modal & stepper
│       └── js/
│           └── app.js      # Frontend controller (Auth, Job Board, ATS pipeline, Modals)
├── uploads/                # Secure directory storing applicant resumes (PDF, DOCX)
├── test_app.py             # Full end-to-end automated test suite
├── run.py                  # Entrypoint script with automatic browser launch
├── start.bat               # Windows 1-click startup batch script
├── requirements.txt        # Python package dependencies
└── README.md               # Documentation and usage guide
```

---

## 🧪 Automated Testing

To run the end-to-end integration test suite:
```bash
.\.venv\Scripts\python test_app.py
```
This tests:
1. Admin & applicant logins and token verification
2. New account registration & role validation
3. Admin posting and editing job openings
4. Role permissions (ensuring applicants cannot post jobs)
5. Keyword search and multi-criteria filtering
6. Job application submission with resume file upload
7. Prevention of duplicate applications
8. Real-time status update to "Interview Scheduled" with admin notes
9. Candidate resume download authorization
10. Admin analytics and recruitment metrics

