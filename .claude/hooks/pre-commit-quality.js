#!/usr/bin/env node
/**
 * pre-commit-quality.js
 * PreToolUse Bash — git commit 직전 typecheck + biome check 강제 실행
 *
 * git commit 명령 감지 시:
 *   1. pnpm typecheck (tsc --noEmit)
 *   2. pnpm check (biome check)
 * 둘 중 하나라도 실패하면 커밋 차단
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function main() {
    const rl = readline.createInterface({ input: process.stdin });
    let raw = '';
    for await (const line of rl) raw += line + '\n';
    raw = raw.trim();

    if (!raw) return process.exit(0);

    let input;
    try { input = JSON.parse(raw); } catch { return process.exit(0); }

    const { hook_event_name, hookEventName, tool_name, tool_input = {} } = input;
    const eventName = hook_event_name || hookEventName;

    if (eventName !== 'PreToolUse') return process.exit(0);
    if (tool_name !== 'Bash') return process.exit(0);

    const cmd = (tool_input.command || '').trim();
    if (!/\bgit\s+commit\b/.test(cmd)) return process.exit(0);

    // package.json이 있는 프로젝트 루트 탐색
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    if (!fs.existsSync(path.join(projectDir, 'package.json'))) return process.exit(0);

    const errors = [];

    // 1. typecheck
    try {
        execSync('pnpm typecheck', {
            cwd: projectDir,
            timeout: 60000,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
    } catch (e) {
        const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
        errors.push(`[pre-commit-quality] ❌ TypeScript 오류:\n${out.trim().split('\n').slice(0, 15).map(l => `  ${l}`).join('\n')}`);
    }

    // 2. biome check
    try {
        execSync('pnpm check', {
            cwd: projectDir,
            timeout: 30000,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
    } catch (e) {
        const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
        const lines = out.trim().split('\n').filter(l => !l.includes('WARN') && l.trim());
        errors.push(`[pre-commit-quality] ❌ Biome 오류:\n${lines.slice(0, 15).map(l => `  ${l}`).join('\n')}`);
    }

    if (errors.length === 0) return process.exit(0);

    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: [
                '[pre-commit-quality] 품질 검사 실패 — 커밋 차단',
                '',
                ...errors,
                '',
                '수정 후 다시 커밋하세요.',
            ].join('\n'),
        },
    }) + '\n');
    process.exit(0);
}

main().catch(() => process.exit(0));
