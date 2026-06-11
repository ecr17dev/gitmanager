import { describe, it, expect } from 'vitest';
import { classifyError, ERROR_RULES, buildCommandWithBranch } from '../errorDictionary.js';

describe('errorDictionary', () => {
  it('detects non-fast-forward push errors', () => {
    const stderr = 'error: failed to push some refs to origin\nUpdates were rejected because the remote contains work';
    const result = classifyError(stderr);
    expect(result.matched).toBe(true);
    expect(result.rule.code).toBe('PUSH_NON_FAST_FORWARD');
    expect(result.rule.action.kind).toBe('pull-rebase');
  });

  it('detects authentication failures', () => {
    const stderr = 'fatal: Authentication failed for https://github.com/foo/bar.git';
    const result = classifyError(stderr);
    expect(result.matched).toBe(true);
    expect(result.rule.code).toBe('AUTH_FAILED');
  });

  it('detects permission denied errors', () => {
    const stderr = 'Permission to user/repo.git denied to other-user';
    const result = classifyError(stderr);
    expect(result.matched).toBe(true);
    expect(result.rule.code).toBe('AUTH_FAILED');
  });

  it('detects merge conflicts', () => {
    const stderr = 'CONFLICT (content): Merge conflict in foo.js\nAutomatic merge failed; fix conflicts and then commit';
    const result = classifyError(stderr);
    expect(result.matched).toBe(true);
    expect(result.rule.code).toBe('MERGE_CONFLICT');
  });

  it('detects nothing-to-commit', () => {
    const result = classifyError('On branch main\nnothing to commit, working tree clean');
    expect(result.matched).toBe(true);
    expect(result.rule.code).toBe('NOTHING_TO_COMMIT');
  });

  it('detects detached HEAD', () => {
    const result = classifyError("Note: switching to 'abc1234'.\nYou are in 'detached HEAD' state.");
    expect(result.matched).toBe(true);
    expect(result.rule.code).toBe('DETACHED_HEAD');
  });

  it('detects lock file errors', () => {
    const result = classifyError("fatal: Unable to create '.git/index.lock': File exists.");
    expect(result.matched).toBe(true);
    expect(result.rule.code).toBe('LOCK_FILE');
  });

  it('returns unmatched for unknown errors', () => {
    const result = classifyError('Some weird error that nobody has seen before');
    expect(result.matched).toBe(false);
  });

  it('combines stderr and stdout for matching', () => {
    const result = classifyError('', 'fatal: Authentication failed for');
    expect(result.matched).toBe(true);
    expect(result.rule.code).toBe('AUTH_FAILED');
  });

  it('handles empty input gracefully', () => {
    const result = classifyError('', '');
    expect(result.matched).toBe(false);
  });

  it('has unique codes for each rule', () => {
    const codes = ERROR_RULES.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('all rules have required fields', () => {
    for (const rule of ERROR_RULES) {
      expect(rule.code).toBeTruthy();
      expect(rule.title).toBeTruthy();
      expect(rule.hint).toBeTruthy();
      expect(Array.isArray(rule.patterns) && rule.patterns.length > 0).toBe(true);
      expect(rule.action).toBeTruthy();
      expect(['info', 'warning', 'error']).toContain(rule.severity);
    }
  });
});

describe('buildCommandWithBranch', () => {
  it('substitutes {branch} placeholder', () => {
    expect(buildCommandWithBranch('git pull origin {branch}', 'develop'))
      .toBe('git pull origin develop');
  });

  it('falls back to main when branch is undefined', () => {
    expect(buildCommandWithBranch('git pull origin {branch}', undefined))
      .toBe('git pull origin main');
  });

  it('substitutes {timestamp} with current time', () => {
    const result = buildCommandWithBranch('git checkout -b backup-{timestamp}', null);
    expect(result).toMatch(/^git checkout -b backup-\d+$/);
  });

  it('returns null/undefined input unchanged', () => {
    expect(buildCommandWithBranch(null, 'main')).toBe(null);
    expect(buildCommandWithBranch(undefined, 'main')).toBe(undefined);
  });

  it('leaves commands without placeholders unchanged', () => {
    expect(buildCommandWithBranch('git status', 'main')).toBe('git status');
  });
});
