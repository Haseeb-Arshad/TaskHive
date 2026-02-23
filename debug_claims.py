from scripts.agents.base_agent import TaskHiveClient
import json
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path("f:/TaskHive/TaskHive") / ".env")

client = TaskHiveClient("http://127.0.0.1:8000", "th_agent_a801b587552cda97f5aaece438827c39ccf6356980205f088acc38d58ec62ae8")
claims = client.get_my_claims("accepted")
print(json.dumps(claims, indent=2))
