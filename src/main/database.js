import Database from 'better-sqlite3';
import { app } from 'electron';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createLogger } from './logger.js';

const log = createLogger('database');

const MIGRATIONS = [
  {
    version: 1,
    description: 'Initial schema: accounts and repositories',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_name TEXT NOT NULL,
          username TEXT NOT NULL,
          email TEXT NOT NULL,
          encrypted_token BLOB NOT NULL,
          created_at INTEGER DEFAULT (strftime('%s','now'))
        );

        CREATE TABLE IF NOT EXISTS repositories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          local_path TEXT NOT NULL UNIQUE,
          account_id INTEGER,
          created_at INTEGER DEFAULT (strftime('%s','now')),
          FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_repositories_account ON repositories(account_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username);
      `);
    }
  },
  {
    version: 2,
    description: 'Add SSH support: auth_method column to accounts',
    up: (db) => {
      db.exec(`
        ALTER TABLE accounts ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'https';
        ALTER TABLE accounts ADD COLUMN ssh_key_path TEXT;
      `);
    }
  },
  {
    version: 3,
    description: 'Add diff cache table for offline view',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS diff_cache (
          repo_path TEXT NOT NULL,
          staged INTEGER NOT NULL,
          content TEXT NOT NULL,
          updated_at INTEGER DEFAULT (strftime('%s','now')),
          PRIMARY KEY (repo_path, staged)
        );
      `);
    }
  },
  {
    version: 4,
    description: 'Add app settings (i18n locale, log level, theme)',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER DEFAULT (strftime('%s','now'))
        );
      `);
    }
  }
];

let db = null;

function getDbPath() {
  return join(app.getPath('userData'), 'gitnexus.db');
}

function getCurrentVersion(db) {
  try {
    const row = db.prepare(`SELECT MAX(version) AS v FROM schema_migrations`).get();
    return row?.v || 0;
  } catch {
    return 0;
  }
}

function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at INTEGER DEFAULT (strftime('%s','now'))
    );
  `);
}

function runMigrations(db) {
  ensureMigrationsTable(db);
  const current = getCurrentVersion(db);
  const applied = db.prepare(
    `INSERT INTO schema_migrations (version, description) VALUES (?, ?)`
  );
  const ordered = [...MIGRATIONS].sort((a, b) => a.version - b.version);
  for (const m of ordered) {
    if (m.version > current) {
      log.info(`applying migration v${m.version}: ${m.description}`);
      const tx = db.transaction(() => {
        m.up(db);
        applied.run(m.version, m.description);
      });
      tx();
      log.info(`migration v${m.version} applied`);
    }
  }
}

export function initDatabase() {
  const dbPath = getDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function addAccount({ profileName, username, email, encryptedToken, authMethod = 'https', sshKeyPath = null }) {
  const stmt = db.prepare(`
    INSERT INTO accounts (profile_name, username, email, encrypted_token, auth_method, ssh_key_path)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(profileName, username, email, encryptedToken, authMethod, sshKeyPath);
  return { id: Number(result.lastInsertRowid) };
}

export function listAccounts() {
  return db
    .prepare(
      `SELECT id, profile_name AS profileName, username, email,
              auth_method AS authMethod, ssh_key_path AS sshKeyPath,
              created_at AS createdAt
       FROM accounts ORDER BY id ASC`
    )
    .all();
}

export function getAccountById(id) {
  return db
    .prepare(
      `SELECT id, profile_name AS profileName, username, email,
              auth_method AS authMethod, ssh_key_path AS sshKeyPath,
              created_at AS createdAt
       FROM accounts WHERE id = ?`
    )
    .get(id);
}

export function getAccountToken(id) {
  const row = db
    .prepare(`SELECT encrypted_token AS encryptedToken FROM accounts WHERE id = ?`)
    .get(id);
  return row ? row.encryptedToken : null;
}

export function deleteAccount(id) {
  const info = db.prepare(`DELETE FROM accounts WHERE id = ?`).run(id);
  return { ok: info.changes > 0 };
}

export function addRepository({ name, localPath, accountId }) {
  const stmt = db.prepare(`
    INSERT INTO repositories (name, local_path, account_id)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(name, localPath, accountId ?? null);
  return { id: Number(result.lastInsertRowid) };
}

export function listRepositories() {
  return db
    .prepare(
      `SELECT r.id, r.name, r.local_path AS localPath, r.account_id AS accountId,
              a.username AS accountUsername, a.email AS accountEmail,
              a.profile_name AS accountProfileName,
              a.auth_method AS accountAuthMethod
       FROM repositories r
       LEFT JOIN accounts a ON r.account_id = a.id
       ORDER BY r.id ASC`
    )
    .all();
}

export function updateRepositoryAccount({ repoId, accountId }) {
  const info = db
    .prepare(`UPDATE repositories SET account_id = ? WHERE id = ?`)
    .run(accountId, repoId);
  return { ok: info.changes > 0 };
}

export function deleteRepository(id) {
  const info = db.prepare(`DELETE FROM repositories WHERE id = ?`).run(id);
  return { ok: info.changes > 0 };
}

export function getDiffCache(repoPath, staged) {
  const row = db
    .prepare(
      `SELECT content, updated_at AS updatedAt FROM diff_cache
       WHERE repo_path = ? AND staged = ?`
    )
    .get(repoPath, staged ? 1 : 0);
  return row || null;
}

export function setDiffCache(repoPath, staged, content) {
  db.prepare(
    `INSERT INTO diff_cache (repo_path, staged, content, updated_at)
     VALUES (?, ?, ?, strftime('%s','now'))
     ON CONFLICT(repo_path, staged) DO UPDATE SET
       content = excluded.content,
       updated_at = strftime('%s','now')`
  ).run(repoPath, staged ? 1 : 0, content);
}

export function clearDiffCache(repoPath) {
  if (repoPath) {
    db.prepare(`DELETE FROM diff_cache WHERE repo_path = ?`).run(repoPath);
  } else {
    db.prepare(`DELETE FROM diff_cache`).run();
  }
}

export function getSetting(key) {
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key);
  return row?.value ?? null;
}

export function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, strftime('%s','now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = strftime('%s','now')`
  ).run(key, String(value));
}
