import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const registry = 'https://registry.npmjs.org/';
const verifyOnly = process.argv.slice(2).join(' ') === '--verify';

function readToken() {
  if (process.env.npm_pat) return process.env.npm_pat;
  const envFile = path.join(root, '.env');
  if (!existsSync(envFile)) throw new Error('Add npm_pat to .env or export npm_pat.');
  const line = readFileSync(envFile, 'utf8').split(/\r?\n/)
    .find(entry => /^\s*(?:export\s+)?npm_pat\s*=/.test(entry));
  if (!line) throw new Error('npm_pat was not found in .env.');
  const token = line.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!token) throw new Error('npm_pat is empty.');
  return token;
}

function npm(args, authEnv) {
  const result = spawnSync('npm', args, {
    cwd: root,
    env: authEnv,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 120_000,
  });
  if (result.error) throw result.error;
  return result;
}

try {
  if (process.argv.length > 2 && !verifyOnly) {
    throw new Error('Usage: npm run release:publish [-- --verify]');
  }

  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const extension = JSON.parse(readFileSync(path.join(root, 'packages/vscode/package.json'), 'utf8'));
  const release = JSON.parse(readFileSync(path.join(root, 'dist/releases/artifacts.json'), 'utf8'));
  if (pkg.name !== 'playwright-logbook' || release.reporterVersion !== pkg.version ||
      release.extensionVersion !== extension.version || release.inspection !== 'passed') {
    throw new Error('Release versions or inspection status differ from the prepared artifacts.');
  }

  const tarball = `dist/releases/playwright-logbook-${pkg.version}.tgz`;
  const vsix = `packages/vscode/dist/playwright-logbook-vscode-${extension.version}.vsix`;
  for (const expectedPath of [tarball, vsix]) {
    const entry = release.artifacts.find(artifact => artifact.path === expectedPath);
    if (!entry) throw new Error(`Missing artifact manifest entry: ${expectedPath}`);
    const file = path.join(root, expectedPath);
    const bytes = statSync(file).size;
    const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
    if (bytes !== entry.bytes || sha256 !== entry.sha256) {
      throw new Error(`Artifact differs from the verified release: ${expectedPath}`);
    }
  }

  console.log(`Verified ${tarball} and ${vsix}.`);
  if (verifyOnly) {
    console.log('Verification passed. No publication attempted.');
  } else {
    const authEnv = { ...process.env, 'npm_config_//registry.npmjs.org/:_authToken': readToken() };
    const signedIn = npm(['whoami', `--registry=${registry}`, '--fetch-retries=0', '--fetch-timeout=10000'], authEnv);
    if (signedIn.status !== 0) throw new Error('npm authentication failed. Check npm_pat in .env.');

    const versions = npm(['view', pkg.name, 'versions', '--json', `--registry=${registry}`, '--fetch-retries=0', '--fetch-timeout=10000'], authEnv);
    if (versions.status !== 0) throw new Error('Could not check published npm versions; publication stopped.');
    const published = JSON.parse(versions.stdout);
    if ((Array.isArray(published) ? published : [published]).includes(pkg.version)) {
      throw new Error(`${pkg.name}@${pkg.version} is already published.`);
    }

    console.log(`Publishing ${tarball} to npm…`);
    const result = spawnSync('npm', ['publish', `./${tarball}`, '--access', 'public', '--tag', 'latest', `--registry=${registry}`], {
      cwd: root,
      env: authEnv,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('npm publication failed.');
    console.log(`npm publication complete. Upload ${vsix} at https://marketplace.visualstudio.com/manage/publishers/krishnapollu`);
  }
} catch (error) {
  console.error(`Release stopped: ${error.message}`);
  process.exitCode = 1;
}
