import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipcChannels.js';

function invoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

const errorListeners = new Set();
ipcRenderer.on(IPC.GIT_ERROR_SUGGESTION, (_event, payload) => {
  for (const cb of errorListeners) {
    try {
      cb(payload);
    } catch (err) {
      console.error('[preload] error listener threw', err);
    }
  }
});

const api = {
  accounts: {
    add: (data) => invoke(IPC.ACCOUNT_ADD, data),
    list: () => invoke(IPC.ACCOUNT_LIST),
    remove: (id) => invoke(IPC.ACCOUNT_DELETE, { id })
  },
  repositories: {
    add: (data) => invoke(IPC.REPO_ADD, data),
    list: () => invoke(IPC.REPO_LIST),
    setAccount: (repoId, accountId) =>
      invoke(IPC.REPO_SET_ACCOUNT, { repoId, accountId }),
    remove: (id) => invoke(IPC.REPO_DELETE, { id })
  },
  git: {
    status: (repoPath) => invoke(IPC.GIT_STATUS, { repoPath }),
    diff: (repoPath, staged = true, file = null) =>
      invoke(IPC.GIT_DIFF, { repoPath, staged, file }),
    log: (repoPath, depth = 50) => invoke(IPC.GIT_LOG, { repoPath, depth }),
    stage: (repoPath, files) => invoke(IPC.GIT_STAGE, { repoPath, files }),
    unstage: (repoPath, files) => invoke(IPC.GIT_UNSTAGE, { repoPath, files }),
    commit: (repoPath, message, accountId) =>
      invoke(IPC.GIT_COMMIT, { repoPath, message, accountId }),
    push: (repoPath, accountId) => invoke(IPC.GIT_PUSH, { repoPath, accountId }),
    pullRebase: (repoPath, accountId) =>
      invoke(IPC.GIT_PULL_REBASE, { repoPath, accountId }),
    fetch: (repoPath, accountId) => invoke(IPC.GIT_FETCH, { repoPath, accountId }),
    currentBranch: (repoPath) => invoke(IPC.GIT_CURRENT_BRANCH, { repoPath }),
    branches: (repoPath) => invoke(IPC.GIT_LIST_BRANCHES, { repoPath })
  },
  ai: {
    generateCommit: (repoPath, accountId) =>
      invoke(IPC.AI_GENERATE_COMMIT, { repoPath, accountId }),
    diagnose: (payload) => invoke(IPC.AI_DIAGNOSE, payload)
  },
  settings: {
    get: (key) => invoke(IPC.SETTINGS_GET, { key }),
    set: (key, value) => invoke(IPC.SETTINGS_SET, { key, value })
  },
  dialog: {
    openDir: () => invoke(IPC.DIALOG_OPEN_DIR),
    openFile: () => invoke(IPC.DIALOG_OPEN_FILE)
  },
  shell: {
    openExternal: (url) => invoke(IPC.SHELL_OPEN, url)
  },
  onGitError: (callback) => {
    if (typeof callback !== 'function') return () => {};
    errorListeners.add(callback);
    return () => errorListeners.delete(callback);
  },
  platform: process.platform
};

contextBridge.exposeInMainWorld('api', api);
