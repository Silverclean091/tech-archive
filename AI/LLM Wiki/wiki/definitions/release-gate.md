---
name: release_gate_definition
description: TaskFlow 출시 게이트(Release Gate) 정의
metadata:
  type: definition
  date: 2026-06-25
  confidence: 100
  source_documents:
    - 2026-06-25_QA및출시점검_회의록.md
---

# 출시 게이트(Release Gate) 정의

## 정의
**정식 출시 가능 여부를 판단하는 정량적 기준**.
TaskFlow 프로젝트에서 처음으로 명확한 수치 기준을 도입하여 "버그 없이 출시"의 모호함을 해결.

## TaskFlow 출시 기준
- **Critical 버그**: 0건 (필수)
- **High 버그**: 3건 이하 (허용)

## 의의
- 정량적이고 측정 가능한 기준 제시
- 팀 전체가 공감하는 명확한 목표 설정
- 정식 출시 판단의 객관화

## 버그 심각도 분류
- **Critical**: 앱 사용 불가능 수준 (예: 캘린더 중복 일정 생성)
- **High**: 주요 기능 오작동 (예: 알림 발송 미스)
- **Medium**: 부분적 기능 오류
- **Low**: 사소한 UI/UX 문제

## 프로젝트 표준
2026-06-25 회의에서 이 기준을 TaskFlow의 **표준 출시 기준**으로 확정.

## 관련 정의
- [[hotfix]]
- [[bug-triage]]

---

**출처**: 2026-06-25_QA및출시점검_회의록.md  
**변경 이력**: 2026-06-25 초기 정의
