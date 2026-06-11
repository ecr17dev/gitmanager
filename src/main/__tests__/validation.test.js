import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  validateAccountInput,
  validateRepositoryInput,
  validateRepoPathExists,
  validateId,
  validateCommitMessage,
  ValidationError
} from '../validation.js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tempKey;
beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), 'gitnexus-key-'));
  tempKey = join(dir, 'id_ed25519');
  writeFileSync(tempKey, '-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----\n');
});
afterAll(() => {
  if (tempKey) {
    rmSync(join(tempKey, '..'), { recursive: true, force: true });
  }
});

describe('validateAccountInput', () => {
  const valid = {
    profileName: 'Trabajo',
    username: 'johndoe',
    email: 'john@example.com',
    token: 'ghp_abc123'
  };

  it('accepts a valid payload', () => {
    const result = validateAccountInput(valid);
    expect(result.profileName).toBe(valid.profileName);
    expect(result.username).toBe(valid.username);
    expect(result.email).toBe(valid.email);
    expect(result.token).toBe(valid.token);
    expect(result.authMethod).toBe('https');
    expect(result.sshKeyPath).toBe(null);
  });

  it('rejects empty profileName', () => {
    expect(() => validateAccountInput({ ...valid, profileName: '  ' })).toThrow(ValidationError);
  });

  it('rejects profileName longer than 80 chars', () => {
    expect(() => validateAccountInput({ ...valid, profileName: 'x'.repeat(81) })).toThrow(/demasiado largo/);
  });

  it('rejects empty username', () => {
    expect(() => validateAccountInput({ ...valid, username: '' })).toThrow(ValidationError);
  });

  it('rejects username with invalid characters', () => {
    expect(() => validateAccountInput({ ...valid, username: 'invalid user!' })).toThrow();
  });

  it('accepts GitHub-style username with dashes', () => {
    expect(validateAccountInput({ ...valid, username: 'my-user-123' }).username).toBe('my-user-123');
  });

  it('rejects username longer than 40 chars (GitHub max)', () => {
    expect(() => validateAccountInput({ ...valid, username: 'a'.repeat(41) })).toThrow();
  });

  it('accepts 40-char username (GitHub max length)', () => {
    expect(validateAccountInput({ ...valid, username: 'a'.repeat(40) }).username).toHaveLength(40);
  });

  it('rejects invalid email', () => {
    expect(() => validateAccountInput({ ...valid, email: 'not-an-email' })).toThrow(/Email no válido/);
  });

  it('accepts email with subdomains and plus addressing', () => {
    expect(validateAccountInput({ ...valid, email: 'a+b@mail.example.co.uk' }).email)
      .toBe('a+b@mail.example.co.uk');
  });

  it('rejects empty token', () => {
    expect(() => validateAccountInput({ ...valid, token: '' })).toThrow();
  });

  it('rejects token longer than 500 chars', () => {
    expect(() => validateAccountInput({ ...valid, token: 'x'.repeat(501) })).toThrow();
  });

  it('trims whitespace from fields', () => {
    expect(validateAccountInput({ ...valid, profileName: '  Trabajo  ' }).profileName)
      .toBe('Trabajo');
  });

  it('accepts SSH method with valid key', () => {
    const result = validateAccountInput({
      ...valid,
      authMethod: 'ssh',
      sshKeyPath: tempKey,
      token: ''
    });
    expect(result.authMethod).toBe('ssh');
    expect(result.token).toBe('');
    expect(result.sshKeyPath).toBe(tempKey);
  });

  it('rejects SSH method without key path', () => {
    expect(() =>
      validateAccountInput({ ...valid, authMethod: 'ssh', token: '' })
    ).toThrow(/clave SSH/);
  });

  it('rejects SSH with non-existent key', () => {
    expect(() =>
      validateAccountInput({
        ...valid,
        authMethod: 'ssh',
        sshKeyPath: '/this/key/does/not/exist',
        token: ''
      })
    ).toThrow(/no existe/);
  });

  it('rejects invalid auth method', () => {
    expect(() =>
      validateAccountInput({ ...valid, authMethod: 'magic' })
    ).toThrow(/autenticación inválido/);
  });

  it('defaults to https when no auth method specified', () => {
    expect(validateAccountInput(valid).authMethod).toBe('https');
  });
});

describe('validateRepositoryInput', () => {
  const valid = { name: 'Mi Repo', localPath: '/home/user/repo', accountId: 1 };

  it('accepts a valid payload', () => {
    expect(validateRepositoryInput(valid)).toEqual(valid);
  });

  it('rejects empty name', () => {
    expect(() => validateRepositoryInput({ ...valid, name: '' })).toThrow();
  });

  it('rejects empty path', () => {
    expect(() => validateRepositoryInput({ ...valid, localPath: '' })).toThrow();
  });

  it('rejects path with null bytes', () => {
    expect(() => validateRepositoryInput({ ...valid, localPath: '/path/\0/x' })).toThrow(/no permitidos/);
  });

  it('resolves relative paths to absolute', () => {
    const result = validateRepositoryInput({ ...valid, localPath: 'relative/path' });
    expect(result.localPath).toMatch(/^[/\\]/);
  });

  it('accepts null accountId', () => {
    expect(validateRepositoryInput({ ...valid, accountId: null }).accountId).toBe(null);
  });

  it('accepts undefined accountId', () => {
    expect(validateRepositoryInput({ ...valid, accountId: undefined }).accountId).toBe(null);
  });

  it('rejects non-integer accountId', () => {
    expect(() => validateRepositoryInput({ ...valid, accountId: 'one' })).toThrow();
    expect(() => validateRepositoryInput({ ...valid, accountId: 1.5 })).toThrow();
  });

  it('rejects zero or negative accountId', () => {
    expect(() => validateRepositoryInput({ ...valid, accountId: 0 })).toThrow();
    expect(() => validateRepositoryInput({ ...valid, accountId: -1 })).toThrow();
  });
});

describe('validateRepoPathExists', () => {
  let tempDir;
  let tempFile;

  it('accepts an existing directory with .git', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'gitnexus-test-'));
    mkdirSync(join(tempDir, '.git'));
    expect(validateRepoPathExists(tempDir)).toBe(true);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('rejects non-existent path', () => {
    expect(() => validateRepoPathExists('/this/does/not/exist/at/all')).toThrow(/no existe/);
  });

  it('rejects file instead of directory', () => {
    tempFile = join(tmpdir(), `gitnexus-test-${Date.now()}.txt`);
    writeFileSync(tempFile, 'hello');
    expect(() => validateRepoPathExists(tempFile)).toThrow(/no es un directorio/);
    rmSync(tempFile);
  });

  it('rejects directory without .git', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'gitnexus-test-'));
    expect(() => validateRepoPathExists(tempDir)).toThrow(/No es un repositorio Git/);
    rmSync(tempDir, { recursive: true, force: true });
  });
});

describe('validateId', () => {
  it('accepts positive integers', () => {
    expect(validateId(1, 'x')).toBe(1);
    expect(validateId(999, 'x')).toBe(999);
  });

  it('rejects zero, negative, and non-integers', () => {
    expect(() => validateId(0, 'x')).toThrow();
    expect(() => validateId(-1, 'x')).toThrow();
    expect(() => validateId(1.5, 'x')).toThrow();
    expect(() => validateId('1', 'x')).toThrow();
    expect(() => validateId(null, 'x')).toThrow();
  });
});

describe('validateCommitMessage', () => {
  it('accepts a normal message', () => {
    expect(validateCommitMessage('feat: add login')).toBe('feat: add login');
  });

  it('trims whitespace', () => {
    expect(validateCommitMessage('  feat: add  ')).toBe('feat: add');
  });

  it('rejects empty', () => {
    expect(() => validateCommitMessage('')).toThrow();
    expect(() => validateCommitMessage('   ')).toThrow();
  });

  it('rejects non-string', () => {
    expect(() => validateCommitMessage(null)).toThrow();
    expect(() => validateCommitMessage(123)).toThrow();
  });

  it('rejects very long messages', () => {
    expect(() => validateCommitMessage('x'.repeat(50001))).toThrow(/demasiado largo/);
  });
});
