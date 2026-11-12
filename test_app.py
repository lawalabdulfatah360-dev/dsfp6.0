"""
End-to-End Test Suite for JobSphere Application.
Verifies all authentication, job posting, application submission, and ATS pipeline flows.
"""

import os
import io
from starlette.testclient import TestClient
from app.main import app, startup_event
from app.database import get_db

def run_tests():
    print("--- Starting JobSphere Tests ---")
    startup_event()
    client = TestClient(app)

    # 1. Test Demo Admin Login
    res = client.post("/api/auth/login", json={"email": "admin@jobtrack.com", "password": "Admin123!"})
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    admin_token = res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("✔ Demo Admin login verified")

    # 2. Test Demo Applicant Login
    res = client.post("/api/auth/login", json={"email": "applicant@example.com", "password": "User123!"})
    assert res.status_code == 200, f"Applicant login failed: {res.text}"
    applicant_token = res.json()["access_token"]
    applicant_headers = {"Authorization": f"Bearer {applicant_token}"}
    print("✔ Demo Applicant login verified")

    # 3. Test New User Registration (Applicant)
    unique_email = "john.doe.test@example.com"
    res = client.post("/api/auth/register", json={
        "email": unique_email,
        "password": "Password123!",
        "full_name": "John Doe",
        "role": "applicant"
    })
    # Could be 201 or 400 if already exists
    if res.status_code == 201:
        new_token = res.json()["access_token"]
        new_headers = {"Authorization": f"Bearer {new_token}"}
        print("✔ New applicant registration verified")
    else:
        res = client.post("/api/auth/login", json={"email": unique_email, "password": "Password123!"})
        new_token = res.json()["access_token"]
        new_headers = {"Authorization": f"Bearer {new_token}"}
        print("✔ Existing applicant login verified")

    # 4. Test Job Creation by Admin
    job_payload = {
        "title": "Lead AI Solutions Architect",
        "department": "Engineering & AI",
        "location": "Remote",
        "job_type": "Full-time",
        "salary_range": "$160,000 - $200,000 / yr",
        "experience_level": "Lead",
        "description": "Architect mission-critical multi-agent AI platforms and production pipelines.",
        "requirements": "7+ years software engineering, 3+ years LLM architectures, Python expertise.",
        "status": "Open"
    }
    res = client.post("/api/jobs", json=job_payload, headers=admin_headers)
    assert res.status_code == 201, f"Create job failed: {res.text}"
    created_job = res.json()["job"]
    job_id = created_job["id"]
    print(f"✔ Admin posted new job: ID {job_id} ('{created_job['title']}')")

    # 5. Non-admin cannot post jobs
    res = client.post("/api/jobs", json=job_payload, headers=applicant_headers)
    assert res.status_code == 403, f"Expected 403 for applicant posting job, got {res.status_code}"
    print("✔ Protected route verified: Applicant cannot post jobs")

    # 6. Public Job Listing
    res = client.get("/api/jobs?q=AI Solutions")
    assert res.status_code == 200
    jobs = res.json()["jobs"]
    assert any(j["id"] == job_id for j in jobs), "Search did not return the newly created job"
    print("✔ Job search and public listing verified")

    # 7. Applicant applies for the job with a resume file
    resume_content = b"%PDF-1.4 Mock resume content for John Doe AI Architect..."
    files = {
        "resume": ("john_doe_resume.pdf", io.BytesIO(resume_content), "application/pdf")
    }
    data = {
        "full_name": "John Doe",
        "email": unique_email,
        "phone": "+1-555-839-2019",
        "portfolio_url": "https://github.com/johndoe",
        "cover_letter": "I have designed scalable AI systems for 5+ years and would love to join your team."
    }
    res = client.post(f"/api/jobs/{job_id}/apply", headers=new_headers, data=data, files=files)
    assert res.status_code == 201, f"Apply failed: {res.text}"
    app_id = res.json()["application"]["id"]
    print(f"✔ Applicant applied for job: Application ID {app_id}")

    # 8. Duplicate application is rejected
    res = client.post(f"/api/jobs/{job_id}/apply", headers=new_headers, data=data)
    assert res.status_code == 400, "Expected 400 for duplicate application"
    print("✔ Duplicate application rejection verified")

    # 9. Applicant checks 'My Applications'
    res = client.get("/api/applications/my", headers=new_headers)
    assert res.status_code == 200
    my_apps = res.json()["applications"]
    assert any(a["id"] == app_id for a in my_apps), "Submitted app not in My Applications"
    print(f"✔ My Applications returned {len(my_apps)} application(s)")

    # 10. Admin views applicant pipeline
    res = client.get("/api/admin/applications", headers=admin_headers)
    assert res.status_code == 200
    admin_apps = res.json()["applications"]
    assert any(a["id"] == app_id for a in admin_apps), "New app not in admin pipeline"
    print(f"✔ Admin applications pipeline returned {len(admin_apps)} candidate(s)")

    # 11. Admin updates status to 'Interview Scheduled' with evaluation notes
    res = client.patch(f"/api/admin/applications/{app_id}/status", headers=admin_headers, json={
        "status": "Interview Scheduled",
        "admin_notes": "Passed technical phone screen with flying colors. Inviting for system design interview."
    })
    assert res.status_code == 200
    updated_app = res.json()["application"]
    assert updated_app["status"] == "Interview Scheduled"
    print("✔ Admin updated candidate status to 'Interview Scheduled' with notes")

    # 12. Applicant sees the new status in real-time
    res = client.get("/api/applications/my", headers=new_headers)
    assert res.status_code == 200
    matched_app = next(a for a in res.json()["applications"] if a["id"] == app_id)
    assert matched_app["status"] == "Interview Scheduled"
    assert "Passed technical phone screen" in matched_app["admin_notes"]
    print("✔ Applicant view reflects updated status and feedback notes")

    # 13. Admin downloads the candidate's resume
    res = client.get(f"/api/applications/{app_id}/resume", headers=admin_headers)
    assert res.status_code == 200
    assert res.content == resume_content
    print("✔ Resume download verified")

    # 14. Admin Stats check
    res = client.get("/api/admin/stats", headers=admin_headers)
    assert res.status_code == 200
    stats = res.json()
    assert stats["total_jobs"] >= 5
    assert stats["total_applications"] >= 2
    print(f"✔ Admin stats verified: {stats['total_jobs']} jobs, {stats['total_applications']} apps")

    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n")

if __name__ == "__main__":
    run_tests()

