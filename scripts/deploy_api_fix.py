import json
import urllib.request

import paramiko

import os

HOST = os.environ.get("VPS_IP", "85.17.145.134")
USER = os.environ.get("VPS_USER", "root")
PASS = os.environ.get("VPS_PASSWORD")
if not PASS:
    raise SystemExit("Set VPS_PASSWORD env var before deploying")
LOCAL = r"C:\Users\doria\Smiski\server\src\index.ts"
REMOTE = "/opt/blind-box-closet/server/src/index.ts"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=30)
sftp = client.open_sftp()
sftp.put(LOCAL, REMOTE)
sftp.close()

stdin, stdout, stderr = client.exec_command(
    "systemctl restart blind-box-closet.service; sleep 2; systemctl is-active blind-box-closet.service"
)
print(stdout.read().decode("ascii", "replace"))
print(stderr.read().decode("ascii", "replace"))
client.close()

detail = json.load(
    urllib.request.urlopen(
        "http://85.17.145.134:8787/catalog/series/e31863b2-fc58-4993-8f7a-a7535ceb14fa"
    )
)
print(detail["series"]["name_en"], "figures=", len(detail["figures"]))
print("first=", detail["figures"][0]["name_en"])
