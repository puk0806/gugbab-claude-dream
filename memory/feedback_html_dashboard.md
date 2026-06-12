---
name: feedback-html-dashboard
description: 꿈해몽 PWA 프로젝트는 작업이 한 단계 진행될 때마다 HTML 대시보드(docs/superpowers/specs/dream-app.html)를 함께 갱신해야 한다
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 01ac591f-561d-44ce-8b98-175205a2b0f1
---

이 프로젝트(`03_gugbab-claude-dream`, 꿈해몽 PWA)에서는 작업이 한 단계 끝날 때마다 `docs/superpowers/specs/dream-app.html`을 함께 갱신한다.

**Why:** 사용자(puk0806, 비기술자 친화)가 마크다운 spec 파일을 직접 읽기 어려워하고, 한눈에 진행 상황·기술 스택·todo를 보고 싶어 한다. 명시적으로 요청: "내가 한눈에 알아볼수있게 기획서 형태로 todo 리스트랑 해서 html로 만들어주고 하나의 작업이 이루어질때마다 하나씩 갱신해줘 기획서를"

**How to apply:**
- 마크다운 spec(`*-design.md`, `*-todo.md`)을 수정·갱신할 때마다 HTML 대시보드도 같이 갱신
- HTML은 단일 파일 자체 완결(인라인 CSS, 의존성 없음) — 더블클릭으로 브라우저에서 열 수 있어야 함
- 갱신 시 진행률(progress-bar fill 폭, X/Y 카운트), 체크리스트 done/current 클래스, 최종 갱신일 배지를 함께 수정
- 새로운 결정이 생기면 해당 카드·표 행을 추가
- 사용자가 직접 열어볼 일이 잦으므로 가독성·시각적 위계 우선
