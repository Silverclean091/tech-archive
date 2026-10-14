# Focus & Grass

할 일 체크리스트 + 완료율 히트맵(잔디) + 포모도로 타이머. 빌드 도구 없이 브라우저에서 동작하고, 데이터는 브라우저 `localStorage`에만 저장됩니다.

## 실행

[Node.js](https://nodejs.org) 18 이상이 필요합니다. 그 외에 설치할 것은 없습니다. 스크립트가 로컬 서버(`serve.js`)를 띄우고 브라우저를 엽니다. 종료는 `Ctrl+C`입니다.

**macOS / Linux** (Windows의 Git Bash에서도 됩니다)

```bash
cd focus-grass
./run.sh            # http://localhost:8000 이 열립니다
./run.sh 9000       # 포트 지정
./run.sh --no-open  # 브라우저를 자동으로 열지 않음
```

실행 권한이 없다는 오류가 나면 `chmod +x run.sh` 후 다시 실행하거나 `bash run.sh`로 실행하세요.

**Windows**: `run.bat`을 더블클릭하거나, 명령 프롬프트에서 `run.bat [포트] [--no-open]`을 실행합니다.

**참고**
- 브라우저가 `file://`로 연 페이지의 ES 모듈을 막기 때문에, `index.html`을 더블클릭해서는 열리지 않습니다. 그래서 서버가 필요합니다.
- 서버는 내 컴퓨터(`127.0.0.1`)에서만 접근할 수 있고, 앱 파일(`index.html`, `css/`, `js/`, `tests/browser/`)만 내보냅니다.
- 기본 포트(8000)가 사용 중이면 다음 포트로 자동으로 넘어가며 화면에 알려 줍니다. 브라우저 저장소는 주소(호스트+포트)마다 따로라서, **포트가 바뀌면 이전 포트에서 쓴 기록이 보이지 않습니다.** 항상 같은 포트를 쓰려면 포트를 지정하세요.
- Node 대신 파이썬이 있다면 `python3 -m http.server 8000`으로도 열 수 있습니다.

## 테스트

Node 18 이상이 필요하고 설치할 패키지는 없습니다. 순수 로직과 서버를 테스트합니다.

```bash
cd focus-grass
node --test
```

### 브라우저 테스트

화면(DOM) 동작은 `node --test`로 확인할 수 없어서 브라우저 페이지로 확인합니다. 서버를 띄운 뒤(`./run.sh --no-open 8765`) 아래 주소를 열면 `PASS`/`FAIL` 목록이 나옵니다.

- `http://localhost:8765/tests/browser/ui-smoke.html`: 체크리스트·히트맵·다중 탭·더블클릭 (몇 초)
- `http://localhost:8765/tests/browser/timer-smoke.html`: 1분 집중/휴식 사이클과 탭 제목 안내 (실제 시간으로 약 4분)

**주의:** 두 페이지는 앱의 `localStorage`(`ffg:*` 키)를 비우고 테스트합니다. 시작할 때 백업했다가 끝나면 복원하지만, 도중에 탭을 닫으면 복원되지 않습니다. 저장소는 서버 주소(호스트+포트) 단위라서, 앱을 실제로 쓰는 주소(예: `localhost:8000`)가 아닌 **다른 포트**로 서버를 띄워 여세요.

## 구조

- `js/dateUtils.js`, `todos.js`, `settings.js`, `pomodoro.js`: DOM을 모르는 순수 로직 (테스트 대상)
- `js/storage.js`: `localStorage` 접근과 데이터 정규화
- `js/heatmap.js`: 완료율 → 레벨 계산(순수) + 히트맵 렌더링
- `js/notify.js`: 소리, 브라우저 알림, 탭 제목
- `js/ui/`: DOM 렌더링과 입력 처리
- `js/main.js`: 상태 보관과 모듈 연결
- `serve.js`: 로컬 정적 서버 (macOS / Windows / Linux 공통). `run.sh`와 `run.bat`은 Node를 확인하고 이것을 실행하는 얇은 래퍼입니다.
