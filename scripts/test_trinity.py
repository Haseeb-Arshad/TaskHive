import datetime
import requests
import json
import uuid

BASE_URL = "http://127.0.0.1:8000/api/v1"
API_KEY = "th_agent_a801b587552cda97f5aaece438827c39ccf6356980205f088acc38d58ec62ae8"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

passed = 0
failed = 0

def check(name, condition, msg=""):
    global passed, failed
    if condition:
        print(f"✅ PASS: {name}")
        passed += 1
    else:
        print(f"❌ FAIL: {name} - {msg}")
        failed += 1

def run_tests():
    print("Starting Trinity Architecture Tests...\n")
    
    # --- 1. Tools Layer Validation ---
    print("--- 1. Testing Constraints ---")
    
    # 1.1 Envelope (Success)
    res = requests.get(f"{BASE_URL}/tasks", headers=HEADERS)
    data = res.json()
    check("1.1 Consistent Envelope (Success)", 
          "ok" in data and "data" in data and "meta" in data and data["ok"] is True,
          "Missing standard envelope fields")
          
    # 1.8 Rate Limit Headers
    check("1.8 Rate Limit Headers",
          "X-RateLimit-Limit" in res.headers,
          "Missing X-RateLimit headers")
          
    # 1.5 Cursor Pagination
    check("1.5 Cursor Pagination",
          "cursor" in data["meta"] or "has_more" in data["meta"],
          "Missing cursor/has_more in meta")
          
    # 1.4 Integer IDs
    is_int_id = len(data["data"]) == 0 or isinstance(data["data"][0]["id"], int)
    check("1.4 Integer IDs", is_int_id, "IDs are not integers")

    # 1.2 Envelope (Error) & 1.3 Actionable Errors
    res = requests.post(f"{BASE_URL}/tasks/99999/claims", headers={}, json={"proposed_credits": 10})
    err_data = res.json()
    check("1.2 Consistent Envelope (Error)",
          "ok" in err_data and "error" in err_data and err_data["ok"] is False,
          "Missing error envelope fields")
    
    check("1.3 Actionable Errors (Suggestion)",
          "suggestion" in err_data.get("error", {}),
          "Missing suggestion field in error")

    # 1.6 Bulk Operations
    bulk_res = requests.post(f"{BASE_URL}/tasks/bulk/claims", headers=HEADERS, json={"claims": [{"task_id": 99999, "proposed_credits": 10}]})
    check("1.6 Bulk Operations Route",
          bulk_res.status_code in [200, 201],
          f"Bulk route failed or returned unexpected status: {bulk_res.status_code} {bulk_res.text}")
          
    # 1.7 Idempotency
    unique_key = str(uuid.uuid4())
    idem_headers = {**HEADERS, "Idempotency-Key": unique_key}
    
    # First request
    res1 = requests.post(f"{BASE_URL}/tasks/99999/claims", headers=idem_headers, json={"proposed_credits": 10})
    # Second request
    res2 = requests.post(f"{BASE_URL}/tasks/99999/claims", headers=idem_headers, json={"proposed_credits": 10})
    check("1.7 Idempotency Guarantee",
          "X-Idempotency-Replayed" in res2.headers,
          f"Second request missing replay header. Response: {res2.headers}")
          
    # --- 2. Binding Rule Tests ---
    print("\n--- 2. Testing Binding Rule (Skills Sync) ---")
    
    # 2.2 Authorization Violation
    res = requests.post(f"{BASE_URL}/tasks/1/claims", headers={}, json={"proposed_credits": 10})
    err = res.json().get("error", {})
    check("2.2 Auth Violation matches Skill",
          err.get("code") == "UNAUTHORIZED" and "Authorization: Bearer" in err.get("suggestion", ""),
          f"Mismatch auth error: {err}")
          
    # 2.3 Type Violation
    res = requests.post(f"{BASE_URL}/tasks/1/claims", headers=HEADERS, json={"proposed_credits": "not-an-int"})
    err = res.json().get("error", {})
    check("2.3 Type Violation matches Skill",
          res.status_code in [400, 422] and err.get("code") == "VALIDATION_ERROR",
          f"Mismatch type validation error: {err}")
          
    # 2.5 Submit Deliverable Status Violation
    # Submitting for a task that isn't ours or doesn't exist
    res = requests.post(f"{BASE_URL}/tasks/99999/deliverables", headers=HEADERS, json={"content": "Here is work"})
    err = res.json().get("error", {})
    check("2.5 Status Violation matches Skill (TASK_NOT_FOUND)",
          res.status_code == 404 and err.get("code") == "TASK_NOT_FOUND" and "GET /api/v1/tasks" in err.get("suggestion", ""),
          f"Mismatch status violation error: {err}")
          
    print(f"\nResults: {passed} Passed, {failed} Failed")

if __name__ == "__main__":
    run_tests()
