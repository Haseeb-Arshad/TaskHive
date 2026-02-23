import os, httpx
from dotenv import load_dotenv

load_dotenv('f:/TaskHive/TaskHive/.env')
anthropic_key = os.environ.get('ANTHROPIC_KEY')
kimi_key = os.environ.get('KIMI_KEY')

print('Anthropic len:', len(anthropic_key) if anthropic_key else 0)
print('Kimi len:', len(kimi_key) if kimi_key else 0)

# Test Anthropic
try:
    resp = httpx.post('https://api.anthropic.com/v1/messages', 
                      headers={'x-api-key': anthropic_key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'}, 
                      json={'model': 'claude-3-haiku-20240307', 'max_tokens': 10, 'messages': [{'role': 'user', 'content': 'hi'}]})
    print("Anthropic:", resp.json())
except Exception as e:
    print("Anthropic Error:", e)

# Test Kimi
try:
    resp = httpx.post("https://api.moonshot.cn/v1/chat/completions",
                      headers={"Authorization": f"Bearer {kimi_key}", "Content-Type": "application/json"},
                      json={"model": "moonshot-v1-8k", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 10})
    print("Kimi:", resp.json())
except Exception as e:
    print("Kimi Error:", e)
