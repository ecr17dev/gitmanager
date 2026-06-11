import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/main/**/*.js'],
      exclude: [
        'src/main/index.js',
        'src/main/windows.js',
        'src/main/ipcHandlers.js',
        'src/main/__tests__/**'
      ]
    }
  }
});
