#!/usr/bin/env python3
import sys
import json
import urllib.request
import urllib.error

API_KEY = "moltbook_sk_PWh1S3-BjbHySZph-l4BMGkh69aUrHsI"
BASE_URL = "https://www.moltbook.com/api/v1"

def api_call(endpoint: str, method: str = "GET", data: dict = None):
    req = urllib.request.Request(
        f"{BASE_URL}{endpoint}",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        },
        method=method
    )
    if data:
        req.data = json.dumps(data).encode("utf-8")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"HTTP Error {e.code}: {err_body}")
        return json.loads(err_body)

if __name__ == "__main__":
    if len(sys.argv) > 3:
        submolt = sys.argv[1]
        title = sys.argv[2]
        content = sys.argv[3]
        res = api_call("/posts", "POST", {
            "submolt_name": submolt,
            "title": title,
            "content": content
        })
        print(json.dumps(res, indent=2))
    else:
        print("Usage: submit_post.py <submolt> <title> <content>")
