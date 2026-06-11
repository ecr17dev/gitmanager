import { ipcMain, dialog, shell } from 'electron';
import { IPC } from '../shared/ipcChannels.js';
import {
  addAccount,
  listAccounts,
  getAccountById,
  deleteAccount,
  addRepository,
  listRepositories,
  updateRepositoryAccount,
  deleteRepository,
  getSetting,
  setSetting,
  clearDiffCache
} from './database.js';
import { encryptToken } from './credentials.js';
import {
  getStatus,
  getDiff,
  getLog,
  stageFiles,
  unstageFiles,
  commit as gitCommit,
  push as gitPush,
  pullRebase,
  fetch as gitFetch,
  getCurrentBranch,
  listBranches,
  filterDiffForAI,
  validateRepository
} from './gitmanager.js';
import { generateCommitMessage, diagnoseGitError } from './ai.js';
import { handleGitError } from './errorMiddleware.js';
import {
  validateAccountInput,
  validateRepositoryInput,
  validateRepoPathExists,
  validateId,
  validateCommitMessage,
  ValidationError
} from './validation.js';
import { setLogLevel } from './logger.js';
import { createLogger } from './logger.js';

const log = createLogger('ipc');

function ok(data) {
  return { success: true, data };
}

function fail(message, code = 'ERR', extra = {}) {
  return { success: false, error: { message, code, ...extra } };
}

function userFail(error) {
  if (error instanceof ValidationError) {
    return fail(error.message, 'VALIDATION', { field: error.field });
  }
  return fail(error.message || String(error), 'UNEXPECTED');
}

async function withGitErrorHandling(ctx, fn) {
  try {
    const data = await fn();
    return ok(data);
  } catch (err) {
    const suggestion = await handleGitError({ err, ...ctx });
    return fail(err.message || String(err), 'GIT_ERROR', { suggestion });
  }
}

function register(name, handler) {
  ipcMain.handle(name, async (_event, payload) => {
    try {
      return await handler(payload || {});
    } catch (err) {
      if (err instanceof ValidationError) {
        log.warn('validation failed', { channel: name, field: err.field });
        return userFail(err);
      }
      log.error('handler failed', { channel: name, err: err.message });
      return userFail(err);
    }
  });
}

export function registerIpcHandlers() {
  register(IPC.ACCOUNT_ADD, async (raw) => {
    const { profileName, username, email, token, authMethod, sshKeyPath } =
      validateAccountInput(raw || {});
    const encrypted = token ? encryptToken(token) : Buffer.alloc(0);
    const result = addAccount({
      profileName,
      username,
      email,
      encryptedToken: encrypted,
      authMethod,
      sshKeyPath
    });
    return { id: result.id };
  });

  register(IPC.ACCOUNT_LIST, async () => {
    return listAccounts();
  });

  register(IPC.ACCOUNT_DELETE, async ({ id } = {}) => {
    const safeId = validateId(id, 'id');
    return deleteAccount(safeId);
  });

  register(IPC.REPO_ADD, async (raw) => {
    const validated = validateRepositoryInput(raw || {});
    validateRepoPathExists(validated.localPath);
    const repoCheck = await validateRepository(validated.localPath);
    if (!repoCheck.valid) {
      throw new ValidationError(repoCheck.reason || 'No es un repositorio Git válido.', 'localPath');
    }
    const result = addRepository(validated);
    return { id: result.id };
  });

  register(IPC.REPO_LIST, async () => {
    return listRepositories();
  });

  register(IPC.REPO_SET_ACCOUNT, async ({ repoId, accountId } = {}) => {
    const rId = validateId(repoId, 'repoId');
    if (accountId !== null && accountId !== undefined) {
      validateId(accountId, 'accountId');
    }
    return updateRepositoryAccount({ repoId: rId, accountId: accountId ?? null });
  });

  register(IPC.REPO_DELETE, async ({ id } = {}) => {
    const safeId = validateId(id, 'id');
    clearDiffCache(null);
    return deleteRepository(safeId);
  });

  register(IPC.GIT_STATUS, async ({ repoPath } = {}) => {
    if (!repoPath) throw new ValidationError('repoPath es obligatorio.', 'repoPath');
    return withGitErrorHandling({ repoPath, command: 'status' }, () => getStatus(repoPath));
  });

  register(IPC.GIT_DIFF, async ({ repoPath, staged = true, file = null, useCache = true } = {}) => {
    if (!repoPath) throw new ValidationError('repoPath es obligatorio.', 'repoPath');
    return withGitErrorHandling(
      { repoPath, command: 'diff' },
      async () => ({ content: await getDiff(repoPath, { staged, file, useCache }) })
    );
  });

  register(IPC.GIT_LOG, async ({ repoPath, depth = 50 } = {}) => {
    if (!repoPath) throw new ValidationError('repoPath es obligatorio.', 'repoPath');
    const safeDepth = Math.min(Math.max(parseInt(depth, 10) || 50, 1), 500);
    return withGitErrorHandling(
      { repoPath, command: 'log' },
      async () => ({ commits: await getLog(repoPath, { depth: safeDepth }) })
    );
  });

  register(IPC.GIT_STAGE, async ({ repoPath, files } = {}) => {
    if (!repoPath) throw new ValidationError('repoPath es obligatorio.', 'repoPath');
    return withGitErrorHandling({ repoPath, command: 'add' }, () => stageFiles(repoPath, files));
  });

  register(IPC.GIT_UNSTAGE, async ({ repoPath, files } = {}) => {
    if (!repoPath) throw new ValidationError('repoPath es obligatorio.', 'repoPath');
    return withGitErrorHandling({ repoPath, command: 'reset' }, () => unstageFiles(repoPath, files));
  });

  register(IPC.GIT_COMMIT, async ({ repoPath, message, accountId } = {}) => {
    if (!repoPath) throw new ValidationError('repoPath es obligatorio.', 'repoPath');
    const safeMessage = validateCommitMessage(message);
    validateId(accountId, 'accountId');
    return withGitErrorHandling(
      { repoPath, accountId, command: 'commit' },
      () => gitCommit(repoPath, { message: safeMessage, accountId })
    );
  });

  register(IPC.GIT_PUSH, async ({ repoPath, accountId } = {}) => {
    if (!repoPath) throw new ValidationError('repoPath es obligatorio.', 'repoPath');
    validateId(accountId, 'accountId');
    return withGitErrorHandling(
      { repoPath, accountId, command: 'push' },
      () => gitPush(repoPath, { accountId })
    );
  });

  register(IPC.GIT_PULL_REBASE, async ({ repoPath, accountId } = {}) => {
    if (!repoPath) throw new ValidationError('repoPath es obligatorio.', 'repoPath');
    validateId(accountId, 'accountId');
    return withGitErrorHandling(
      { repoPath, accountId, command: 'pull' },
      () => pullRebase(repoPath, { accountId })
    );
  });

  register(IPC.GIT_FETCH, async ({ repoPath, accountId } = {}) => {
    if (!repoPath) throw new ValidationError('repoPath es obligatorio.', 'repoPath');
    return withGitErrorHandling(
      { repoPath, accountId, command: 'fetch' },
      () => gitFetch(repoPath, { accountId })
    );
  });

  register(IPC.GIT_CURRENT_BRANCH, async ({ repoPath } = {}) => {
    if (!repoPath) throw new ValidationError('repoPath es obligatorio.', 'repoPath');
    return withGitErrorHandling(
      { repoPath, command: 'rev-parse' },
      async () => ({ branch: await getCurrentBranch(repoPath) })
    );
  });

  register(IPC.GIT_LIST_BRANCHES, async ({ repoPath } = {}) => {
    if (!repoPath) throw new ValidationError('repoPath es obligatorio.', 'repoPath');
    return withGitErrorHandling(
      { repoPath, command: 'branch' },
      async () => await listBranches(repoPath)
    );
  });

  register(IPC.AI_GENERATE_COMMIT, async ({ repoPath, accountId } = {}) => {
    if (!repoPath) throw new ValidationError('repoPath es obligatorio.', 'repoPath');
    const rawDiff = await getDiff(repoPath, { staged: true, useCache: false });
    const cleaned = filterDiffForAI(rawDiff);
    const account = getAccountById(accountId);
    const result = await generateCommitMessage(cleaned);
    return {
      ...result,
      account: account ? { username: account.username, email: account.email } : null
    };
  });

  register(IPC.AI_DIAGNOSE, async ({ stderr, statusText, recentLog } = {}) => {
    const diagnosis = await diagnoseGitError({ stderr, statusText, recentLog });
    return diagnosis;
  });

  register(IPC.SETTINGS_GET, async ({ key } = {}) => {
    if (!key) throw new ValidationError('key es obligatorio.', 'key');
    return getSetting(key);
  });

  register(IPC.SETTINGS_SET, async ({ key, value } = {}) => {
    if (!key) throw new ValidationError('key es obligatorio.', 'key');
    setSetting(key, value);
    if (key === 'logLevel') setLogLevel(value);
    return { ok: true };
  });

  ipcMain.handle(IPC.DIALOG_OPEN_DIR, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Seleccionar carpeta del repositorio',
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle(IPC.DIALOG_OPEN_FILE, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Seleccionar archivo',
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle(IPC.SHELL_OPEN, async (_event, url) => {
    if (typeof url !== 'string') throw new ValidationError('URL inválida.', 'url');
    if (!/^https?:\/\//i.test(url)) {
      throw new ValidationError('Sólo se permiten URLs http(s).', 'url');
    }
    await shell.openExternal(url);
    return { ok: true };
  });
}
