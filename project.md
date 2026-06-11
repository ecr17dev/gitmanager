Aquí tienes el documento de especificación técnica y conceptual completo. Está diseñado en formato Markdown estructurado, limpio y listo para que lo guardes como `README.md` o `ARCHITECTURE.md` en el repositorio de tu proyecto.

---

# Especificación Técnica y Conceptual: GitNexus Desktop

### _El cliente de Git multi-cuenta, inteligente y seguro_

GitNexus es un cliente de escritorio nativo para Git diseñado para desarrolladores que gestionan múltiples identidades de GitHub (Trabajo, Personal, Freelance). Resuelve los conflictos de credenciales a nivel de sistema operativo, automatiza los mensajes de commit mediante Inteligencia Artificial y transforma los errores cripticos de Git en soluciones interactivas de un solo clic.

---

## 1. Stack Tecnológico

La aplicación se construirá utilizando un entorno híbrido optimizado para rendimiento y seguridad:

- **Runtime:** **Electron** (Garantiza compatibilidad multiplataforma en macOS y Windows, con acceso a APIs nativas del sistema operativo).
- **Frontend Framework:** **Vue 3** (Composition API + Script Setup) administrado con **Vite** para compilación ultrarrápida.
- **Gestión de Estado:** **Pinia** (Para mantener la reactividad del repositorio activo, archivos en staging y estado de la IA).
- **Estilos:** **Tailwind CSS** (Para una interfaz utilitaria, limpia y de baja latencia).
- **Base de Datos Local:** **SQLite** (A través de `better-sqlite3` corriendo exclusivamente en el proceso Main de Electron).
- **Interacción con Git:** **`simple-git`** (Librería Node.js ligera que actúa como wrapper sobre la CLI nativa de Git).
- **Modelos de IA:** API de **OpenAI** (Integración nativa con `gpt-4o-mini` para tareas rápidas y `gpt-4o` para recuperación de desastres en Git).

---

## 2. Arquitectura del Sistema e IPC (Inter-Process Communication)

La aplicación sigue estrictamente el principio de seguridad de Electron, separando los privilegios del sistema operativo de la interfaz gráfica.

```
+-------------------------------------------------------------------------+
|                      RENDERER PROCESS (Vue 3 / UI)                      |
|  - Renderiza el grafo de commits.                                       |
|  - Muestra paneles y diálogos de Tailwind.                               |
|  - Captura eventos del usuario y los envía al Preload Script.           |
+-------------------------------------------------------------------------+
                                    |
                                    v [ window.api.invoke() ]
+-------------------------------------------------------------------------+
|                         PRELOAD SCRIPT (Bridge)                         |
|  - Expone un contextBridge seguro.                                      |
|  - Filtra los mensajes IPC para evitar inyección de código maligno.    |
+-------------------------------------------------------------------------+
                                    |
                                    v [ ipcMain.handle() ]
+-------------------------------------------------------------------------+
|                       MAIN PROCESS (Node.js / Core)                     |
|  - SQLite (Base de datos local)     - Electron safeStorage (Cifrado)    |
|  - simple-git (Comandos OS)          - OpenAI API Client                |
+-------------------------------------------------------------------------+

```

### Mecanismo de Aislamiento de Credenciales

Para evitar conflictos con variables de entorno globales (`~/.gitconfig`), GitNexus intercepta cada comando. Antes de ejecutar un `push` o `commit`, el proceso Main lee la cuenta vinculada al repositorio desde SQLite y ejecuta:

```javascript
// Configuración local al vuelo antes de interactuar con el repositorio
await git.addConfig("user.name", account.username, false, "local");
await git.addConfig("user.email", account.email, false, "local");
```

Para los comandos que requieren red (`push`/`pull`), se inyecta dinámicamente el token descifrado en el string de transporte HTTPS de forma transparente para el usuario:
`https://<TOKEN_DESCIFRADO>@github.com/usuario/repositorio.git`

---

## 3. Modelo de Datos (SQLite Schema)

La base de datos local gestiona las relaciones entre las cuentas físicas de GitHub y los directorios del disco local. Los tokens se almacenan cifrados mediante la API `safeStorage` de Electron, la cual utiliza la infraestructura criptográfica del Sistema Operativo (Keychain en macOS, DPAPI en Windows).

### Tabla: `accounts`

Guarda las credenciales de identidad de GitHub. El token nunca se almacena en texto plano.

| Campo             | Tipo    | Restricciones             | Descripción                                            |
| ----------------- | ------- | ------------------------- | ------------------------------------------------------ |
| `id`              | INTEGER | PRIMARY KEY AUTOINCREMENT | Identificador único del perfil.                        |
| `profile_name`    | TEXT    | NOT NULL                  | Nombre personalizado (ej. "Trabajo", "Personal").      |
| `username`        | TEXT    | NOT NULL                  | Nombre de usuario oficial en GitHub.                   |
| `email`           | TEXT    | NOT NULL                  | Correo electrónico asociado a los commits.             |
| `encrypted_token` | BLOB    | NOT NULL                  | Personal Access Token (PAT) cifrado con `safeStorage`. |

### Tabla: `repositories`

Almacena las rutas de los repositorios locales clonados o importados.

| Campo        | Tipo    | Restricciones               | Descripción                                        |
| ------------ | ------- | --------------------------- | -------------------------------------------------- |
| `id`         | INTEGER | PRIMARY KEY AUTOINCREMENT   | Identificador único del repositorio.               |
| `name`       | TEXT    | NOT NULL                    | Nombre visual del proyecto.                        |
| `local_path` | TEXT    | NOT NULL UNIQUE             | Ruta absoluta en el disco duro del usuario.        |
| `account_id` | INTEGER | FOREIGN KEY (`accounts.id`) | Cuenta asignada obligatoria para este repositorio. |

---

## 4. Casos de Uso Principales

```
                  +-----------------------------------+
                  |           Casos de Uso            |
                  +-----------------------------------+
                                    |
        +---------------------------+---------------------------+
        |                           |                           |
        v                           v                           v
[ CU-01: Multi-Cuenta ]     [ CU-02: IA Commits ]      [ CU-03: Git Copilot ]
- Cifrado seguro            - git diff --cached        - Captura de stderr
- Enrutamiento dinámico     - Formato JSON estricto    - Soluciones de 1-Clic

```

- **CU-01: Gestión de Identidades Multi-Cuenta**
- **Flujo:** El usuario añade un token de GitHub $\rightarrow$ El proceso Main lo cifra con `safeStorage` y lo guarda en SQLite $\rightarrow$ Al importar un repositorio, el usuario le asigna un perfil $\rightarrow$ Toda acción posterior en ese repositorio hereda automáticamente la identidad de esa cuenta.

- **CU-02: Generación Automática de Commits Semánticos**
- **Flujo:** El usuario añade archivos a Staging $\rightarrow$ Presiona "Generar con IA" $\rightarrow$ La app extrae el `git diff`, limpia metadatos pesados y lo envía a OpenAI $\rightarrow$ La UI recibe un JSON estructurado con el título y cuerpo del commit para validación final.

- **CU-03: Asistente de Recuperación ante Errores de Git (Git Copilot)**
- **Flujo:** Ocurre un fallo en Git (ej. Conflicto de fusión) $\rightarrow$ La app captura el código de error y el `stderr` $\rightarrow$ OpenAI analiza el contexto y devuelve una solución humana junto con los comandos exactos de reparación $\rightarrow$ La interfaz genera botones interactivos para ejecutar la solución de forma segura.

---

## 5. Diseño de la Interfaz (UI/UX) y Herramientas

La interfaz se estructurará en un layout de tres columnas optimizado para monitores panorámicos, utilizando **Shadcn-Vue** para los componentes base.

```
+-----------------------------------------------------------------------------------+
|  [Perfil Activo]   |   [Grafo de Commits - Línea de tiempo interactiva]  | (IA) Chat |
|                    |   (o) feat: add auth layout                         | Copilot   |
|  PROYECTOS         |   | \                                               |           |
|  - Repo Trabajo    |   (o) | fix: memory leak bug                        | > ¿Qué    |
|  - Repo Personal   |   | /                                               |   quieres |
|                    |   (o) chore: initial commit                         |   hacer?  |
|  ----------------- | --------------------------------------------------- |           |
|  RAMAS             |   [Área de Cambios / Diff]                          | [Botón]   |
|  - main            |   [+] Archivos en Staging                           | Deshacer  |
|  - feature/login   |   [-] index.js  ...diff visual con Monaco...        | último    |
|                    |   [ Input de Commit Generado por IA               ] | commit    |
+-----------------------------------------------------------------------------------+

```

### Herramientas Visuales Clave

1. **Línea de Tiempo y Grafo:** **`@gitgraph/js`** encapsulado en un componente reactivo de Vue 3. Dibujará las ramificaciones, fusiones (_merges_) y confirmaciones con nodos interactivos de colores dinámicos adaptados a Tailwind.
2. **Visualizador de Diff:** **`Monaco Editor`**. Se usará su modo integrado `diffEditor` para permitir al desarrollador inspeccionar exactamente las líneas añadidas (`+`) y eliminadas (`-`) con resaltado de sintaxis nativo antes de realizar cualquier commit.

---

## 6. Motor de Inteligencia Artificial (OpenAI Integration)

### Arquitectura de Prompt para Generación de Commits

Cuando el usuario solicita un commit automático, el proceso Main ejecuta un filtrado del diff (excluyendo archivos de bloqueo como `package-lock.json` o binarios). El string resultante se procesa mediante el siguiente prompt estructurado:

```json
{
  "model": "gpt-4o-mini",
  "temperature": 0.2,
  "messages": [
    {
      "role": "system",
      "content": "Eres un motor automatizado de Git. Tu única tarea es analizar el 'git diff' provisto y generar un mensaje de commit que siga rigurosamente la convención de 'Conventional Commits'. Debes responder exclusivamente con un objeto JSON válido que contenga las llaves 'title' y 'body'."
    },
    {
      "role": "user",
      "content": "Analiza este diff: [CONTENIDO_DEL_GIT_DIFF]"
    }
  ],
  "response_format": { "type": "json_object" }
}
```

La respuesta estructurada es mapeada instantáneamente a las variables reactivas de la UI en Vue 3 para permitir su edición manual antes de proceder con el guardado.

---

## 7. Sistema de Manejo de Errores de Git Robusto

La aplicación implementa un sistema de gestión de errores en dos niveles (Layered Error Middleware) para evitar que el usuario se enfrente a terminales bloqueadas o estados corruptos del repositorio.

```
                     +-----------------------------------+
                     |       Error de Git (stderr)       |
                     +-----------------------------------+
                                       |
                                       v
                     +-----------------------------------+
                     |     ¿Existe en Diccionario?       |
                     +-----------------------------------+
                                   /       \
                        SÍ        /         \ NO
                                 v           v
            +------------------------+   +------------------------+
            |  Capa 1: Regex Local   |   |   Capa 2: OpenAI API   |
            |  Solución instantánea  |   |  Diagnóstico Dinámico  |
            +------------------------+   +------------------------+

```

### Capa 1: Diccionario Local de Expresiones Regulares (Respuestas de Baja Latencia)

El proceso principal analiza el flujo de error estándar (`stderr`) devuelto por `simple-git`. Si el error coincide con un patrón conocido, se intercepta y se envía una acción predefinida al Frontend sin necesidad de consumir tokens de IA:

> **Caso Común 1: Conflicto de Push (Rama desactualizada)**
>
> - **`stderr` detectado:** `^error: failed to push some refs to.*Updates were rejected because the remote contains work.*`
> - **Tratamiento en UI:** Bloquea el botón de Push. Muestra un banner informativo: _"El repositorio remoto contiene cambios que no tienes localmente"_.
> - **Acción Automatizada:** Habilita un botón azul de un solo clic que ejecuta en segundo plano `git pull --rebase origin <rama>`, resolviendo el flujo de manera segura.

> **Caso Común 2: Conflicto de Credenciales (Permiso Denegado)**
>
> - **`stderr` detectado:** `^fatal: Authentication failed for.*|.*Permission to.*denied to.*`
> - **Tratamiento en UI:** Muestra un modal de advertencia: _"Conflicto de identidad detectado. La cuenta de GitHub asignada no tiene permisos de escritura en este repositorio remoto"_.
> - **Acción Automatizada:** Ofrece un selector dinámico para cambiar el repositorio a una de las otras cuentas válidas guardadas en SQLite con un solo clic.

### Capa 2: Diagnóstico Dinámico con IA (Recuperación de Desastres)

Si el error de Git no coincide con ningún patrón del diccionario local (por ejemplo, fallos complejos en un _Rebase_ interactivo interrumpido o estados de _Detached HEAD_), se activa el módulo de diagnóstico avanzado:

1. La aplicación lee el `stderr` del error junto con el estado del árbol de Git (`git status` y `git log -n 3`).
2. Envía los datos a OpenAI con un prompt específico de resolución de problemas:

   > _"El usuario está experimentando este error en Git: [stderr]. El estado actual del repositorio es: [status]. Por favor, explica de forma empática y sencilla qué salió mal y genera un arreglo JSON con los pasos exactos necesarios para restaurar o solucionar el problema de manera segura sin perder el trabajo local."_

3. La IA responde con una estructura limpia:

```json
{
  "explicacion": "Te encuentras en un estado de 'HEAD desasociado' porque revisaste un commit antiguo...",
  "pasos": [
    {
      "label": "Crear una rama temporal de respaldo",
      "command": "git checkout -b backup-rama"
    },
    { "label": "Regresar a la rama principal", "command": "git checkout main" }
  ]
}
```

4. La UI de Vue 3 interpreta este JSON y dibuja un asistente paso a paso, donde el usuario puede ejecutar secuencialmente cada comando haciendo clic en un botón, perdiendo por completo el miedo a dañar su código.

---

¡Entendido! Olvídate del PDF. Aquí tienes toda la especificación técnica, la estructura de carpetas y el código fuente base directamente en **Markdown**, listo para que lo copies y pegues en tus archivos locales.

---

# Especificación Técnica y Código Base: GitNexus Desktop

### _Cliente Git Multi-Cuenta, Inteligente y Seguro_

---

## 1. Estructura del Proyecto

Esta es la organización de archivos recomendada para mantener desacoplados el proceso del sistema operativo (**Main**) y la interfaz de usuario (**Renderer**).

```text
gitnexus-app/
├── package.json
├── src/
│   ├── main/
│   │   ├── main.js             <-- Ciclo de vida de la app y controladores IPC
│   │   ├── database.js         <-- Conexión y queries de SQLite (better-sqlite3)
│   │   └── gitmanager.js       <-- Lógica nativa de Git (simple-git)
│   ├── preload/
│   │   └── preload.js          <-- Puente seguro (contextBridge)
│   └── renderer/
│       ├── index.html
│       ├── main.js             <-- Inicialización de Vue 3
│       ├── App.vue
│       ├── components/         <-- Grafo, Diff y módulo de IA
│       └── store/
│           └── gitStore.js     <-- Estado global (Pinia)

```

---

## 2. Configuración del Entorno: `package.json`

Este archivo define las dependencias del núcleo. `better-sqlite3` se encarga de la base de datos veloz y `simple-git` actúa como el puente hacia la CLI de Git.

```json
{
  "name": "gitnexus-desktop",
  "version": "1.0.0",
  "description": "Cliente Git Multi-Cuenta con IA Integrada",
  "main": "src/main/main.js",
  "scripts": {
    "dev": "vite",
    "electron:dev": "electron ."
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "dotenv": "^16.4.5",
    "openai": "^4.52.0",
    "simple-git": "^3.24.0",
    "vue": "^3.4.27",
    "pinia": "^2.1.7"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.5",
    "electron": "^30.0.6",
    "tailwindcss": "^3.4.4",
    "vite": "^5.2.11"
  }
}
```

---

## 3. Persistencia Local: `src/main/database.js`

Gestiona el almacenamiento relacional de las identidades de GitHub y las rutas de tus repositorios locales.

> **Nota de seguridad:** El token se recibe en un `Buffer` binario porque el proceso principal lo cifrará antes de guardarlo en la columna `encrypted_token`.

```javascript
const Database = require("better-sqlite3");
const path = require("path");
const { app } = require("electron");

// Base de datos alojada en la carpeta de configuración del usuario
const dbPath = path.join(app.getPath("userData"), "gitnexus.db");
const db = new Database(dbPath);

function initDatabase() {
  // Tabla para perfiles/cuentas de GitHub
  db.prepare(
    `
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_name TEXT NOT NULL,
            username TEXT NOT NULL,
            email TEXT NOT NULL,
            encrypted_token BLOB NOT NULL
        )
    `,
  ).run();

  // Tabla para repositorios locales vinculados
  db.prepare(
    `
        CREATE TABLE IF NOT EXISTS repositories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            local_path TEXT NOT NULL UNIQUE,
            account_id INTEGER,
            FOREIGN KEY(account_id) REFERENCES accounts(id)
        )
    `,
  ).run();
}

function saveAccount(profileName, username, email, tokenBuffer) {
  const stmt = db.prepare(`
        INSERT INTO accounts (profile_name, username, email, encrypted_token)
        VALUES (?, ?, ?, ?)
    `);
  return stmt.run(profileName, username, email, tokenBuffer);
}

function getRepositories() {
  return db
    .prepare(
      `
        SELECT r.*, a.username, a.email FROM repositories r
        LEFT JOIN accounts a ON r.account_id = a.id
    `,
    )
    .all();
}

module.exports = { initDatabase, saveAccount, getRepositories };
```

---

## 4. Cerebro de la Aplicación: `src/main/main.js`

Este script corre en el proceso principal de Node.js. Levanta la ventana Chromium de Electron con aislamiento estricto y procesa las peticiones seguras que llegan desde la interfaz visual.

```javascript
const { app, BrowserWindow, ipcMain, safeStorage } = require("electron");
const path = require("path");
const { initDatabase, saveAccount, getRepositories } = require("./database");
const simpleGit = require("simple-git");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true, // Bloquea acceso directo a Node desde el cliente
      nodeIntegration: false,
    },
  });

  // En desarrollo apunta al servidor local de Vite
  mainWindow.loadURL("http://localhost:5173");
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// --- CANALES DE COMUNICACIÓN IPC (INTER-PROCESS COMMUNICATION) ---

// 1. Guardar cuenta encriptando el Token con la API nativa del Sistema Operativo
ipcMain.handle(
  "account:add",
  async (event, { profileName, username, email, token }) => {
    try {
      // Encriptación nativa (Keychain en macOS / DPAPI en Windows)
      const encryptedBuffer = safeStorage.encryptString(token);
      const result = saveAccount(profileName, username, email, encryptedBuffer);
      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
);

// 2. Ejecutar Git inyectando la identidad de forma local y dinámica al vuelo
ipcMain.handle(
  "git:commit-and-push",
  async (event, { repoPath, message, accountEmail, accountUsername }) => {
    try {
      const git = simpleGit(repoPath);

      // Reescribimos la configuración local para evitar usar los valores globales (~/.gitconfig)
      await git.addConfig("user.name", accountUsername, false, "local");
      await git.addConfig("user.email", accountEmail, false, "local");

      // Flujo estándar de Git
      await git.add("./*");
      await git.commit(message);

      return { success: true };
    } catch (error) {
      // Aquí es donde el backend captura el stderr para el posterior análisis de fallas
      return { success: false, error: error.message };
    }
  },
);
```

---

## 5. El Cortafuegos / Puente: `src/preload/preload.js`

El script de precarga expone funciones selectivas a la ventana de Vue 3 a través del objeto `window.api`. Así la interfaz gráfica nunca tiene acceso total a tu computadora, mitigando riesgos de seguridad.

```javascript
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Métodos expuestos para la interfaz de Vue
  addAccount: (accountData) => ipcRenderer.invoke("account:add", accountData),
  commitAndPush: (gitData) =>
    ipcRenderer.invoke("git:commit-and-push", gitData),

  // Escuchador pasivo para cuando el sistema detecte un error complejo de Git
  onGitError: (callback) =>
    ipcRenderer.on("git-error-triggered", (event, value) => callback(value)),
});
```

---

## 6. Consumo desde el Frontend: Implementación en Vue 3

Así es como utilizas el puente de datos nativo dentro de un componente de Vue 3 (`<script setup>`) con Composition API:

```vue
<script setup>
import { ref } from "vue";

const repoPath = ref("/usuarios/proyectos/mi-app-freelance");
const commitMessage = ref("feat: add AI automatic commit generator button");
const isLoading = ref(false);

async function handleSecureCommit() {
  isLoading.value = true;

  const payload = {
    repoPath: repoPath.value,
    message: commitMessage.value,
    accountUsername: "mi_usuario_personal",
    accountEmail: "personal@email.com",
  };

  // Invocamos el puente expuesto por el preload script
  const response = await window.api.commitAndPush(payload);
  isLoading.value = false;

  if (response.success) {
    console.log("¡Commit exitoso e identidad local de Git protegida!");
  } else {
    console.error("Fallo operativo en Git:", response.error);
  }
}
</script>

<template>
  <div class="p-6 bg-slate-900 text-white rounded-lg shadow-md">
    <h3 class="text-lg font-bold mb-4">Panel de Control de Repositorio</h3>
    <button
      @click="handleSecureCommit"
      :disabled="isLoading"
      class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-semibold disabled:bg-slate-700"
    >
      {{ isLoading ? "Procesando..." : "Hacer Commit Seguro" }}
    </button>
  </div>
</template>
```

---

## 7. Lógica del Prompt para Integración de OpenAI

Cuando crees el archivo de IA para procesar el diff antes del commit, configura la llamada a OpenAI en tu proceso **Main** mapeando los tokens con este payload estructurado:

```javascript
const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateCommitMessage(gitDiffText) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2, // Temperatura baja para respuestas estructuradas y consistentes
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Eres un analizador de código experto. Tu tarea es inspeccionar el 'git diff' provisto y generar un mensaje de commit que siga rigurosamente la especificación de 'Conventional Commits'. Devuelve única y exclusivamente un objeto JSON estructurado con las claves 'title' y 'body'.",
      },
      {
        role: "user",
        content: `Analiza los siguientes cambios en el código:\n\n${gitDiffText}`,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}
```
