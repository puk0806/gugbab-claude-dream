# Visual Regression — `e2e/visual/`

Playwright 기반 라우트 페이지 시각 회귀 영역.

## 구조

```
e2e/visual/
├── routes.spec.ts                 라우트별 스크린샷 정의
├── __screenshots__/               베이스라인 PNG (CI Linux에서 캡처, 자동 관리)
│   └── routes.spec.ts/
│       └── home.png
├── __diff_archive__/              머지된 PR의 시각 변화 영구 보존 (자동 관리)
│   └── pr-N/
│       ├── home/
│       │   ├── expected.png
│       │   ├── actual.png
│       │   └── diff.png
│       └── ...
└── README.md
```

## 작동 방식

1. PR 생성 또는 push 이벤트가 GH Actions `visual-regression` 워크플로우 트리거
2. **compare 모드** (기본):
   - 베이스라인 있고 diff 없음 → ✅ PASS
   - 베이스라인 있고 diff 있음 → ❌ FAIL — PR 코멘트에 expected/actual/diff PNG 인라인 표시
   - 베이스라인 없음 (신규 라우트) → ❌ FAIL — PR 코멘트에 신규 라우트의 actual PNG 표시
3. PR에 `accept-baseline` 라벨 부여 시 → **accept 모드** → `--update-snapshots` 실행 → PNG 자동 commit + push to PR branch → status 직접 등록 → 다음 compare 통과 → 머지 가능
4. **머지 후** → `archive-vr-diffs` 워크플로우가 `vrt-snapshots/pr-N` 브랜치의 PNG 를 main 의 `__diff_archive__/pr-N/` 으로 영구 보존

## 로컬에서

```bash
# 베이스라인은 CI에서 관리한다. 로컬은 비교 용도만.
pnpm test:visual            # 비교 (실패해도 commit 안 함)
pnpm test:visual:report     # 마지막 결과 리포트 보기
```

> 주의: 로컬 macOS와 CI Linux의 폰트 렌더링 차이로 로컬 비교는 실패할 수 있다.
> 베이스라인 PNG는 *반드시 CI에서 갱신*하고 로컬에서 직접 commit하지 않는다.
> 로컬에서 생성된 `__screenshots__/` 는 `.gitignore` 처리되어 commit 대상에서 제외된다.

## 라우트 추가

새 라우트를 만들면:

1. `routes.spec.ts` 에 test 추가
2. PR 생성 → 베이스라인 없으므로 CI fail
3. 시각 디자인 확인 후 PR에 `accept-baseline` 라벨 부여
4. CI가 베이스라인 PNG 생성 + commit + push
5. 머지 가능
