// Generates .lh-run.cmd that boots `next start` with a compliant admin hash
// (LOCAL LIGHTHOUSE RUN ONLY — does not touch your real .env).
import { scryptSync } from 'node:crypto';
import fs from 'node:fs';

const password = 'local-lighthouse-only';
const salt = 'Lh0nlyS4ltDeadbeefC0ffee12345678';
const hash = scryptSync(password, salt, 64).toString('hex');

const cmd = [
  '@echo off',
  'set ADMIN_PASSWORD_HASH=' + hash,
  'set ADMIN_PASSWORD_SALT=' + salt,
  'if exist .env ( set /p dummy= <NUL )',
  'set NODE_ENV=production',
  'call npm run start > .lh-server.log 2>&1',
].join('\r\n');

fs.writeFileSync('.lh-run.cmd', cmd);
console.log('.lh-run.cmd written (hash length ' + hash.length + ')');
