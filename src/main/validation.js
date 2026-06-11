import { existsSync, statSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 80;
const MAX_USERNAME = 100;
const MAX_EMAIL = 254;
const MAX_TOKEN = 500;
const MAX_PATH = 4096;
const MAX_SSH_KEY = 4096;

function trim(v) {
  return typeof v === 'string' ? v.trim() : '';
}

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export function validateAccountInput({ profileName, username, email, token, authMethod, sshKeyPath }) {
  const pn = trim(profileName);
  const un = trim(username);
  const em = trim(email);
  const method = trim(authMethod) || 'https';
  const tk = typeof token === 'string' ? token : '';
  const keyPath = trim(sshKeyPath);

  if (!pn) throw new ValidationError('El nombre del perfil es obligatorio.', 'profileName');
  if (pn.length > MAX_NAME) throw new ValidationError(`Nombre demasiado largo (máx ${MAX_NAME} caracteres).`, 'profileName');

  if (!un) throw new ValidationError('El usuario de GitHub es obligatorio.', 'username');
  if (un.length > MAX_USERNAME) throw new ValidationError(`Usuario demasiado largo (máx ${MAX_USERNAME} caracteres).`, 'username');
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38}[A-Za-z0-9])?$/.test(un)) {
    throw new ValidationError('Usuario de GitHub no válido.', 'username');
  }

  if (!em) throw new ValidationError('El email es obligatorio.', 'email');
  if (em.length > MAX_EMAIL) throw new ValidationError(`Email demasiado largo (máx ${MAX_EMAIL} caracteres).`, 'email');
  if (!EMAIL_RE.test(em)) throw new ValidationError('Email no válido.', 'email');

  if (method !== 'https' && method !== 'ssh') {
    throw new ValidationError('Método de autenticación inválido.', 'authMethod');
  }

  if (method === 'https') {
    if (!tk) throw new ValidationError('El token es obligatorio para HTTPS.', 'token');
    if (tk.length > MAX_TOKEN) throw new ValidationError(`Token demasiado largo (máx ${MAX_TOKEN} caracteres).`, 'token');
  } else {
    if (!keyPath) throw new ValidationError('La ruta de la clave SSH es obligatoria.', 'sshKeyPath');
    if (keyPath.length > MAX_SSH_KEY) throw new ValidationError(`Ruta de clave demasiado larga.`, 'sshKeyPath');
    if (!existsSync(keyPath)) {
      throw new ValidationError(`La clave SSH no existe: ${keyPath}`, 'sshKeyPath');
    }
    try {
      const stat = statSync(keyPath);
      if (!stat.isFile()) {
        throw new ValidationError(`La ruta no es un archivo: ${keyPath}`, 'sshKeyPath');
      }
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new ValidationError(`No se puede leer la clave SSH: ${err.message}`, 'sshKeyPath');
    }
  }

  return {
    profileName: pn,
    username: un,
    email: em,
    token: method === 'https' ? tk : '',
    authMethod: method,
    sshKeyPath: method === 'ssh' ? keyPath : null
  };
}

export function validateRepositoryInput({ name, localPath, accountId }) {
  const n = trim(name);
  const p = trim(localPath);

  if (!n) throw new ValidationError('El nombre del repositorio es obligatorio.', 'name');
  if (n.length > MAX_NAME) throw new ValidationError(`Nombre demasiado largo (máx ${MAX_NAME} caracteres).`, 'name');

  if (!p) throw new ValidationError('La ruta local es obligatoria.', 'localPath');
  if (p.length > MAX_PATH) throw new ValidationError(`Ruta demasiado larga (máx ${MAX_PATH} caracteres).`, 'localPath');
  if (p.includes('\0')) throw new ValidationError('La ruta contiene caracteres no permitidos.', 'localPath');

  if (accountId !== null && accountId !== undefined) {
    if (!Number.isInteger(accountId) || accountId <= 0) {
      throw new ValidationError('ID de cuenta inválido.', 'accountId');
    }
  }

  return {
    name: n,
    localPath: isAbsolute(p) ? p : resolve(p),
    accountId: accountId ?? null
  };
}

export function validateRepoPathExists(localPath) {
  if (!localPath) throw new ValidationError('Ruta no proporcionada.', 'localPath');
  let stat;
  try {
    stat = statSync(localPath);
  } catch {
    throw new ValidationError(`La ruta no existe o no es accesible: ${localPath}`, 'localPath');
  }
  if (!stat.isDirectory()) {
    throw new ValidationError(`La ruta no es un directorio: ${localPath}`, 'localPath');
  }
  const gitDir = resolve(localPath, '.git');
  if (!existsSync(gitDir)) {
    throw new ValidationError(`No es un repositorio Git (falta .git): ${localPath}`, 'localPath');
  }
  return true;
}

export function validateId(id, fieldName = 'id') {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError(`ID inválido: ${fieldName}`, fieldName);
  }
  return id;
}

export function validateCommitMessage(message) {
  if (typeof message !== 'string') {
    throw new ValidationError('El mensaje debe ser un texto.', 'message');
  }
  const trimmed = message.trim();
  if (!trimmed) throw new ValidationError('El mensaje de commit no puede estar vacío.', 'message');
  if (trimmed.length > 50000) {
    throw new ValidationError('El mensaje de commit es demasiado largo.', 'message');
  }
  return trimmed;
}
