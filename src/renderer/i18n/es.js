export default {
  app: {
    name: 'GitNexus',
    tagline: 'Cliente Git multi-cuenta con IA'
  },
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    close: 'Cerrar',
    add: 'Añadir',
    remove: 'Eliminar',
    refresh: 'Refrescar',
    optional: 'opcional',
    required: 'obligatorio',
    yes: 'Sí',
    no: 'No',
    loading: 'Cargando…',
    error: 'Error',
    success: 'Éxito',
    warning: 'Atención',
    info: 'Info',
    copy: 'Copiar',
    open: 'Abrir'
  },
  header: {
    noRepo: 'Sin repositorio activo'
  },
  accounts: {
    title: 'Cuentas',
    empty: 'No hay cuentas. Añade un PAT de GitHub para empezar.',
    add: '+ Añadir',
    close: 'Cerrar',
    fields: {
      profileName: 'Nombre del perfil (Trabajo, Personal…)',
      username: 'Usuario de GitHub',
      email: 'email@github.com',
      token: 'ghp_… o github_pat_…',
      sshKey: 'Ruta de la clave SSH privada'
    },
    errors: {
      required: 'Obligatorio',
      usernameInvalid: 'Usuario de GitHub no válido',
      emailInvalid: 'Email no válido',
      tokenRequired: 'El token es obligatorio para HTTPS',
      sshKeyRequired: 'La ruta de la clave SSH es obligatoria',
      sshKeyMissing: 'El archivo de clave SSH no existe',
      authInvalid: 'Método de autenticación inválido'
    },
    submit: 'Guardar cuenta',
    submitBusy: 'Guardando…',
    addSuccess: 'Cuenta "{name}" añadida.',
    removeConfirm:
      '¿Eliminar la cuenta "{name}"?\n\nLos repositorios que la usen quedarán sin cuenta asignada (no se borra nada del disco).',
    removeSuccess: 'Cuenta "{name}" eliminada.',
    auth: {
      method: 'Método de autenticación',
      https: 'HTTPS (Personal Access Token)',
      ssh: 'SSH (archivo de clave privada)',
      tokenInfo: 'El token se cifra con {strong}safeStorage{/strong} (Keychain/DPAPI) y nunca sale al Renderer en texto plano.'
    }
  },
  repositories: {
    title: 'Repositorios',
    empty: 'Aún no hay repositorios.',
    add: '+ Añadir',
    close: 'Cerrar',
    fields: {
      name: 'Nombre visible',
      localPath: '/ruta/al/repo',
      account: '— Sin cuenta asignada —'
    },
    submit: 'Añadir',
    submitBusy: 'Guardando…',
    addSuccess: 'Repositorio "{name}" añadido.',
    removeConfirm: '¿Quitar "{name}" de GitNexus?\n\n(Los archivos del repositorio NO se borran del disco)',
    removeSuccess: 'Repositorio eliminado de la lista.',
    assignSuccess: 'Cuenta reasignada.',
    noAccount: 'sin cuenta',
    mustHaveGit: 'El repositorio debe contener un directorio {code}.git{/code} válido.',
    notInList: 'Selecciona una cuenta de la lista para asignar.'
  },
  graph: {
    title: 'Línea de tiempo',
    select: 'Selecciona un repositorio en la columna izquierda',
    noCommits: 'Sin commits todavía',
    loading: 'cargando…'
  },
  staging: {
    unstaged: 'Unstaged',
    staged: 'Staged',
    stageAll: '+ stage all',
    unstageAll: '− unstage all',
    empty: 'Sin cambios.',
    emptyStaged: 'Nada en staging.',
    selectRepo: 'Selecciona un repositorio para ver el diff',
    noAccountHint:
      '⚠ Este repositorio no tiene cuenta asignada. No podrás hacer commit/push.',
    selectRepoHint: 'Selecciona un repositorio para empezar.',
    noStagedWarning: 'No hay cambios en staging. Añade archivos antes de generar el commit.',
    aiTitle: 'Generar con IA',
    aiBusy: 'Generando…',
    commit: 'Commit',
    push: 'Push',
    pull: 'Pull --rebase',
    commitPlaceholder: 'feat: título del commit',
    bodyPlaceholder: 'Cuerpo opcional (soporta múltiples líneas)…',
    success: {
      ai: 'Mensaje generado. Revisa y confirma.',
      commit: 'Commit realizado.',
      push: 'Push completado.',
      pull: 'Pull --rebase completado.'
    },
    error: {
      noAccount: 'Este repositorio no tiene cuenta asignada. Configúrala antes de hacer commit.',
      noAccountShort: 'Cuenta no asignada.'
    }
  },
  diff: {
    title: 'Cambios',
    files: '{count} archivos',
    staged: 'Staged',
    working: 'Working'
  },
  chat: {
    title: 'Copilot IA',
    subtitle: 'Diagnóstico y asistencia contextual',
    empty: 'Haz una pregunta sobre tu repositorio o pide ayuda con un error.',
    placeholder: 'Pregúntale al copilot…',
    send: 'Enviar',
    thinking: 'Pensando…',
    roleUser: 'Tú',
    roleAssistant: 'IA',
    roleSystem: 'Sistema',
    systemDetected:
      '⚠ Detecté un problema: **{title}**.\n{hint}\n\nPuedo generar un plan de recuperación paso a paso. Pregúntame lo que necesites.'
  },
  errorWizard: {
    severityError: 'Error',
    severityWarning: 'Atención',
    severityInfo: 'Info',
    severityMuted: 'Aviso',
    levelLocal: 'Local',
    levelAI: 'IA',
    levelManual: 'Manual',
    seeStderr: 'Ver salida de error (stderr)',
    actions: {
      copy: 'Comando copiado al portapapeles.',
      copyHint: 'Comando copiado al portapapeles. Ejecútalo en la terminal del repositorio para máxima seguridad.',
      steps: 'Pasos disponibles en el panel de Copilot IA. Ejecuta cada uno con cuidado.',
      openFiles: 'Abre los archivos listados como "conflicted" en tu editor para resolverlos manualmente.',
      configureRemote: 'Configura el remoto desde la terminal: git remote add origin <url>',
      notImplemented: 'Acción no implementada automáticamente.',
      reassign: 'Abre la columna izquierda y reasigna la cuenta al repositorio.'
    }
  },
  settings: {
    language: 'Idioma',
    languages: {
      es: 'Español',
      en: 'English'
    }
  },
  errors: {
    accountNotFound: 'Cuenta {id} no encontrada.',
    repoNotFound: 'Repositorio no encontrado.',
    noAccount: 'No hay cuenta asignada a este repositorio.',
    noRepo: 'No hay repositorio activo',
    repoPathRequired: 'La ruta del repositorio es obligatoria.',
    accountIdRequired: 'Se requiere el ID de la cuenta.'
  },
  shortcuts: {
    addRepo: 'Añadir repositorio',
    commit: 'Commit',
    commitHint: 'Cmd/Ctrl + Enter',
    generateAI: 'Generar con IA'
  }
};
