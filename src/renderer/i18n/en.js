export default {
  app: {
    name: 'GitNexus',
    tagline: 'Multi-account Git client with AI'
  },
  common: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    add: 'Add',
    remove: 'Remove',
    refresh: 'Refresh',
    optional: 'optional',
    required: 'required',
    yes: 'Yes',
    no: 'No',
    loading: 'Loading…',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    info: 'Info',
    copy: 'Copy',
    open: 'Open'
  },
  header: {
    noRepo: 'No active repository'
  },
  accounts: {
    title: 'Accounts',
    empty: 'No accounts. Add a GitHub PAT to get started.',
    add: '+ Add',
    close: 'Close',
    fields: {
      profileName: 'Profile name (Work, Personal…)',
      username: 'GitHub username',
      email: 'email@github.com',
      token: 'ghp_… or github_pat_…',
      sshKey: 'Path to SSH private key'
    },
    errors: {
      required: 'Required',
      usernameInvalid: 'Invalid GitHub username',
      emailInvalid: 'Invalid email',
      tokenRequired: 'Token is required for HTTPS',
      sshKeyRequired: 'SSH key path is required',
      sshKeyMissing: 'SSH key file does not exist',
      authInvalid: 'Invalid authentication method'
    },
    submit: 'Save account',
    submitBusy: 'Saving…',
    addSuccess: 'Account "{name}" added.',
    removeConfirm:
      'Delete account "{name}"?\n\nRepositories using it will be left without an assigned account (files are not deleted).',
    removeSuccess: 'Account "{name}" removed.',
    auth: {
      method: 'Authentication method',
      https: 'HTTPS (Personal Access Token)',
      ssh: 'SSH (private key file)',
      tokenInfo: 'Token is encrypted with {strong}safeStorage{/strong} (Keychain/DPAPI) and never leaves the Renderer in plain text.'
    }
  },
  repositories: {
    title: 'Repositories',
    empty: 'No repositories yet.',
    add: '+ Add',
    close: 'Close',
    fields: {
      name: 'Display name',
      localPath: '/path/to/repo',
      account: '— No account assigned —'
    },
    submit: 'Add',
    submitBusy: 'Saving…',
    addSuccess: 'Repository "{name}" added.',
    removeConfirm: 'Remove "{name}" from GitNexus?\n\n(The repository files are NOT deleted from disk.)',
    removeSuccess: 'Repository removed from list.',
    assignSuccess: 'Account reassigned.',
    noAccount: 'no account',
    mustHaveGit: 'The repository must contain a valid {code}.git{/code} directory.',
    notInList: 'Select an account from the list to assign.'
  },
  graph: {
    title: 'Timeline',
    select: 'Select a repository in the left column',
    noCommits: 'No commits yet',
    loading: 'loading…'
  },
  staging: {
    unstaged: 'Unstaged',
    staged: 'Staged',
    stageAll: '+ stage all',
    unstageAll: '− unstage all',
    empty: 'No changes.',
    emptyStaged: 'Nothing staged.',
    selectRepo: 'Select a repository to see the diff',
    noAccountHint:
      '⚠ This repository has no account assigned. You will not be able to commit/push.',
    selectRepoHint: 'Select a repository to start.',
    noStagedWarning: 'No staged changes. Add files before generating a commit.',
    aiTitle: 'Generate with AI',
    aiBusy: 'Generating…',
    commit: 'Commit',
    push: 'Push',
    pull: 'Pull --rebase',
    commitPlaceholder: 'feat: commit title',
    bodyPlaceholder: 'Optional body (supports multiple lines)…',
    success: {
      ai: 'AI message generated. Review and confirm.',
      commit: 'Commit completed.',
      push: 'Push completed.',
      pull: 'Pull --rebase completed.'
    },
    error: {
      noAccount: 'This repository has no account assigned. Configure one before committing.',
      noAccountShort: 'Account not assigned.'
    }
  },
  diff: {
    title: 'Changes',
    files: '{count} files',
    staged: 'Staged',
    working: 'Working'
  },
  chat: {
    title: 'AI Copilot',
    subtitle: 'Diagnostics and contextual help',
    empty: 'Ask a question about your repository or request help with an error.',
    placeholder: 'Ask the copilot…',
    send: 'Send',
    thinking: 'Thinking…',
    roleUser: 'You',
    roleAssistant: 'AI',
    roleSystem: 'System',
    systemDetected:
      '⚠ I detected a problem: **{title}**.\n{hint}\n\nI can generate a step-by-step recovery plan. Ask me anything you need.'
  },
  errorWizard: {
    severityError: 'Error',
    severityWarning: 'Warning',
    severityInfo: 'Info',
    severityMuted: 'Notice',
    levelLocal: 'Local',
    levelAI: 'AI',
    levelManual: 'Manual',
    seeStderr: 'See error output (stderr)',
    actions: {
      copy: 'Command copied to clipboard.',
      copyHint: 'Command copied to clipboard. Run it in the repository terminal for maximum safety.',
      steps: 'Steps available in the AI Copilot panel. Execute each one carefully.',
      openFiles: 'Open the files listed as "conflicted" in your editor to resolve them manually.',
      configureRemote: 'Configure the remote from the terminal: git remote add origin <url>',
      notImplemented: 'Action not automatically implemented.',
      reassign: 'Open the left column and reassign the account to the repository.'
    }
  },
  settings: {
    language: 'Language',
    languages: {
      es: 'Español',
      en: 'English'
    }
  },
  errors: {
    accountNotFound: 'Account {id} not found.',
    repoNotFound: 'Repository not found.',
    noAccount: 'No account assigned to this repository.',
    noRepo: 'No active repository',
    repoPathRequired: 'Repository path is required.',
    accountIdRequired: 'Account ID is required.'
  },
  shortcuts: {
    addRepo: 'Add repository',
    commit: 'Commit',
    commitHint: 'Cmd/Ctrl + Enter',
    generateAI: 'Generate with AI'
  }
};
