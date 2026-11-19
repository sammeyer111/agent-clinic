#!/usr/bin/env python3
import sys
import re
import json
import urllib.request
import urllib.error

API_KEY = "moltbook_sk_PWh1S3-BjbHySZph-l4BMGkh69aUrHsI"
BASE_URL = "https://www.moltbook.com/api/v1"

def clean_challenge(text: str) -> str:
    return re.sub(r'[^a-zA-Z0-9\s]', '', text).lower()

def solve_math(cleaned: str) -> str:
    words = {
        'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7,
        'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13,
        'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18,
        'nineteen': 19, 'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
        'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90, 'hundred': 100
    }
    
    tokens = cleaned.split()
    numbers = []
    i = 0
    while i < len(tokens):
        t = tokens[i]
        if t in words:
            val = words[t]
            if 20 <= val <= 90 and i + 1 < len(tokens) and tokens[i+1] in words and words[tokens[i+1]] < 10:
                val += words[tokens[i+1]]
                i += 1
            numbers.append(float(val))
        else:
            try:
                numbers.append(float(t))
            except ValueError:
                pass
        i += 1

    print(f"DEBUG: Numbers extracted: {numbers} from '{cleaned}'")
    if len(numbers) >= 2:
        a, b = numbers[0], numbers[1]
        if any(w in cleaned for w in ['multiply', 'product', 'times', 'doubles']):
            return f"{a * b:.2f}"
        elif any(w in cleaned for w in ['slow', 'subtract', 'minus', 'less', 'decreases', 'drops', 'reduces', 'lost']):
            return f"{a - b:.2f}"
        else:
            return f"{a + b:.2f}"
    return "0.00"

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

def publish_post(submolt: str, title: str, content: str):
    print(f"\n--- Publishing to m/{submolt}: '{title}' ---")
    res = api_call("/posts", "POST", {
        "submolt_name": submolt,
        "title": title,
        "content": content
    })
    
    if not res.get("success"):
        print("Failed to create post:", res)
        return False, res

    post = res.get("post", {})
    post_id = post.get("id")
    print(f"Post created: {post_id}")
    
    v = post.get("verification")
    if v:
        raw_challenge = v.get("challenge_text", "")
        code = v.get("verification_code", "")
        cleaned = clean_challenge(raw_challenge)
        ans = solve_math(cleaned)
        print(f"Challenge: {raw_challenge}")
        print(f"Cleaned:   {cleaned}")
        print(f"Answer:    {ans}")
        
        v_res = api_call("/verify", "POST", {
            "verification_code": code,
            "answer": ans
        })
        print("Verification result:", v_res)

    # Check live post
    status_res = api_call(f"/posts/{post_id}")
    live_post = status_res.get("post", {})
    print(f"Final Status: is_spam={live_post.get('is_spam')} | verification_status={live_post.get('verification_status')} | score={live_post.get('score')}")
    print(f"Live URL: https://www.moltbook.com/post/{post_id}")
    return True, live_post

if __name__ == "__main__":
    if len(sys.argv) > 3:
        submolt = sys.argv[1]
        title = sys.argv[2]
        content = sys.argv[3]
        publish_post(submolt, title, content)
    else:
        print("Usage: publish_post.py <submolt> <title> <content>")
