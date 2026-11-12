import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXCLUDE = {".claude", "docs", "tests"}


def find_html_files():
    return [
        p for p in ROOT.rglob("*.html")
        if not any(part in EXCLUDE for part in p.relative_to(ROOT).parts)
    ]


def check(text):
    errors = []
    lines = text.splitlines()

    # 1. CSS 변수 정의
    if ":root" not in text or not re.search(r"--[\w-]+\s*:", text):
        errors.append("색상, 폰트, 간격은 :root에 CSS 변수로 정의해주세요.")

    # 2. 직접 쓴 색상값
    color = re.compile(r":\s*[^;]*?(#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\()")
    bad = [l.strip() for l in lines if not l.strip().startswith("--") and color.search(l)]
    if bad:
        errors.append("색상은 CSS 변수로 지정해주세요. 예: color: var(--color-text);\n" + "\n".join(bad[:5]))

    # 3. 그라데이션
    if re.search(r"(linear|radial|conic)-gradient\(", text):
        errors.append("배경은 단색 CSS 변수로 지정해주세요. 예: background: var(--color-bg);")

    # 4. 그림자
    bad = [
        l.strip() for l in lines
        if re.search(r"box-shadow\s*:", l)
        and not re.search(r"box-shadow\s*:\s*(none|var\(--shadow)", l)
    ]
    if bad:
        errors.append("그림자는 none 또는 var(--shadow-...)로 지정해주세요.\n" + "\n".join(bad[:5]))

    # 5. 폰트
    bad = [
        l.strip() for l in lines
        if re.search(r"font-family\s*:", l)
        and not l.strip().startswith("--")
        and "var(--font" not in l
    ]
    if bad:
        errors.append("폰트는 var(--font-...)로 지정해주세요.\n" + "\n".join(bad[:5]))

    # 6. 외부 리소스
    if re.search(r"<(script|link)[^>]+(src|href)=[\"']https?://", text):
        errors.append("외부 라이브러리 대신 순수 CSS와 JavaScript로 작성해주세요.")

    return errors


def main():
    files = find_html_files()

    # 아직 결과물이 없으면 검사하지 않음
    if not files:
        return 0

    if len(files) > 1:
        print("결과물은 HTML 파일 하나로 합쳐주세요.", file=sys.stderr)
        return 2

    errors = check(files[0].read_text(encoding="utf-8"))
    if errors:
        print(f"[{files[0].name}] 디자인 검사 결과\n\n" + "\n\n".join(errors), file=sys.stderr)
        return 2

    print("디자인 검사를 모두 통과했습니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())