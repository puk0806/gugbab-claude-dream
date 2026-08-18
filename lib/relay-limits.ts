/**
 * relay 입력 상한 로컬 상수 — 참조 소스: relay openapi `x-relay-limits`
 * (GET {RELAY_URL}/api/openapi.json, 2026-08-14 배포 스펙).
 * 값이 어긋나도 400 재시도 경로가 런타임에 흡수하므로 동기화 파이프라인은 두지 않는다.
 */
export const RELAY_LIMITS = {
    maxMessageContentChars: 20_000,
    maxMessagesCount: 100,
    maxTotalContentBytes: 100_000,
    maxCustomPromptChars: 20_000,
} as const;

/** 사전 가드 예산 — relay 합산 상한에서 안전 마진(10%)을 둔 값 */
export const OUTGOING_BUDGET_BYTES = 90_000;

/** 400(history-budget) 재시도 시 유지할 최대 메시지 수 — 2왕복 + 현재 user 턴 */
export const RETRY_MAX_MESSAGES = 5;

/**
 * 400(history-budget) 재시도 시 바이트 예산 — 사전 가드 예산의 절반 (파생값).
 * 상수와 relay 실측 상한이 어긋난(drift) 경우 개수 축소만으로는 부족할 수 있어
 * 바이트 예산도 함께 조인다. 마진 변경 시 자동 추종 (health 앱과 동일 산식).
 */
export const RETRY_BUDGET_BYTES = Math.floor(OUTGOING_BUDGET_BYTES / 2);
