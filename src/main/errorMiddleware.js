import { BrowserWindow } from 'electron';
import { IPC } from '../shared/ipcChannels.js';
import { classifyError, buildCommandWithBranch } from './errorDictionary.js';
import { diagnoseGitError } from './ai.js';
import { getLog, getStatus } from './gitmanager.js';
import { createLogger } from './logger.js';

const log = createLogger('err');

function getWindow() {
  const wins = BrowserWindow.getAllWindows();
  return wins[0] || null;
}

function emitSuggestion(suggestion) {
  const win = getWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC.GIT_ERROR_SUGGESTION, suggestion);
  }
}

async function collectContextForAI(repoPath) {
  const [logRes, statusRes] = await Promise.allSettled([
    getLog(repoPath, { depth: 3 }),
    getStatus(repoPath)
  ]);
  const recentLog =
    logRes.status === 'fulfilled'
      ? logRes.value
          .map((c) => `${(c.hash || '').slice(0, 7)} ${c.subject}`)
          .join('\n')
      : '';
  const statusText =
    statusRes.status === 'fulfilled'
      ? JSON.stringify(statusRes.value, null, 2)
      : '';
  return { recentLog, statusText };
}

export async function handleGitError({ err, repoPath, accountId, command, args }) {
  const stderr = err?.stderr || err?.message || String(err);
  const stdout = err?.stdout || '';
  const classified = classifyError(stderr, stdout);

  if (classified.matched) {
    const rule = classified.rule;
    const action = { ...rule.action };
    if (action.command) {
      action.command = buildCommandWithBranch(action.command, undefined);
    }
    const suggestion = {
      level: 'local',
      code: rule.code,
      title: rule.title,
      hint: rule.hint,
      severity: rule.severity,
      action,
      stderr: stderr.slice(0, 1500),
      context: { command, args, repoPath }
    };
    emitSuggestion(suggestion);
    return { handled: true, suggestion };
  }

  try {
    const { recentLog, statusText } = await collectContextForAI(repoPath);
    const diagnosis = await diagnoseGitError({
      stderr,
      statusText,
      recentLog
    });
    const suggestion = {
      level: 'ai',
      code: 'AI_DIAGNOSIS',
      title: 'Diagnóstico generado por IA',
      hint: diagnosis.explicacion,
      severity: 'warning',
      action: { kind: 'multi-step', steps: diagnosis.pasos },
      stderr: stderr.slice(0, 1500),
      context: { command, args, repoPath, accountId }
    };
    emitSuggestion(suggestion);
    return { handled: true, suggestion };
  } catch (aiErr) {
    log.error('AI diagnosis failed', { err: aiErr.message });
    const suggestion = {
      level: 'unhandled',
      code: 'UNHANDLED',
      title: 'Error de Git no clasificado',
      hint:
        'No pudimos clasificar este error ni diagnosticarlo automáticamente. Revisa el mensaje y, si persiste, ejecuta la acción manualmente desde la terminal.',
      severity: 'error',
      action: {
        kind: 'copy-command',
        command: `${command} ${(args || []).join(' ')}`.trim()
      },
      stderr: stderr.slice(0, 1500),
      context: { command, args, repoPath, accountId, aiError: aiErr.message }
    };
    emitSuggestion(suggestion);
    return { handled: true, suggestion };
  }
}
