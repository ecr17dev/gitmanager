export const IPC = Object.freeze({
  ACCOUNT_ADD: 'account:add',
  ACCOUNT_LIST: 'account:list',
  ACCOUNT_DELETE: 'account:delete',

  REPO_ADD: 'repo:add',
  REPO_LIST: 'repo:list',
  REPO_SET_ACCOUNT: 'repo:set-account',
  REPO_DELETE: 'repo:delete',

  GIT_STATUS: 'git:status',
  GIT_DIFF: 'git:diff',
  GIT_LOG: 'git:log',
  GIT_STAGE: 'git:stage',
  GIT_UNSTAGE: 'git:unstage',
  GIT_COMMIT: 'git:commit',
  GIT_PUSH: 'git:push',
  GIT_PULL_REBASE: 'git:pull-rebase',
  GIT_FETCH: 'git:fetch',
  GIT_CURRENT_BRANCH: 'git:current-branch',
  GIT_LIST_BRANCHES: 'git:list-branches',

  AI_GENERATE_COMMIT: 'ai:generate-commit',
  AI_DIAGNOSE: 'ai:diagnose',

  DIALOG_OPEN_DIR: 'dialog:open-dir',
  DIALOG_OPEN_FILE: 'dialog:open-file',

  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  SHELL_OPEN: 'shell:open',

  GIT_ERROR_SUGGESTION: 'git:error-suggestion',
  TOAST: 'ui:toast'
});
