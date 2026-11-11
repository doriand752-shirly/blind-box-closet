"""Upload auth-related server files and restart the API without reseeding."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

import paramiko

HOST = os.environ.get("VPS_IP", "85.17.145.134")
USER = os.environ.get("VPS_USER", "root")
PASS = os.environ.get("VPS_PASSWORD")
if not PASS:
    raise SystemExit("Set VPS_PASSWORD env var before deploying")

REMOTE = "/opt/blind-box-closet/server"
LOCAL_ROOT = os.path.join(os.path.dirname(__file__), "..", "server", "src")
FILES = ("auth.ts", "index.ts", "schema.sql", "db.ts")


def main() -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS, timeout=30)
    sftp = client.open_sftp()
    for name in FILES:
        local = os.path.abspath(os.path.join(LOCAL_ROOT, name))
        remote = f"{REMOTE}/src/{name}"
        print(f"put {name} -> {remote}")
        sftp.put(local, remote)
    sftp.close()

    stdin, stdout, stderr = client.exec_command(
        "systemctl restart blind-box-closet.service; sleep 3; "
        "systemctl is-active blind-box-closet.service; "
        "curl -s http://127.0.0.1:8787/health"
    )
    print(stdout.read().decode("utf-8", "replace"))
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print(err)
    client.close()

    # Smoke-test register → me → delete → register again
    email = "review-demo+authfix@blindboxcloset.app"
    password = "ReviewDemo19!"
    base = f"http://{HOST}:8787"

    def post(path: str, body: dict, token: str | None = None):
        data = json.dumps(body).encode()
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(
            f"{base}{path}", data=data, headers=headers, method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                return res.status, json.load(res)
        except urllib.error.HTTPError as e:
            payload = e.read().decode("utf-8", "replace")
            try:
                parsed = json.loads(payload)
            except Exception:
                parsed = {"error": payload}
            return e.code, parsed

    def delete_me(token: str):
        req = urllib.request.Request(
            f"{base}/me",
            headers={"Authorization": f"Bearer {token}"},
            method="DELETE",
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                return res.status, json.load(res)
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read().decode("utf-8", "replace"))

    # Clean leftover from previous smoke tests
    code, login = post("/auth/login", {"email": email, "password": password})
    if code == 200 and "token" in login:
        delete_me(login["token"])

    code, reg = post(
        "/auth/register",
        {"email": email, "password": password, "displayName": "Review Demo"},
    )
    print("register", code, reg.get("user", {}).get("email") or reg)
    if code != 200:
        raise SystemExit("register failed")

    token = reg["token"]
    code, deleted = delete_me(token)
    print("delete", code, deleted)
    if code != 200:
        raise SystemExit("delete failed")

    code, reg2 = post(
        "/auth/register",
        {"email": email, "password": password, "displayName": "Review Demo"},
    )
    print("re-register", code, reg2.get("user", {}).get("id") or reg2)
    if code != 200:
        raise SystemExit("re-register failed")

    token2 = reg2["token"]
    code, login2 = post("/auth/login", {"email": email, "password": password})
    print("login", code, login2.get("user", {}).get("email") or login2)
    if code != 200:
        raise SystemExit("login failed")

    delete_me(token2)
    print("Auth smoke test OK")


if __name__ == "__main__":
    main()
