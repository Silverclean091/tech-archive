# TaskFlow Wiki Index

## 📋 의사 결정 사항 (Decisions)

- [[MVP-scope-and-tech-stack]] — 킥오프 회의에서 기술 스택과 4가지 MVP 기능 확정
- [[design-system-and-onboarding]] — Flow UI 명칭 확정, 5단계 온보딩을 3단계로 축소
- [[sprint-operation-model]] — 2주 단위 스프린트, 마지막 3일 QA 전담 기간 고정
- [[release-gate-and-launch]] — Critical 0건/High 3건 이하 기준, 7월 20일 출시로 확정

## 🏷️ 용어 정의 (Definitions)

### MVP 및 사용자
- [[power-user]] — 하루 5개 이상 프로젝트를 동시 관리하는 핵심 타겟 사용자
- [[mvp]] — 4개 핵심 기능(할일관리, 캘린더 동기화, 협업 코멘트, 알림)만 포함하는 최소 출시 버전
- [[team-calendar-sync]] — 팀원 할일 마감일을 통합 캘린더 뷰로 표시 (MVP 최우선 기능)

### 디자인 및 UX
- [[flow-ui]] — TaskFlow의 사내 자체 디자인 시스템
- [[onboarding-flow]] — 3단계 신규 가입자 온보딩(회원가입+팀생성 → 초대 → 첫 할일)

### 개발 프로세스
- [[sprint]] — 2주 단위 개발 주기, 마지막 3일은 QA 전담
- [[backlog]] — 미개발 기능/작업 목록, 매 스프린트 기획에서 우선순위 재조정

### 품질 보증 및 출시
- [[release-gate]] — 정식 출시 판단 기준 (Critical 0건, High 3건 이하)
- [[hotfix]] — 정식 출시 후 긴급 버그 즉시 수정·배포 프로세스
- [[bug-triage]] — 버그를 심각도별로 분류하고 우선순위 결정

### 조직 및 역할
- [[team-members]] — TaskFlow 프로젝트 팀원 및 역할 정보

## 📊 처리 상태

### ✅ 완료 (Ingested)
- 2026-03-05 킥오프 회의록
- 2026-04-02 디자인리뷰 회의록
- 2026-05-14 스프린트기획 회의록
- 2026-06-25 QA및출시점검 회의록
- 프로젝트 로드맵
- MVP 기능 기획서

### 📈 Wiki 통계

- **최종 갱신**: 2026-07-28
- **처리된 raw 문서**: 6개
- **생성된 의사 결정**: 4개
- **생성된 정의**: 11개
- **총 wiki 문서**: 16개 (결정 4 + 정의 11 + 인덱스 1)

### 🔗 관계 네트워크

```
의사 결정 (4개)
├── MVP-scope-and-tech-stack
│   └── refs: power-user, mvp
├── design-system-and-onboarding
│   └── refs: flow-ui, onboarding-flow
├── sprint-operation-model
│   └── refs: sprint, backlog
└── release-gate-and-launch
    └── refs: release-gate, hotfix, bug-triage

정의 (11개)
├── MVP 영역: power-user, mvp, team-calendar-sync
├── 디자인 영역: flow-ui, onboarding-flow
├── 개발 영역: sprint, backlog
├── QA 영역: release-gate, hotfix, bug-triage
└── 조직 영역: team-members
```

---

## 🔄 지식 통합 프로세스

이 wiki는 `raw/` 폴더의 원본 문서를 꼼꼼히 분석하여 핵심 의사결정과 용어 정의를 추출한 결과입니다.

- **근거 출처**: raw/meetings와 raw/plannings의 원본 파일들
- **신뢰도**: 의사결정은 회의록 기반(100%), 정의는 다중 출처 교차 검증(80~100%)
- **관계 맵**: 문서 내 내부 링크를 통해 의사결정과 용어 정의 간의 입체적 관계 형성

---

**마지막 자가진단 (Lint)**: 2026-07-28 (모든 링크 검증 완료, 고아 파일 제거)
