# 디자인 가이드

노션 스타일을 참고한 담백한 UI를 기준으로 한다.

## 디자인 원칙
- 흰 배경에 텍스트는 검정과 회색 계열로 표현한다.
- 정보의 위계는 글자 크기와 굵기로 구분한다.
- 영역은 얇은 회색 구분선과 여백으로 나눈다.
- 배경은 단색으로 채운다.
- 그림자는 팝업처럼 떠 있는 요소에만 --shadow-popover를 사용하고, 나머지는 none으로 둔다.
- 색은 태그와 상태 배지에만 채도 낮은 파스텔 톤으로 사용한다.
- 버튼과 목록 항목에 마우스를 올리면 --color-hover 배경으로 표시한다.
- 아이콘은 꼭 필요한 곳에만 작게 사용한다.

## CSS 변수
아래 변수를 :root에 그대로 정의하고, 모든 스타일은 이 변수로 지정한다.

### 색상
--color-bg: #ffffff;
--color-bg-sidebar: #f7f7f5;
--color-text: #37352f;
--color-text-secondary: #787774;
--color-border: #e9e9e7;
--color-hover: #f1f1ef;
--color-accent: #2383e2;
--color-accent-text: #ffffff;

### 태그 색상
--color-tag-gray: #e3e2e0;
--color-tag-yellow: #fdecc8;
--color-tag-green: #dbeddb;
--color-tag-blue: #d3e5ef;
--color-tag-red: #ffe2dd;
--color-tag-purple: #e8deee;

### 폰트
--font-base: -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
--font-size-sm: 13px;
--font-size-base: 15px;
--font-size-lg: 20px;
--font-size-xl: 28px;

### 간격
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 40px;

### 모서리
--radius-sm: 4px;
--radius-md: 6px;

### 그림자
--shadow-popover: 0 4px 12px rgba(15, 15, 15, 0.1);