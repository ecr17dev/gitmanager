import { safeStorage } from 'electron';
import { existsSync, statSync } from 'node:fs';

export function isEncryptionAvailable() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

export function encryptToken(plainToken) {
  if (!isEncryptionAvailable()) {
    throw new Error(
      'El cifrado de credenciales no está disponible en este sistema (safeStorage).'
    );
  }
  return safeStorage.encryptString(plainToken);
}

export function decryptToken(encryptedBuffer) {
  if (!isEncryptionAvailable()) {
    throw new Error('No se puede descifrar: safeStorage no disponible.');
  }
  return safeStorage.decryptString(encryptedBuffer);
}

export function buildAuthenticatedUrl(remoteUrl, token) {
  if (!remoteUrl) {
    throw new Error('remoteUrl es obligatorio para autenticar.');
  }
  if (!token) {
    throw new Error('Token ausente para autenticación.');
  }
  const cleaned = remoteUrl.trim();
  const sshLike = cleaned.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshLike) {
    const [, host, path] = sshLike;
    return `https://oauth2:${encodeURIComponent(token)}@${host}/${path}.git`;
  }
  const match = cleaned.match(/^(https?:\/\/)(?:[^@/]+@)?([^/]+)\/(.+?)(?:\.git)?\/?$/i);
  if (!match) {
    return cleaned;
  }
  const [, scheme, host, path] = match;
  return `${scheme}oauth2:${encodeURIComponent(token)}@${host}/${path}.git`;
}

export function sanitizeRemoteForLog(remoteUrl) {
  if (!remoteUrl) return '';
  return remoteUrl.replace(/\/\/[^@/]+:[^@/]+@/, '//***:***@');
}

export function isSshRemote(remoteUrl) {
  if (!remoteUrl) return false;
  const v = remoteUrl.trim();
  return v.startsWith('git@') || v.startsWith('ssh://') || /^[\w-]+@[\w.-]+:/.test(v);
}

export function validateSshKeyPath(keyPath) {
  if (!keyPath) return false;
  try {
    const stat = statSync(keyPath);
    if (!stat.isFile()) return false;
    if (!(stat.mode & 0o400)) {
      return { valid: true, warning: 'Los permisos de la clave son demasiado abiertos. Recomendado: 600.' };
    }
    return { valid: true };
  } catch {
    return false;
  }
}

export function buildSshCommand(keyPath) {
  if (!keyPath) return null;
  if (!existsSync(keyPath)) {
    throw new Error(`La clave SSH no existe: ${keyPath}`);
  }
  return `ssh -i ${keyPath} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`;
}
