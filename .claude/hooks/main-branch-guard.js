#!/usr/bin/env node
/**
 * main-branch-guard.js
 * PreToolUse Bash — main 브랜치 직접 커밋·푸시 강제 차단
 *
 * main 브랜치에서 아래 명령 감지 시 즉시 차단:
 *   - git commit
 *   - git push (인자 없음 또는 origin main / origin HEAD)
 *
 * 모든 작업은 feature 브랜치에서 진행 후 PR을 통해 main에 머지해야 한다.
 */
const { execSync } = require('child_process');
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

    const isCommit = /\bgit\s+commit\b/.test(cmd);
    const isPushToMain =
        /\bgit\s+push\b/.test(cmd) &&
        (
            // git push (인자 없음 — 현재 브랜치 push)
            /\bgit\s+push\s*$/.test(cmd) ||
            // git push origin (인자 없음)
            /\bgit\s+push\s+origin\s*$/.test(cmd) ||
            // git push origin main
            /\bgit\s+push\s+\S+\s+main\b/.test(cmd) ||
            // git push origin HEAD
            /\bgit\s+push\s+\S+\s+HEAD\b/.test(cmd) ||
            // git push -u origin main
            /\bgit\s+push\s+.*\s+main\b/.test(cmd)
        );

    if (!isCommit && !isPushToMain) return process.exit(0);

    // 현재 브랜치 확인
    let currentBranch = '';
    try {
        const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
        currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
            cwd: projectDir,
            timeout: 5000,
            stdio: ['ignore', 'pipe', 'ignore'],
        }).toString().trim();
    } catch {
        return process.exit(0);
    }

    if (currentBranch !== 'main') return process.exit(0);

    // main 브랜치에서 커밋·푸시 시도 — 차단
    const action = isCommit ? 'commit' : 'push';
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: [
                `[main-branch-guard] ❌ main 브랜치에서 git ${action} 차단`,
                '',
                '모든 작업은 feature 브랜치에서 진행해야 합니다.',
                '',
                '  1. git checkout main && git pull',
                '  2. git checkout -b feature/<작업내용>',
                '  3. 작업 후 커밋 → 원격 push → PR 생성',
                '',
                `현재 브랜치: ${currentBranch}`,
            ].join('\n'),
        },
    }) + '\n');
    process.exit(0);
}

main().catch(() => process.exit(0));
