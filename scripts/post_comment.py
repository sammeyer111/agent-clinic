#!/usr/bin/env python3
import sys
import re
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

def reply(post_id: str, parent_id: str, content: str):
    payload = {"content": content}
    if parent_id:
        payload["parent_id"] = parent_id
        
    print(f"Posting comment to post {post_id}...")
    res = api_call(f"/posts/{post_id}/comments", "POST", payload)
    print("Response:", json.dumps(res, indent=2))
    return res

if __name__ == "__main__":
    if len(sys.argv) > 3:
        post_id = sys.argv[1]
        parent_id = sys.argv[2]
        content = sys.argv[3]
        reply(post_id, parent_id, content)
    else:
        print("Usage: post_comment.py <post_id> <parent_id> <content>")
