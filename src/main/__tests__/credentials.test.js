import { describe, it, expect } from 'vitest';
import { buildAuthenticatedUrl, sanitizeRemoteForLog } from '../credentials.js';

describe('buildAuthenticatedUrl', () => {
  it('throws on missing URL', () => {
    expect(() => buildAuthenticatedUrl('', 'token')).toThrow();
    expect(() => buildAuthenticatedUrl(null, 'token')).toThrow();
  });

  it('throws on missing token', () => {
    expect(() => buildAuthenticatedUrl('https://github.com/foo/bar.git', '')).toThrow();
    expect(() => buildAuthenticatedUrl('https://github.com/foo/bar.git', null)).toThrow();
  });

  it('injects token into https URL', () => {
    const result = buildAuthenticatedUrl('https://github.com/foo/bar.git', 'ghp_secret');
    expect(result).toBe('https://oauth2:ghp_secret@github.com/foo/bar.git');
  });

  it('injects token into https URL without .git suffix', () => {
    const result = buildAuthenticatedUrl('https://github.com/foo/bar', 'token123');
    expect(result).toBe('https://oauth2:token123@github.com/foo/bar.git');
  });

  it('preserves existing userinfo in URL (replaces it)', () => {
    const result = buildAuthenticatedUrl('https://olduser@github.com/foo/bar.git', 'newtoken');
    expect(result).toBe('https://oauth2:newtoken@github.com/foo/bar.git');
    expect(result).not.toContain('olduser');
  });

  it('handles http (not just https)', () => {
    const result = buildAuthenticatedUrl('http://git.internal/foo/bar.git', 'tok');
    expect(result).toBe('http://oauth2:tok@git.internal/foo/bar.git');
  });

  it('converts ssh-style URL to https with token', () => {
    const result = buildAuthenticatedUrl('git@github.com:foo/bar.git', 'tok');
    expect(result).toBe('https://oauth2:tok@github.com/foo/bar.git');
  });

  it('converts ssh-style URL without .git suffix', () => {
    const result = buildAuthenticatedUrl('git@gitlab.com:user/project', 'tok');
    expect(result).toBe('https://oauth2:tok@gitlab.com/user/project.git');
  });

  it('URL-encodes special characters in token', () => {
    const result = buildAuthenticatedUrl('https://github.com/foo/bar.git', 'tok@with#special');
    expect(result).toContain(encodeURIComponent('tok@with#special'));
  });

  it('returns URL as-is if format is unrecognizable', () => {
    const result = buildAuthenticatedUrl('not-a-real-url', 'tok');
    expect(result).toBe('not-a-real-url');
  });

  it('handles trailing slash variations', () => {
    expect(buildAuthenticatedUrl('https://github.com/foo/bar.git/', 't'))
      .toBe('https://oauth2:t@github.com/foo/bar.git');
  });
});

describe('sanitizeRemoteForLog', () => {
  it('redacts user:password@ in URL', () => {
    expect(sanitizeRemoteForLog('https://oauth2:secret@github.com/foo/bar.git'))
      .toBe('https://***:***@github.com/foo/bar.git');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeRemoteForLog('')).toBe('');
    expect(sanitizeRemoteForLog(null)).toBe('');
  });

  it('leaves clean URLs untouched', () => {
    expect(sanitizeRemoteForLog('https://github.com/foo/bar.git'))
      .toBe('https://github.com/foo/bar.git');
  });
});
