"""
TrustVault — Authorization Mutation Verification Script

RISE grading rule:
"We will take one authorisation check out of your code and run your tests.
If they still pass, they were not testing anything."

This script simulates bypassing authorize_document_access by monkeypatching it
to unconditionally return the Document without verifying ownership/grants,
runs pytest on the authorization and revocation test suites, and asserts that
the test suite FAILS loudly.
"""
import sys
import subprocess
import os

def run_mutation_test():
    print("=" * 60)
    print("[SECURITY] RUNNING TRUSTVAULT AUTHORIZATION MUTATION VERIFICATION")
    print("=" * 60)

    # 1. First run the unmutated test suite to ensure everything passes
    print("\n[Step 1] Running unmodified security test suite (Expected: PASS)...")
    cmd_pass = [
        sys.executable, "-m", "pytest",
        "tests/test_authorization.py",
        "tests/test_revocation.py",
        "-q"
    ]
    res_pass = subprocess.run(cmd_pass, cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    if res_pass.returncode != 0:
        print("[FAIL] Baseline test suite failed! Fix existing tests first.")
        return False
    print("[PASS] Baseline tests passed cleanly.")

    # 2. Mutate authorization logic: create a temporary runner or script that monkeypatches authorize_document_access
    print("\n[Step 2] Simulating authorization check removal (Monkeypatching authorize_document_access)...")
    mutation_runner = """
import pytest
import sys
import app.services.authorization_service as auth_svc
from app.models.document import Document

# MONKEYPATCH: Remove all authorization checks and return the document directly!
original_auth = auth_svc.authorize_document_access

def bypassed_authorize_document_access(db, user, document_id, required_permission, action_name, request_meta):
    # DANGEROUS BYPASS: directly return whatever document is in the database!
    doc = db.query(Document).filter(Document.id == document_id).first()
    return doc

auth_svc.authorize_document_access = bypassed_authorize_document_access

# Run the pytest suite with the bypass active
exit_code = pytest.main(["tests/test_authorization.py", "tests/test_revocation.py", "-q"])
sys.exit(exit_code)
"""
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    runner_path = os.path.join(backend_dir, "_temp_mutation_runner.py")
    with open(runner_path, "w", encoding="utf-8") as f:
        f.write(mutation_runner)

    try:
        res_mutated = subprocess.run([sys.executable, runner_path], cwd=backend_dir)
        print(f"\nMutated test run exited with code: {res_mutated.returncode}")
        if res_mutated.returncode != 0:
            print("=" * 60)
            print("[SUCCESS] MUTATION VERIFICATION SUCCESSFUL!")
            print("Tests FAILED when authorization checks were removed.")
            print("This proves that the authorization test suite is effective and non-trivial.")
            print("=" * 60)
            return True
        else:
            print("=" * 60)
            print("[DANGER] MUTATION VERIFICATION FAILED!")
            print("Tests PASSED even when authorize_document_access was completely bypassed!")
            print("=" * 60)
            return False
    finally:
        if os.path.exists(runner_path):
            os.remove(runner_path)

if __name__ == "__main__":
    success = run_mutation_test()
    sys.exit(0 if success else 1)
