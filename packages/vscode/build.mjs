import { build } from 'esbuild';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs/promises';

const root = fileURLToPath(new URL('.', import.meta.url));
await build({
  absWorkingDir: root, entryPoints: ['src/extension.ts'], outfile: 'dist/extension.cjs',
  bundle: true, platform: 'node', format: 'cjs', target: 'node20',
  external: ['vscode'], minify: true, legalComments: 'none', metafile: true,
}).then(async (result) => {
  const inputs = Object.keys(result.metafile.inputs);
  if (inputs.some((name) => /(?:playwright|src\/(?:reporter|collect|cli|render|clientlib))/.test(name))) {
    throw new Error('Extension bundle imported collection or presentation runtime.');
  }
});
await fs.copyFile(new URL('../../LICENSE', import.meta.url), new URL('LICENSE', import.meta.url));
