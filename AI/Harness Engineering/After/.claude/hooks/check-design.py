import json
import re
import sys

data = json.load(sys.stdin)
tool_input = data.get("tool_input", {})
path = tool_input.get("file_path", "")

# HTML, CSS 파일만 검사
if not path.endswith((".html", ".css")):
    sys.exit(0)

# 작성하려는 내용 모으기 (Write, Edit, MultiEdit 대응)
texts = [tool_input.get("content", ""), tool_input.get("new_string", "")]
texts += [e.get("new_string", "") for e in tool_input.get("edits", [])]
text = "\n".join(t for t in texts if t)

messages = []

# 1. 직접 쓴 색상값 검사 (CSS 변수 정의 줄은 허용)
color_pattern = re.compile(r":\s*[^;]*?(#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\()")
bad_lines = [
    line.strip() for line in text.splitlines()
    if not line.strip().startswith("--") and color_pattern.search(line)
]
if bad_lines:
    messages.append(
        "색상은 docs/conventions/design.md에 정의된 CSS 변수로 지정해주세요. "
        "예: color: var(--color-text);\n수정할 줄:\n" + "\n".join(bad_lines[:5])
    )

# 2. 외부 리소스 검사
if re.search(r"<(script|link)[^>]+(src|href)=[\"']https?://", text):
    messages.append(
        "외부 라이브러리 대신 순수 CSS와 JavaScript로 작성해주세요."
    )

if messages:
    print("\n\n".join(messages), file=sys.stderr)
    sys.exit(2)  # 2 = 실행 차단, 메시지는 Claude에게 전달됨

sys.exit(0)