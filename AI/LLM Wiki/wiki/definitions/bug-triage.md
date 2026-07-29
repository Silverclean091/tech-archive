---
name: bug_triage_definition
description: TaskFlow 버그 트리아지(Bug Triage) 정의
metadata:
  type: definition
  date: 2026-06-25
  confidence: 100
  source_documents:
    - 2026-06-25_QA및출시점검_회의록.md
---

# 버그 트리아지(Bug Triage) 정의

## 정의
**발견된 버그를 심각도별로 분류하고 처리 우선순위를 정하는 활동**.
TaskFlow에서는 정량적 출시 기준과 연계되어 운영.

## 심각도 분류
| 수준 | 정의 | 예시 |
|---|---|---|
| **Critical** | 앱 사용 불가능 수준 | 캘린더 동기화 시 중복 일정 생성 |
| **High** | 주요 기능 오작동 | 알림 발송 미스, 할일 저장 실패 |
| **Medium** | 부분적 기능 오류 | 특정 상황에서만 오류 발생 |
| **Low** | 사소한 UI/UX 문제 | 텍스트 정렬 오류, 아이콘 크기 |

## 출시 연계
- **출시 게이트**: Critical 0건, High 3건 이하
- **우선순위**: Critical → High → Medium → Low 순으로 처리
  - Critical은 출시 금지 조건
  - High는 수량 제한(3건 이하)

## 프로세스
1. 버그 발견 및 등록
2. 심각도 판단 (트리아지)
3. 우선순위 결정
4. 개발 착수 및 수정
5. 재검증

## 관련 정의
- [[release-gate]]
- [[hotfix]]

---

**출처**: 2026-06-25_QA및출시점검_회의록.md  
**변경 이력**: 2026-06-25 초기 정의
