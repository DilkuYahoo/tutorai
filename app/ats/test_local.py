#!/usr/bin/env python3
"""
Local integration test runner for ATS Lambda handlers.

Invokes handlers directly against the real al_ats_prod DynamoDB table.
Requires AWS credentials with DynamoDB access in ap-southeast-2.

Usage:
    LOCAL_DEV=1 python3 test_local.py
"""

import os
import sys
import json

# Wire LOCAL_DEV and table before any imports
os.environ.setdefault("LOCAL_DEV", "1")
os.environ.setdefault("TABLE_NAME", "al_ats_prod")
os.environ.setdefault("AWS_DEFAULT_REGION", "ap-southeast-2")
os.environ.setdefault("RESUME_BUCKET", "advicelab")
os.environ.setdefault("RESUME_PREFIX", "ats/resumes/prod")
os.environ.setdefault("NOTIFICATION_LAMBDA_ARN", "")  # silence async notify locally

# Make shared module importable from lambda/
LAMBDA_DIR = os.path.join(os.path.dirname(__file__), "lambda")
sys.path.insert(0, LAMBDA_DIR)

# ── Helpers ───────────────────────────────────────────────────────────────────

PASS = "\033[32m✔\033[0m"
FAIL = "\033[31m✘\033[0m"
_results = []


def event(method="GET", path="/", path_params=None, body=None, qs=None):
    return {
        "requestContext": {"http": {"method": method}},
        "pathParameters": path_params or {},
        "queryStringParameters": qs or {},
        "body": json.dumps(body) if body else None,
    }


def check(label, resp, expected_status=200):
    status = resp.get("statusCode")
    body = resp.get("body", "")
    parsed = json.loads(body) if isinstance(body, str) and body else body
    ok = status == expected_status
    icon = PASS if ok else FAIL
    _results.append(ok)
    detail = ""
    if not ok:
        detail = f"  → got {status}: {body[:120]}"
    print(f"  {icon}  {label}{detail}")
    return parsed if ok else None


def section(title):
    print(f"\n{'─' * 55}")
    print(f"  {title}")
    print(f"{'─' * 55}")


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_jobs():
    section("Jobs")
    from jobs.list_jobs import lambda_handler as list_jobs
    from jobs.create_job import lambda_handler as create_job
    from jobs.get_job import lambda_handler as get_job
    from jobs.update_job import lambda_handler as update_job
    from jobs.archive_job import lambda_handler as archive_job

    # Create
    resp = create_job(event("POST", "/jobs", body={
        "title": "Senior Python Engineer",
        "employmentType": "Full-time",
        "status": "Open",
        "department": "Engineering",
        "location": "Sydney, AU",
        "salaryMin": 140000,
        "salaryMax": 180000,
    }), None)
    result = check("create_job → 201", resp, 201)
    if not result:
        return None
    job_id = result["id"]
    print(f"       job_id={job_id}")

    # Get
    resp = get_job(event("GET", f"/jobs/{job_id}", path_params={"jobId": job_id}), None)
    check("get_job → 200", resp)

    # List (all)
    resp = list_jobs(event("GET", "/jobs"), None)
    check("list_jobs → 200", resp)

    # List with status filter
    resp = list_jobs(event("GET", "/jobs", qs={"status": "Open"}), None)
    check("list_jobs?status=Open → 200", resp)

    # Update
    resp = update_job(event("PUT", f"/jobs/{job_id}", path_params={"jobId": job_id}, body={
        "status": "Closed",
    }), None)
    check("update_job → 200", resp)

    # Archive
    resp = archive_job(event("DELETE", f"/jobs/{job_id}", path_params={"jobId": job_id}), None)
    check("archive_job → 200", resp)

    return job_id


def test_candidates():
    section("Candidates")
    from candidates.create_candidate import lambda_handler as create_candidate
    from candidates.get_candidate import lambda_handler as get_candidate
    from candidates.list_candidates import lambda_handler as list_candidates
    from candidates.update_candidate import lambda_handler as update_candidate

    # Create
    resp = create_candidate(event("POST", "/candidates", body={
        "firstName": "Alice",
        "lastName": "Test",
        "email": f"alice.test.{os.urandom(3).hex()}@example.com",
        "phone": "0400 000 000",
        "location": "Sydney, AU",
        "source": "LinkedIn",
    }), None)
    result = check("create_candidate → 201", resp, 201)
    if not result:
        return None
    candidate_id = result["id"]
    print(f"       candidate_id={candidate_id}")

    # Duplicate email → 409
    # (skipped to avoid polluting table; email is randomised above)

    # Get
    resp = get_candidate(event("GET", f"/candidates/{candidate_id}", path_params={"candidateId": candidate_id}), None)
    check("get_candidate → 200", resp)

    # List
    resp = list_candidates(event("GET", "/candidates"), None)
    check("list_candidates → 200", resp)

    # List with search
    resp = list_candidates(event("GET", "/candidates", qs={"search": "alice"}), None)
    check("list_candidates?search=alice → 200", resp)

    # Update tags
    resp = update_candidate(event("PUT", f"/candidates/{candidate_id}", path_params={"candidateId": candidate_id}, body={
        "tags": ["python", "senior"],
        "notes": "Strong candidate",
    }), None)
    check("update_candidate → 200", resp)

    return candidate_id


def test_applications(job_id, candidate_id):
    section("Applications")
    from jobs.create_job import lambda_handler as create_job
    from applications.create_application import lambda_handler as create_application
    from applications.get_application import lambda_handler as get_application
    from applications.list_applications import lambda_handler as list_applications
    from applications.move_stage import lambda_handler as move_stage

    # Need an Open job for application
    resp = create_job(event("POST", "/jobs", body={
        "title": "Test Role for Application",
        "employmentType": "Contract",
        "status": "Open",
    }), None)
    result = check("create_job (for application test) → 201", resp, 201)
    if not result:
        return None
    open_job_id = result["id"]

    # Create application
    resp = create_application(event("POST", "/applications", body={
        "candidateId": candidate_id,
        "jobId": open_job_id,
    }), None)
    result = check("create_application → 201", resp, 201)
    if not result:
        return None
    app_id = result["id"]
    print(f"       app_id={app_id}")

    # Duplicate → 409
    resp = create_application(event("POST", "/applications", body={
        "candidateId": candidate_id,
        "jobId": open_job_id,
    }), None)
    check("create_application duplicate → 409", resp, 409)

    # Get
    resp = get_application(event("GET", f"/applications/{app_id}", path_params={"applicationId": app_id}), None)
    result = check("get_application → 200", resp)
    if result:
        assert result.get("stageHistory"), "stageHistory should not be empty"
        print(f"       stageHistory entries: {len(result['stageHistory'])}")

    # List by job
    resp = list_applications(event("GET", "/applications", qs={"jobId": open_job_id}), None)
    check("list_applications?jobId → 200", resp)

    # List by candidate
    resp = list_applications(event("GET", "/applications", qs={"candidateId": candidate_id}), None)
    check("list_applications?candidateId → 200", resp)

    # Move stage
    for stage in ["Screening", "Interview", "Offer"]:
        resp = move_stage(event("POST", f"/applications/{app_id}/move",
                                path_params={"applicationId": app_id},
                                body={"stage": stage, "note": f"Moved to {stage}"}), None)
        check(f"move_stage → {stage} → 200", resp)

    return app_id, open_job_id


def test_pipeline(job_id):
    section("Pipeline")
    from pipeline.get_pipeline import lambda_handler as get_pipeline

    # All applications
    resp = get_pipeline(event("GET", "/pipeline"), None)
    check("get_pipeline (all) → 200", resp)

    # Filtered by job
    resp = get_pipeline(event("GET", "/pipeline", qs={"jobId": job_id}), None)
    check("get_pipeline?jobId → 200", resp)


def test_interviews(app_id):
    section("Interviews")
    from interviews.create_interview import lambda_handler as create_interview
    from interviews.list_interviews import lambda_handler as list_interviews
    from interviews.update_interview import lambda_handler as update_interview
    from interviews.submit_feedback import lambda_handler as submit_feedback

    resp = create_interview(event("POST", "/interviews", body={
        "applicationId": app_id,
        "type": "Video",
        "scheduledAt": "2026-05-01T10:00:00+10:00",
        "durationMinutes": 60,
        "panelIds": ["local-dev-user"],
        "meetingLink": "https://meet.example.com/abc",
    }), None)
    result = check("create_interview → 201", resp, 201)
    if not result:
        return
    interview_id = result["id"]
    print(f"       interview_id={interview_id}")

    resp = list_interviews(event("GET", "/interviews"), None)
    check("list_interviews (all) → 200", resp)

    resp = list_interviews(event("GET", "/interviews", qs={"applicationId": app_id}), None)
    check("list_interviews?applicationId → 200", resp)

    resp = update_interview(event("PUT", f"/interviews/{interview_id}",
                                  path_params={"interviewId": interview_id},
                                  body={"meetingLink": "https://meet.example.com/updated"}), None)
    check("update_interview → 200", resp)

    resp = submit_feedback(event("POST", f"/interviews/{interview_id}/feedback",
                                 path_params={"interviewId": interview_id},
                                 body={
                                     "rating": 4,
                                     "recommendation": "Advance",
                                     "strengths": "Great communicator",
                                     "concerns": "Needs more DynamoDB experience",
                                 }), None)
    check("submit_feedback → 200", resp)


def test_users():
    section("Users")
    from users.get_me import lambda_handler as get_me
    from users.list_users import lambda_handler as list_users

    resp = get_me(event("GET", "/users/me"), None)
    check("get_me → 200 (creates profile on first call)", resp)

    resp = list_users(event("GET", "/users"), None)
    check("list_users → 200", resp)


def test_audit(app_id):
    section("Audit")
    from audit.get_audit_trail import lambda_handler as get_audit_trail

    resp = get_audit_trail(event("GET", f"/audit/{app_id}", path_params={"entityId": app_id}), None)
    result = check("get_audit_trail → 200", resp)
    if result:
        print(f"       audit entries: {len(result)}")


def test_reports():
    section("Reports")
    from reports.get_metrics import lambda_handler as get_metrics

    resp = get_metrics(event("GET", "/reports/metrics"), None)
    result = check("get_metrics → 200", resp)
    if result:
        print(f"       openRoles={result.get('openRoles')}  "
              f"totalCandidates={result.get('totalCandidates')}  "
              f"inPipeline={result.get('inPipeline')}")


def test_resumes(candidate_id):
    section("Resumes")
    from resumes.get_upload_url import lambda_handler as get_upload_url

    resp = get_upload_url(event("POST", "/resumes/upload-url", body={
        "candidateId": candidate_id,
        "fileName": "alice-cv.pdf",
        "contentType": "application/pdf",
    }), None)
    result = check("get_upload_url → 200", resp)
    if result:
        print(f"       s3Key={result.get('s3Key')}")


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"\nATS local integration tests")
    print(f"Table : {os.environ['TABLE_NAME']}")
    print(f"Region: {os.environ['AWS_DEFAULT_REGION']}")

    job_id = test_jobs()
    candidate_id = test_candidates()

    app_id = None
    open_job_id = None
    if candidate_id:
        result = test_applications(job_id, candidate_id)
        if result:
            app_id, open_job_id = result

    if open_job_id:
        test_pipeline(open_job_id)

    if app_id:
        test_interviews(app_id)
        test_audit(app_id)

    test_users()
    test_reports()

    if candidate_id:
        test_resumes(candidate_id)

    # Summary
    total = len(_results)
    passed = sum(_results)
    failed = total - passed
    print(f"\n{'═' * 55}")
    print(f"  {passed}/{total} passed", end="")
    if failed:
        print(f"  \033[31m({failed} failed)\033[0m")
    else:
        print(f"  \033[32m(all green)\033[0m")
    print(f"{'═' * 55}\n")
    sys.exit(0 if failed == 0 else 1)
