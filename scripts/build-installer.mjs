import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
if (process.platform !== 'win32') throw new Error('El instalador Inno Setup debe compilarse desde Windows.');
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const candidates = [
  path.join(process.env['ProgramFiles(x86)'] || '', 'Inno Setup 6', 'ISCC.exe'),
  path.join(process.env.ProgramFiles || '', 'Inno Setup 6', 'ISCC.exe'),
];
const iscc = candidates.find((candidate) => candidate && fs.existsSync(candidate));
if (!iscc) throw new Error('No se encontró Inno Setup 6. Instálelo y vuelva a ejecutar pnpm run installer:win.');
const result = spawnSync(iscc, [path.join(root, 'installer', 'mcaas-des.iss')], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
