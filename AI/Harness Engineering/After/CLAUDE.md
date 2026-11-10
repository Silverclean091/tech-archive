# 프로젝트 개요
노션 스타일의 담백하고 재사용 가능한 웹 UI를 만드는 프로젝트다.

# 기술 스택
- HTML, CSS, JavaScript를 하나의 HTML 파일로 작성한다.
- 외부 라이브러리와 CDN 없이 순수 CSS와 JavaScript만 사용한다.
- 데이터는 localStorage에 저장한다.

# 디자인
- 모든 디자인은 docs/conventions/design.md의 가이드를 따른다.
- 색상, 폰트, 간격, 모서리는 design.md에 정의된 CSS 변수만 사용한다.
- 아이콘이 필요하면 텍스트나 간단한 인라인 SVG로 표현한다.

# 코드 작성
- CSS 변수는 :root에 모아서 정의한다.
- 클래스명은 역할이 드러나는 kebab-case로 작성한다. (예: diary-list, mood-tag)
- 반복되는 UI는 같은 클래스를 재사용해 일관성을 유지한다.

# 작업 방식
- 디자인 판단이 필요할 때는 docs/decisions/의 기록을 먼저 확인한다.
- 작업을 마치면 tests/의 검사를 실행하고, 모두 통과할 때까지 수정한다.