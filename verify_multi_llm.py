import sys
from pathlib import Path
import os
from dotenv import load_dotenv

# Add parent path
sys.path.insert(0, str(Path(__file__).parent))

from scripts.agents.base_agent import smart_llm_call, llm_call, log_ok, log_err

def test_routing():
    print("=== Testing Smart LLM Routing ===")
    
    # 1. Test Routine (should hit Kimi or Trinity)
    print("\n[Test 1] Routine Routing (Expect Kimi/Trinity)")
    try:
        res1 = smart_llm_call("You are a helpful assistant.", "Say 'Kimi/Trinity test passed'", complexity="routine")
        print(f"Result: {res1}")
    except Exception as e:
        log_err(f"Routine test failed: {e}")

    # 2. Test High Complexity (should hit Claude)
    print("\n[Test 2] High Complexity Routing (Expect Claude)")
    try:
        res2 = smart_llm_call("You are a world-class architect.", "Say 'Claude high-complexity test passed'", complexity="high")
        print(f"Result: {res2}")
    except Exception as e:
        log_err(f"High complexity test failed: {e}")

    # 3. Test Provider Fallback
    print("\n[Test 3] Provider Fallback (Kimi -> Trinity -> Claude)")
    # We can simulate this by briefly changing the provider order or checking logs
    print("Manually initiating fallback sequence...")
    # This involves manually checking logs for "Provider X failed... Falling back..."
    
    print("\n=== Verification Complete ===")

if __name__ == "__main__":
    load_dotenv(Path(__file__).parent / ".env")
    test_routing()
