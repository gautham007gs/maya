// Dependency usage scanner: flags deps with zero imports anywhere.
import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

// Collect all source text
let corpus = '';
const walk = (dir) => {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (f === 'node_modules' || f === '.next' || f === '.git') continue;
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (/\.(tsx?|mjs|cjs|js|css|json|md)$/.test(f)) corpus += fs.readFileSync(full, 'utf8');
  }
};
walk('src');
for (const extra of ['scripts', 'next.config.js', 'postcss.config.mjs', 'tailwind.config.ts', 'postcss.config.js', 'instrumentation.ts', 'proxy.ts']) {
  try {
    if (fs.statSync(extra).isFile()) corpus += fs.readFileSync(extra, 'utf8');
    else if (fs.statSync(extra).isDirectory()) walk(extra);
  } catch { /* optional path */ }
}

const results = [];
for (const [name] of Object.entries(deps)) {
  const patterns = [
    `from '${name}`, `from "${name}`,
    `require('${name}`, `require("${name}`,
    `import('${name}`, `import("${name}`,
    `'${name}/`, `"${name}/`,
  ];
  let used = patterns.some(p => corpus.includes(p));
  if (!used && (name.startsWith('eslint') || name === 'tailwindcss-animate' || name === '@tailwindcss/typography')) {
    used = corpus.includes(name);
  }
  results.push({ name, used });
}

console.log('=== UNUSED (zero references) ===');
const unused = results.filter(r => !r.used);
if (!unused.length) console.log('  (none)');
unused.forEach(r => console.log('  X ' + r.name));
console.log('\n=== USED ===');
results.filter(r => r.used).forEach(r => console.log('  ok ' + r.name));
