import simpleGit from 'simple-git';
import {
  buildAuthenticatedUrl,
  decryptToken,
  sanitizeRemoteForLog,
  isSshRemote,
  buildSshCommand
} from './credentials.js';
import {
  getAccountById,
  getAccountToken,
  setDiffCache,
  getDiffCache
} from './database.js';
import { createLogger } from './logger.js';

const log = createLogger('git');

const LOCK_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb']);
const BINARY_EXT = /\.(png|jpg|jpeg|gif|webp|ico|svg|woff2?|ttf|eot|mp[34]|mov|avi|pdf|zip|tar|gz|7z|rar|exe|dll|so|dylib|class|jar|pyc|o|obj|bin|wasm)$/i;
const SKIP_DIRS = ['node_modules/', '.git/', 'dist/', 'out/', 'release/', '.next/', '.nuxt/', 'coverage/'];

const gitCache = new Map();

function makeGit(repoPath, sshCommand = null) {
  const cacheKey = `${repoPath}::${sshCommand || ''}`;
  let instance = gitCache.get(cacheKey);
  if (!instance) {
    const env = { ...process.env };
    if (sshCommand) {
      env.GIT_SSH_COMMAND = sshCommand;
    }
    instance = simpleGit({
      baseDir: repoPath,
      binary: 'git',
      maxConcurrentProcesses: 4,
      trimmed: true,
      env
    });
    gitCache.set(cacheKey, instance);
  }
  return instance;
}

export function clearGitCache(repoPath) {
  if (repoPath) {
    for (const key of gitCache.keys()) {
      if (key.startsWith(`${repoPath}::`)) gitCache.delete(key);
    }
  } else {
    gitCache.clear();
  }
}

async function applyLocalIdentity(git, account) {
  await git.addConfig('user.name', account.username, false, 'local');
  await git.addConfig('user.email', account.email, false, 'local');
}

function getAuthStrategy(account) {
  if (account.authMethod === 'ssh' && account.sshKeyPath) {
    return { kind: 'ssh', sshCommand: buildSshCommand(account.sshKeyPath) };
  }
  return { kind: 'https' };
}

async function applyAuthenticatedRemote(git, accountId) {
  const account = getAccountById(accountId);
  if (!account) {
    throw new Error(`Cuenta ${accountId} no encontrada.`);
  }
  const strategy = getAuthStrategy(account);

  if (strategy.kind === 'ssh') {
    log.debug('using SSH auth', { account: account.profileName });
    return { account, strategy };
  }

  const tokenBuffer = getAccountToken(accountId);
  if (!tokenBuffer) {
    throw new Error(`No hay token almacenado para la cuenta ${account.profileName}.`);
  }
  const token = decryptToken(tokenBuffer);
  const remotes = await git.getRemotes(true);
  for (const remote of remotes) {
    const sourceUrl = remote.refs?.fetch || remote.refs?.push;
    if (!sourceUrl) continue;
    if (isSshRemote(sourceUrl)) {
      log.debug('preserving SSH remote (no token injection)', { remote: remote.name });
      continue;
    }
    const authUrl = buildAuthenticatedUrl(sourceUrl, token);
    try {
      await git.remote(['set-url', remote.name, authUrl]);
      log.debug('remote updated', { remote: remote.name, url: sanitizeRemoteForLog(authUrl) });
    } catch (err) {
      log.warn('cannot update remote', { remote: remote.name, err: err.message });
    }
  }
  return { account, strategy, token };
}

function makeGitForAccount(repoPath, account) {
  const strategy = account ? getAuthStrategy(account) : { kind: 'https' };
  return makeGit(repoPath, strategy.kind === 'ssh' ? strategy.sshCommand : null);
}

export function filterDiffForAI(rawDiff) {
  if (!rawDiff) return '';
  const blocks = rawDiff.split(/^diff --git /m);
  const kept = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (i === 0 && block.trim() === '') continue;
    const header = block.split('\n', 1)[0] || '';
    const filePath = header.replace(/^a\//, '').split(' b/')[0];
    if (LOCK_FILES.has(filePath)) continue;
    if (BINARY_EXT.test(filePath)) continue;
    if (SKIP_DIRS.some((dir) => filePath.startsWith(dir))) continue;
    kept.push('diff --git ' + block);
  }
  let result = kept.join('\n');
  if (result.length > 20000) {
    result = result.slice(0, 20000) + '\n\n[... diff truncado para economizar tokens ...]';
  }
  return result;
}

function statusSummary(s) {
  return {
    current: s.current,
    tracking: s.tracking,
    isClean: typeof s.isClean === 'function' ? s.isClean() : !!s.isClean,
    staged: s.staged || [],
    modified: s.modified || [],
    created: s.created || [],
    deleted: s.deleted || [],
    renamed: s.renamed || [],
    untracked: s.not_added || [],
    conflicted: s.conflicted || [],
    ahead: s.ahead || 0,
    behind: s.behind || 0,
    detached: !!s.detached
  };
}

export async function getStatus(repoPath) {
  const git = makeGit(repoPath);
  const status = await git.status();
  return statusSummary(status);
}

export async function getDiff(repoPath, { staged = true, file = null, useCache = true } = {}) {
  if (useCache) {
    const cached = getDiffCache(repoPath, staged);
    if (cached) {
      log.debug('diff cache hit', { repoPath, staged });
      return cached.content;
    }
  }
  const git = makeGit(repoPath);
  const args = [];
  if (staged) args.push('--cached');
  if (file) args.push('--', file);
  const raw = (await git.diff(args)) || '';
  if (useCache && raw) {
    setDiffCache(repoPath, staged, raw);
  }
  return raw;
}

export async function getLog(repoPath, { depth = 50 } = {}) {
  const git = makeGit(repoPath);
  const log = await git.log({ maxCount: depth, format: 'HASH%x00AUTHOR%x00EMAIL%x00ISO%x00SUBJECT%x00BODY%x00END' });
  return log.all.map((entry) => {
    const parts = String(entry.hash || '').split('\u0000');
    return {
      hash: parts[0] || entry.hash || '',
      author: parts[1] || '',
      email: parts[2] || '',
      date: parts[3] || '',
      subject: parts[4] || entry.message || '',
      body: parts[5] || ''
    };
  });
}

export async function stageFiles(repoPath, files) {
  const git = makeGit(repoPath);
  if (!files || files.length === 0) {
    await git.add(['--all']);
  } else {
    await git.add(files);
  }
  return { ok: true };
}

export async function unstageFiles(repoPath, files) {
  const git = makeGit(repoPath);
  if (!files || files.length === 0) {
    await git.reset(['HEAD']);
  } else {
    await git.reset(['HEAD', '--', ...files]);
  }
  return { ok: true };
}

export async function commit(repoPath, { message, accountId }) {
  const account = getAccountById(accountId);
  if (!account) throw new Error('Cuenta inválida para commit.');
  const git = makeGitForAccount(repoPath, account);
  await applyLocalIdentity(git, account);
  const result = await git.commit(message);
  return { ok: true, commit: result.commit, summary: result.summary };
}

export async function push(repoPath, { accountId, setUpstream = true } = {}) {
  const account = getAccountById(accountId);
  if (!account) throw new Error('Cuenta inválida para push.');
  const git = makeGitForAccount(repoPath, account);
  await applyAuthenticatedRemote(git, accountId);
  const status = await git.status();
  const branch = status.current;
  if (!branch) {
    throw new Error('No hay rama actual para hacer push. ¿Estás en detached HEAD?');
  }
  const opts = setUpstream ? { '--set-upstream': null } : {};
  const result = await git.push('origin', branch, opts);
  return { ok: true, branch, pushed: result.pushed || [] };
}

export async function pullRebase(repoPath, { accountId } = {}) {
  const account = getAccountById(accountId);
  if (!account) throw new Error('Cuenta inválida para pull.');
  const git = makeGitForAccount(repoPath, account);
  await applyAuthenticatedRemote(git, accountId);
  const status = await git.status();
  const branch = status.current;
  if (!branch) {
    throw new Error('No se puede hacer pull: no hay rama actual (¿detached HEAD?).');
  }
  const result = await git.pull('origin', branch, { '--rebase': null });
  return { ok: true, branch, result };
}

export async function fetch(repoPath, { accountId } = {}) {
  const account = accountId ? getAccountById(accountId) : null;
  const git = makeGitForAccount(repoPath, account);
  if (account) await applyAuthenticatedRemote(git, accountId);
  return await git.fetch('origin');
}

export async function getCurrentBranch(repoPath) {
  const git = makeGit(repoPath);
  const status = await git.status();
  return status.current || null;
}

export async function listBranches(repoPath) {
  const git = makeGit(repoPath);
  const branches = await git.branchLocal();
  return { current: branches.current, all: branches.all, detached: branches.detached };
}

export async function validateRepository(repoPath) {
  const git = makeGit(repoPath);
  try {
    await git.revparse(['--git-dir']);
    return { valid: true };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

export async function getIdentity(repoPath, { accountId }) {
  const account = getAccountById(accountId);
  if (!account) return null;
  return { username: account.username, email: account.email, profileName: account.profileName };
}
