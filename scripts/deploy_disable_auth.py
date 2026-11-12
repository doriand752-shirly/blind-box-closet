import os
import urllib.request

import paramiko

PASS = os.environ.get("VPS_PASSWORD")
if not PASS:
    raise SystemExit("Set VPS_PASSWORD")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("85.17.145.134", username="root", password=PASS, timeout=30)
sftp = client.open_sftp()
sftp.put(
    os.path.join(os.path.dirname(__file__), "..", "server", "src", "index.ts"),
    "/opt/blind-box-closet/server/src/index.ts",
)
sftp.close()
stdin, stdout, stderr = client.exec_command(
    "systemctl restart blind-box-closet.service; sleep 2; "
    "curl -s http://127.0.0.1:8787/health; echo; "
    "curl -s -o /tmp/reg.json -w '%{http_code}' -X POST http://127.0.0.1:8787/auth/register "
    "-H 'Content-Type: application/json' "
    "-d '{\"email\":\"a@b.com\",\"password\":\"12345678\"}'; echo; "
    "cat /tmp/reg.json; echo"
)
print(stdout.read().decode("utf-8", "replace"))
print(stderr.read().decode("utf-8", "replace"))
client.close()

req = urllib.request.Request(
    "http://85.17.145.134:8787/auth/apple",
    data=b'{"identityToken":"x"}',
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=15) as res:
        print("apple", res.status, res.read().decode())
except urllib.error.HTTPError as e:
    print("apple", e.code, e.read().decode())
