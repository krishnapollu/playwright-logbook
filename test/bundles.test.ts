import { expect, it } from 'vitest';
import { Readable } from 'node:stream';
import * as yazl from 'yazl';
import { BUNDLE_LIMITS, canonicalJson, createBundle, digest, inspectBundleZip, safeBundlePath, writeBundleZip } from '../src/bundles/archive.js';
import { run } from './factories.js';

async function rawZip(entries: { name: string; bytes: Buffer; mode?: number; compress?: boolean }[]): Promise<Buffer> {
  const zip = new yazl.ZipFile();
  for (const entry of entries) zip.addBuffer(entry.bytes, entry.name, { mode: entry.mode ?? 0o100644, compress: entry.compress ?? false, mtime: new Date(1980, 0, 1), forceDosTimestamp: true });
  zip.end(); const chunks: Buffer[] = []; for await (const data of zip.outputStream as Readable) chunks.push(data as Buffer); return Buffer.concat(chunks);
}

it('round trips deterministic canonical runs and preserves record identities', async () => {
  const bytes = await createBundle([run('second'), run('first')], 'sample');
  expect(await createBundle([run('first'), run('second')], 'sample')).toEqual(bytes);
  const bundle = await inspectBundleZip(bytes);
  expect([...bundle.runs.keys()]).toEqual(['first', 'second']);
  expect(bundle.runs.get('first')).toEqual(run('first'));
  expect(bundle.manifest.projectId).toBe('sample');
  expect(bundle.digest).toBe(digest(bytes));
  expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
});

it('rejects unsafe paths, case collisions, symlinks, corrupted and undeclared archives', async () => {
  for (const file of ['/absolute', '../secret', 'a/../b', 'C:/secret', 'a\\b', 'a//b', 'a/./b', 'NUL.txt', 'a.']) expect(safeBundlePath(file)).toBe(false);
  const bytes = await createBundle([run('good')]);
  const valid = await inspectBundleZip(bytes);
  const undeclared = new Map(valid.files); undeclared.set('extra.txt', Buffer.from('extra'));
  await expect(inspectBundleZip(await writeBundleZip(undeclared))).rejects.toThrow('undeclared');
  await expect(inspectBundleZip(Buffer.from('not zip'))).rejects.toThrow('Malformed');
  await expect(inspectBundleZip(await rawZip([{ name: 'manifest.json', bytes: Buffer.from('{}'), mode: 0o120777 }]))).rejects.toThrow('Unsafe');
  await expect(inspectBundleZip(await rawZip([{ name: 'A.txt', bytes: Buffer.alloc(0) }, { name: 'a.txt', bytes: Buffer.alloc(0) }]))).rejects.toThrow('duplicate');
  const changed = new Map(valid.files); changed.set('runs/good.json', Buffer.from('{}'));
  await expect(inspectBundleZip(await writeBundleZip(changed))).rejects.toThrow('digest mismatch');
  const version = new Map(valid.files); version.set('manifest.json', Buffer.from(canonicalJson({ ...valid.manifest, bundleVersion: 2 })));
  await expect(inspectBundleZip(await writeBundleZip(version))).rejects.toThrow('unsupported');
});

it('bounds archive sizes, entry counts, inflated bytes and cancellation', async () => {
  const bytes = await createBundle([run('good')]);
  await expect(inspectBundleZip(bytes, undefined, { ...BUNDLE_LIMITS, archive: 4 })).rejects.toThrow('size limit');
  await expect(inspectBundleZip(bytes, undefined, { ...BUNDLE_LIMITS, entries: 1 })).rejects.toThrow('entry limit');
  await expect(inspectBundleZip(bytes, undefined, { ...BUNDLE_LIMITS, record: 10 })).rejects.toThrow('expansion limit');
  const bomb = await rawZip([{ name: 'large.txt', bytes: Buffer.from('x'.repeat(100000)), compress: true }]);
  await expect(inspectBundleZip(bomb)).rejects.toThrow('expansion limit');
  const abort = new AbortController(); abort.abort();
  await expect(inspectBundleZip(bytes, abort.signal)).rejects.toThrow();
  await expect(createBundle([run('good')], null, new Map(), [], abort.signal)).rejects.toThrow();
});

it('retains invalid records as diagnostics but rejects nonportable source records on export', async () => {
  await expect(createBundle([{ ...run('bad'), paths: { outputDir: '/outside' } }])).rejects.toThrow('unsafe recorded path');
  const bundle = await inspectBundleZip(await createBundle([run('good')]));
  const invalid = Buffer.from('{}');
  bundle.files.set('runs/good.json', invalid);
  bundle.manifest.runs[0]!.sha256 = digest(invalid);
  const file = bundle.manifest.files.find(item => item.path === 'runs/good.json')!; file.size = invalid.length; file.sha256 = digest(invalid);
  bundle.files.set('manifest.json', Buffer.from(canonicalJson(bundle.manifest)));
  const inspected = await inspectBundleZip(await writeBundleZip(bundle.files));
  expect(inspected.runs.size).toBe(0); expect(inspected.invalidRuns).toHaveLength(1);
});

it('rejects encrypted/false-size/traversal ZIP entries and cancellation after inspection starts', async () => {
  const archive = await rawZip([{ name: 'abc.txt', bytes: Buffer.from('content') }]);
  const central = archive.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  const encrypted = Buffer.from(archive); encrypted.writeUInt16LE(encrypted.readUInt16LE(central + 8) | 1, central + 8);
  await expect(inspectBundleZip(encrypted)).rejects.toThrow();
  const size = Buffer.from(archive); size.writeUInt32LE(1000000, central + 24);
  await expect(inspectBundleZip(size)).rejects.toThrow();
  const traversal = Buffer.from(archive); traversal.write('../oops', central + 46);
  await expect(inspectBundleZip(traversal)).rejects.toThrow();
  const controller = new AbortController(); const pending = inspectBundleZip(await createBundle([run('cancel')]), controller.signal); controller.abort();
  await expect(pending).rejects.toThrow();
});
