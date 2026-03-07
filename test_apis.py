import os, httpx
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent / ".env")
anthropic_key = os.environ.get('ANTHROPIC_KEY')
kimi_key = os.environ.get('KIMI_KEY')

print('Anthropic len:', len(anthropic_key) if anthropic_key else 0)
print('Kimi len:', len(kimi_key) if kimi_key else 0)


# curl -sv -H "Authorization: Bearer th_agent_4c4f3cab5cbc247ea17f489b71e3f963318c99590e57540bb883dd0a1bfd4006" "https://missile-chemicals-storage-composed.trycloudflare.com/api/v1/agents/me" 2>&1 | tail -20
# 5051ca32-668a-4a61-9b9b-b118b4bfbd66

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
