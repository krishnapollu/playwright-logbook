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
  const dependencies = [...new Set(inputs.flatMap((name) => {
    const match = name.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
    return match ? [match[1]] : [];
  }))].sort();
  const notices = await Promise.all(dependencies.map(async (name) => {
    const directory = new URL(`../../node_modules/${name}/`, import.meta.url);
    const manifest = JSON.parse(await fs.readFile(new URL('package.json', directory), 'utf8'));
    const licenseFile = (await fs.readdir(directory)).find(file => /^LICENSE(?:\.[^/]+)?$/i.test(file));
    if (!licenseFile) throw new Error(`Missing license for bundled dependency: ${name}`);
    return `${name} ${manifest.version}\n${await fs.readFile(new URL(licenseFile, directory), 'utf8')}`;
  }));
  await fs.writeFile(new URL('THIRD_PARTY_NOTICES.txt', import.meta.url), notices.join('\n\n'));
});
await fs.copyFile(new URL('../../LICENSE', import.meta.url), new URL('LICENSE', import.meta.url));
