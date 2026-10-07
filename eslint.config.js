import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
export default tseslint.config({ ignores: ['fixtures/**', '**/dist/**', '.logbook/**', '.local/**', 'node_modules/**', 'docs/logbook-golden.test.ts', 'test/integration/golden.test.ts'] }, eslint.configs.recommended, ...tseslint.configs.recommended, prettier, {
  files: ['packages/vscode/media/detail.js'],
  languageOptions: { globals: { acquireVsCodeApi: 'readonly', window: 'readonly', document: 'readonly' } },
});
