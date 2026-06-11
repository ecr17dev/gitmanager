# GitNexus Desktop

> Cliente de escritorio nativo para Git, multi-cuenta, inteligente y seguro.

GitNexus es una aplicación construida con **Electron + Vue 3** que resuelve los problemas clásicos del día a día de cualquier desarrollador que gestiona varios perfiles de GitHub (Trabajo, Personal, Freelance):

- ✅ **Identidad aislada por repositorio**: configuración local (`user.name` / `user.email`) inyectada al vuelo, sin tocar tu `~/.gitconfig` global.
- ✅ **Tokens cifrados con el sistema operativo**: `safeStorage` usa Keychain en macOS y DPAPI en Windows.
- ✅ **Mensajes de commit con IA**: `gpt-4o-mini` analiza tu `git diff` y propone commits en formato *Conventional Commits*.
- ✅ **Recuperación de errores guiada**: un *middleware* de dos capas (regex local + GPT-4o) convierte los mensajes crípticos de Git en acciones de un solo clic.

## Stack

| Capa | Tecnología |
|------|------------|
| Runtime | Electron 33 |
| UI | Vue 3 (Composition API + `<script setup>`) |
| Build | electron-vite |
| Estado | Pinia |
| Estilos | Tailwind CSS 3 |
| DB local | better-sqlite3 (WAL, FK, schema_version) |
| Git | simple-git (envuelve la CLI nativa) |
| Auth | HTTPS (token) o SSH (clave privada) vía GIT_SSH_COMMAND |
| Grafo | @gitgraph/js |
| Diff | Monaco Editor (lazy-loaded) |
| IA | OpenAI Node SDK (gpt-4o-mini / gpt-4o) |
| i18n | vue-i18n (ES / EN) |
| Validación | Zod (IA) + validación main-process |
| Tests | Vitest |
| Empaquetado | electron-builder |

## Requisitos

- **Node.js 20+** (probado en 24.x)
- **npm 10+**
- **Git** instalado y disponible en `PATH`
- **macOS 12+** o **Windows 10+** (Linux soportado, sin probar exhaustivamente)

## Instalación

```bash
# 1. Clonar e instalar dependencias
git clone <url> gitnexus
cd gitnexus
npm install

# 2. Configurar clave de OpenAI (opcional para empezar, obligatorio para usar IA)
cp .env.example .env
# Edita .env y reemplaza OPENAI_API_KEY=sk-...
```

El `postinstall` ejecutará `electron-builder install-app-deps` para recompilar `better-sqlite3` contra la versión de Electron.

## Desarrollo

```bash
npm run dev
```

Esto arranca Vite + Electron con HMR para Renderer y live-reload para Main/Preload. La ventana principal se abrirá automáticamente con DevTools en modo dev.

## Build y empaquetado

```bash
# Build sin empaquetar
npm run build

# Tests
npm test                   # Ejecuta una vez
npm run test:watch         # Modo watch para desarrollo
npm run test:coverage      # Genera reporte de cobertura HTML

# Empaquetar para tu plataforma
npm run package:mac        # Genera .dmg y .zip en release/
npm run package:win        # Genera instalador NSIS .exe
npm run package:linux      # Genera AppImage y .deb

# Empaquetar todo (sólo funciona en macOS con Wine instalado)
npm run package:all
```

## Arquitectura

```
┌──────────────────────┐    window.api.invoke()    ┌──────────────────────┐
│  RENDERER (Vue 3)    │ ────────────────────────► │  PRELOAD (Bridge)    │
│  Pinia stores        │                           │  contextBridge       │
│  Tailwind UI         │ ◄──────────────────────── │  ipcRenderer.invoke  │
└──────────────────────┘     git:error-suggestion  └──────────────────────┘
                                                          │ ipcMain.handle
                                                          ▼
                                          ┌──────────────────────────────┐
                                          │  MAIN (Node.js)              │
                                          │  - database.js (SQLite)      │
                                          │  - credentials.js (encrypt)  │
                                          │  - gitmanager.js (simple-git)│
                                          │  - ai.js (OpenAI)            │
                                          │  - errorDictionary.js        │
                                          │  - errorMiddleware.js        │
                                          └──────────────────────────────┘
```

### Seguridad

- `contextIsolation: true`, `nodeIntegration: false`.
- El Renderer **nunca** ve el token en texto plano: el Main lo descifra dentro del proceso Node.
- Preload expone una API enumerada (`window.api.*`). No hay escape a `ipcRenderer` ni a `require`.
- `.env` y la DB local están en `app.getPath('userData')`, fuera del código fuente.

### Modelo de datos

```sql
accounts (
  id, profile_name, username, email,
  encrypted_token BLOB,  -- safeStorage cipher
  created_at
);

repositories (
  id, name, local_path UNIQUE, account_id FK,
  created_at
);
```

## Uso básico

1. **Crea una cuenta** desde la columna izquierda, en "Cuentas" → "+ Añadir". Puedes elegir entre:
   - **HTTPS**: pega tu Personal Access Token (PAT) de GitHub.
   - **SSH**: indica la ruta a tu clave privada (`~/.ssh/id_ed25519`). El token nunca aparece en la URL.
2. **Añade un repositorio**: ruta local + cuenta asignada. Se valida que exista `.git/`.
3. **Staging**: marca archivos en la columna central → "stage all" o stage individual.
4. **Genera el commit con IA** ✨ → revisa → usa **⌘Z / ⇧⌘Z** para undo/redo → "Commit" → "Push".
5. Si algo falla, el **Copilot** y el **Asistente de Errores** aparecen automáticamente.

## Idioma

Selector `ES` / `EN` en la cabecera. La preferencia se persiste en SQLite (`settings` table) y se sincroniza con `localStorage`.

## Limitaciones conocidas

- El token viaja en la URL HTTPS (`https://oauth2:TOKEN@host/owner/repo.git`) mientras dura la operación de red. Se restaura el remote original tras la operación. Para escenarios de máxima seguridad, considera usar SSH.
- `gpt-4o-mini` y `gpt-4o` requieren crédito en tu cuenta de OpenAI.
- Sin tests automatizados todavía (prioridad para próximas iteraciones).

## Licencia

MIT
