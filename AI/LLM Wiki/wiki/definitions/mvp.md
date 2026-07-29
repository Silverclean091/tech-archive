---
name: mvp_definition
description: TaskFlow 프로젝트의 MVP(최소 출시 버전) 정의
metadata:
  type: definition
  date: 2026-03-05
  confidence: 100
  source_documents:
    - 2026-03-05_킥오프_회의록.md
    - 2026-03-18_기능기획서_MVP.md
---

# MVP(Minimum Viable Product) 정의

## 정의
TaskFlow의 **최소 출시 가능한 버전(v1.0)**으로, 다음 4개 핵심 기능만을 포함하는 상태를 의미함.

## 포함 기능 (4개)
1. **할일관리**: 할일 생성/수정/삭제/완료 처리, 마감일/담당자/우선순위 지정
2. **팀 캘린더 동기화**: 팀원 일정과 할일 마감일을 하나의 캘린더 뷰로 통합
3. **협업 코멘트**: 할일 항목 내 댓글, 멘션(@) 기능 포함
4. **알림**: 마감일 임박, 담당자 지정, 멘션 시 푸시 알림 (FCM/APNs)

## 제외 기능 (Out of Scope, v1.1 이후 검토)
- 파일 공유 기능
- 다크모드 지원
- 외부 캘린더 연동(Google Calendar 등)

## 출시 조건
- 플랫폼: iOS/Android 동시 출시
- 품질 기준: [[release-gate]] 참고 (Critical 0건/High 3건 이하)

## 관련 정의
- [[power-user]]
- [[flow-ui]]
- [[sprint]]

---

**출처**: 2026-03-05_킥오프_회의록.md, 2026-03-18_기능기획서_MVP.md  
**변경 이력**: 2026-03-05 초기 정의
