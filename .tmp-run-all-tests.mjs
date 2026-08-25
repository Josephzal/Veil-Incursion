import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

function findTestFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      findTestFiles(full, out);
    } else if (name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

const root = process.cwd();
const files = findTestFiles(join(root, 'src')).sort();

const results = [];
for (const file of files) {
  const rel = relative(root, file);
  const start = Date.now();
  try {
    await import(pathToFileURL(file).href);
    results.push({ file: rel, ok: true, ms: Date.now() - start });
  } catch (err) {
    results.push({ file: rel, ok: false, ms: Date.now() - start, error: err?.stack ?? String(err) });
  }
}

const failed = results.filter((r) => !r.ok);
console.log('\n=== SUMMARY ===');
console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
for (const r of failed) {
  console.log(`\n--- FAILED: ${r.file} ---`);
  console.log(r.error);
}
process.exitCode = failed.length > 0 ? 1 : 0;
