import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} falló con código ${r.status}`);
};
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const dist = path.join(root, 'dist', 'windows');
const release = path.join(dist, 'MCAAS-DES-Windows-x64');
fs.rmSync(release, { recursive: true, force: true });
fs.mkdirSync(release, { recursive: true });
const baseExe = path.join(dist, 'mcaas-des-base.exe');
const finalExe = path.join(dist, 'mcaas-des.exe');
fs.rmSync(baseExe, { force: true }); fs.rmSync(finalExe, { force: true });

run(npx, ['--no-install', 'pkg', 'build/index.js', '-t', 'node22-win-x64', '--sea', '-o', baseExe]);

try {
  run(npx, ['--no-install', 'resedit', baseExe, finalExe,
    '--ignore-signed',
    '--icon', `1,${path.join(root, 'assets', 'mcaas-des.ico')}`,
    '--company-name', 'MCAAS',
    '--file-description', 'Middle - Connector as a Service - Database Extractor n Sender',
    '--product-name', 'MCAAS - DES',
    '--file-version', '1.1.0.0',
    '--product-version', '1.1.0.0']);
} catch (error) {
  console.warn('No se pudo inyectar metadata/icono con resedit CLI. Se conservará el ejecutable base.', error.message);
  fs.copyFileSync(baseExe, finalExe);
}
fs.rmSync(baseExe, { force: true });

const copy = (from, to = path.basename(from)) => fs.copyFileSync(from, path.join(release, to));
copy(finalExe, 'mcaas-des.exe');
copy(path.join(root, '.env.example'));
for (const file of fs.readdirSync(path.join(root, 'scripts')).filter((name) => /^extraction.*\.sql$/i.test(name))) copy(path.join(root, 'scripts', file));
copy(path.join(root, 'assets', 'mcaas-des-icon.png'));
copy(path.join(root, 'assets', 'mcaas-des.ico'));
const manual = path.join(root, 'docs', 'Manual_MCAAS_DES.pdf');
if (fs.existsSync(manual)) copy(manual, 'Manual_MCAAS_DES.pdf');
for (const file of ['install.ps1','uninstall.ps1','register-tasks.ps1','unregister-tasks.ps1','Open-Monitor.bat','Start-MCAAS-DES.bat','Stop-MCAAS-DES.bat','Clear-Persistent-Error.bat']) copy(path.join(root, 'scripts', file));
fs.writeFileSync(path.join(release, 'README-INSTALL.txt'), `MCAAS - DES v1.1.0\r\n\r\n1) Extraiga esta carpeta en la PC Windows.\r\n2) Abra PowerShell como Administrador.\r\n3) Ejecute: powershell -ExecutionPolicy Bypass -File .\\install.ps1\r\n4) Edite C:\\ProgramData\\MCAAS-DES\\.env\r\n5) Valide y pruebe conexiones antes de iniciar la tarea.\r\n\r\nEl servidor destino NO necesita Node.js.\r\n`, 'utf8');
console.log(`Release listo en: ${release}`);
