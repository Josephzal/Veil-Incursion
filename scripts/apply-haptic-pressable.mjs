#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const HAPTIC_PATH = path.join(SRC, 'components', 'HapticPressable.tsx');

const SKIP_FILES = new Set([
  HAPTIC_PATH,
  path.join(SRC, 'components', 'HapticPressable.tsx'),
  path.join(SRC, 'utils', 'hubButtonHaptics.ts'),
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

function relImport(fromFile) {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, path.join(SRC, 'components', 'HapticPressable')).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

function transform(file, text) {
  if (!text.includes('Pressable')) return null;
  if (text.includes('HapticPressable')) {
    text = text.replace(/\bPressable\b/g, (match, offset) => {
      const before = text.slice(Math.max(0, offset - 80), offset);
      if (before.includes('Haptic')) return match;
      return 'HapticPressable';
    });
  } else {
    text = text.replace(/\bPressable\b/g, 'HapticPressable');
  }

  if (!text.includes("from './HapticPressable'") && !text.includes('from "./HapticPressable"')) {
    const importPath = relImport(file);
    const rnImport = /import\s+\{([^}]+)\}\s+from\s+['"]react-native['"];?/;
    const match = text.match(rnImport);
    if (match) {
      const names = match[1]
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n && n !== 'HapticPressable');
      if (names.length === 0) {
        text = text.replace(rnImport, `import HapticPressable from '${importPath}';`);
      } else {
        const replacement = `import { ${names.join(', ')} } from 'react-native';\nimport HapticPressable from '${importPath}';`;
        text = text.replace(rnImport, replacement);
      }
    }
  }

  return text;
}

let changed = 0;
for (const file of walk(SRC)) {
  if (SKIP_FILES.has(file)) continue;
  const original = fs.readFileSync(file, 'utf8');
  const next = transform(file, original);
  if (next && next !== original) {
    fs.writeFileSync(file, next);
    changed += 1;
    console.log(path.relative(ROOT, file));
  }
}
console.log(`Updated ${changed} files.`);
