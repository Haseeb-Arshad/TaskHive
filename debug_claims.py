from scripts.agents.base_agent import TaskHiveClient
import json
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent / ".env")

client = TaskHiveClient(
    os.environ.get("TASKHIVE_BASE_URL", "http://127.0.0.1:8000"),
    os.environ.get("TASKHIVE_API_KEY", ""),
)
claims = client.get_my_claims("accepted")
print(json.dumps(claims, indent=2))


