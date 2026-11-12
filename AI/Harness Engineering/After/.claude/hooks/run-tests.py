import json
import os
import subprocess
import sys
from pathlib import Path

MAX_RETRIES = 3

data = json.load(sys.stdin)
project = Path(os.environ.get("CLAUDE_PROJECT_DIR", "."))
counter = project / ".claude" / ".stop-retries"

# 새로 작업을 끝내려는 경우 재시도 횟수 초기화
if not data.get("stop_hook_active"):
    counter.unlink(missing_ok=True)

result = subprocess.run(
    [sys.executable, str(project / "tests" / "check_design.py")],
    capture_output=True, text=True,
)

if result.returncode == 0:
    counter.unlink(missing_ok=True)
    sys.exit(0)

retries = int(counter.read_text()) if counter.exists() else 0
if retries >= MAX_RETRIES:
    counter.unlink(missing_ok=True)
    sys.exit(0)  # 3번 넘게 실패하면 사람이 확인하도록 종료 허용

counter.write_text(str(retries + 1))
print(result.stderr + "\n위 항목을 수정한 뒤 작업을 마무리해주세요.", file=sys.stderr)
sys.exit(2)  # 2 = 종료 차단, 메시지는 Claude에게 전달됨