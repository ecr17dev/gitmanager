export const ERROR_RULES = [
  {
    code: 'PUSH_NON_FAST_FORWARD',
    title: 'El remoto contiene commits que no tienes localmente',
    hint:
      'GitHub rechazó el push porque la rama remota está más adelantada. Lo correcto es integrar los cambios remotos antes de volver a empujar.',
    patterns: [
      /failed to push some refs to/i,
      /Updates were rejected because the remote contains work/i,
      /non-fast-forward/i
    ],
    action: {
      label: 'Hacer pull --rebase y reintentar',
      kind: 'pull-rebase',
      command: 'git pull --rebase origin {branch}'
    },
    severity: 'warning'
  },
  {
    code: 'AUTH_FAILED',
    title: 'Conflicto de identidad detectado',
    hint:
      'La cuenta asignada a este repositorio no tiene permisos de escritura sobre el remoto, o el token ha expirado.',
    patterns: [
      /fatal: Authentication failed for/i,
      /Permission to .* denied to /i,
      /invalid username or password/i,
      /bad credentials/i,
      /could not read Username for .* terminal prompts disabled/i
    ],
    action: {
      label: 'Reasignar cuenta al repositorio',
      kind: 'reassign-account'
    },
    severity: 'error'
  },
  {
    code: 'MERGE_CONFLICT',
    title: 'Conflicto de fusión',
    hint:
      'Hay archivos con marcadores de conflicto. Resuélvelos manualmente y luego confirma con un commit.',
    patterns: [
      /CONFLICT \(.*?\):/i,
      /Automatic merge failed/i,
      /fix conflicts and then commit the result/i
    ],
    action: {
      label: 'Abrir archivos en conflicto',
      kind: 'list-conflicted'
    },
    severity: 'error'
  },
  {
    code: 'NOTHING_TO_COMMIT',
    title: 'Nada que confirmar',
    hint: 'No hay cambios staged para commit.',
    patterns: [/nothing to commit/i, /no changes added to commit/i],
    action: { label: 'Refrescar estado', kind: 'refresh' },
    severity: 'info'
  },
  {
    code: 'DETACHED_HEAD',
    title: 'HEAD desasociado',
    hint:
      'Estás en un commit antiguo sin una rama apuntando ahí. Crea una rama o regresa a una existente para no perder trabajo.',
    patterns: [/You are in 'detached HEAD' state/i, /HEAD detached/i],
    action: {
      label: 'Crear rama de respaldo desde aquí',
      kind: 'run-command',
      command: 'git checkout -b backup-detached-{timestamp}'
    },
    severity: 'warning'
  },
  {
    code: 'LOCK_FILE',
    title: 'Operación de Git bloqueada',
    hint: 'Existe un archivo .git/index.lock. Si no hay otro proceso de Git activo, elimínalo con seguridad.',
    patterns: [/Unable to create '.*?\.git\/index\.lock'/i, /fatal: Unable to create/i],
    action: {
      label: 'Eliminar .git/index.lock',
      kind: 'run-command',
      command: 'rm -f .git/index.lock'
    },
    severity: 'warning'
  },
  {
    code: 'REBASE_IN_PROGRESS',
    title: 'Rebase en curso',
    hint:
      'Hay un rebase interrumpido. Resuélvelo (continuar/abortar) antes de seguir operando.',
    patterns: [/(?:cannot rebase|interactive rebase already started)/i, /You have unmerged paths/i],
    action: {
      label: 'Continuar rebase (git rebase --continue)',
      kind: 'run-command',
      command: 'git rebase --continue'
    },
    severity: 'warning'
  },
  {
    code: 'NO_REMOTE',
    title: 'No hay remoto configurado',
    hint: 'Este repositorio no tiene un remoto. Añade uno para hacer push o pull.',
    patterns: [/No configured push destination/i, /fatal: 'origin' does not appear to be a git repository/i],
    action: { label: 'Configurar remoto', kind: 'configure-remote' },
    severity: 'warning'
  }
];

export function classifyError(stderr = '', stdout = '') {
  const text = `${stderr || ''}\n${stdout || ''}`;
  for (const rule of ERROR_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        return {
          matched: true,
          rule,
          sourceText: text
        };
      }
    }
  }
  return { matched: false, sourceText: text };
}

export function buildCommandWithBranch(command, branch) {
  if (!command) return command;
  const ts = Date.now();
  return command
    .replaceAll('{branch}', branch || 'main')
    .replaceAll('{timestamp}', String(ts));
}
