import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { exec as pkgExec } from '@yao-pkg/pkg';
import resedit from 'resedit-cli';

const root = path.resolve(
  fileURLToPath(new URL('..', import.meta.url)),
);

const dist = path.join(root, 'dist', 'windows');

const release = path.join(
  dist,
  'MCAAS-DES-Windows-x64',
);

const baseExe = path.join(
  dist,
  'mcaas-des-base.exe',
);

const finalExe = path.join(
  dist,
  'mcaas-des.exe',
);

fs.rmSync(release, {
  recursive: true,
  force: true,
});

fs.mkdirSync(release, {
  recursive: true,
});

fs.rmSync(baseExe, {
  force: true,
});

fs.rmSync(finalExe, {
  force: true,
});

console.log('Generando ejecutable base...');

await pkgExec({
  input: path.join(root, 'build', 'index.js'),
  targets: ['node22-win-x64'],
  output: baseExe,
  sea: true,
});

console.log(`Ejecutable base generado: ${baseExe}`);

try {
  console.log('Aplicando icono y metadata...');

  await resedit({
    in: baseExe,
    out: finalExe,

    'ignore-signed': true,

    definition: {
      lang: 1033,

      icons: [
        {
          id: 1,
          sourceFile: path.join(
            root,
            'assets',
            'mcaas-des.ico',
          ),
        },
      ],

      version: {
        companyName: 'MCAAS',

        fileDescription:
          'Middle - Connector as a Service - Database Extractor n Sender',

        productName: 'MCAAS - DES',

        fileVersion: '1.1.0.0',

        productVersion: '1.1.0.0',
      },
    },
  });

  console.log('Metadata e icono aplicados.');
} catch (error) {
  console.warn(
    'No se pudo inyectar metadata/icono. Se conservará el ejecutable base.',
    error,
  );

  fs.copyFileSync(
    baseExe,
    finalExe,
  );
}

fs.rmSync(baseExe, {
  force: true,
});

const copy = (
  from,
  to = path.basename(from),
) => {
  fs.copyFileSync(
    from,
    path.join(release, to),
  );
};

copy(
  finalExe,
  'mcaas-des.exe',
);

copy(
  path.join(root, '.env.example'),
);

const scriptsDir = path.join(
  root,
  'scripts',
);

for (
  const file of fs
    .readdirSync(scriptsDir)
    .filter((name) =>
      /^extraction.*\.sql$/i.test(name),
    )
) {
  copy(
    path.join(scriptsDir, file),
  );
}

copy(
  path.join(
    root,
    'assets',
    'mcaas-des-icon.png',
  ),
);

copy(
  path.join(
    root,
    'assets',
    'mcaas-des.ico',
  ),
);

const manual = path.join(
  root,
  'docs',
  'Manual_MCAAS_DES.pdf',
);

if (fs.existsSync(manual)) {
  copy(
    manual,
    'Manual_MCAAS_DES.pdf',
  );
}

for (const file of [
  'install.ps1',
  'uninstall.ps1',
  'register-tasks.ps1',
  'unregister-tasks.ps1',
  'Open-Monitor.bat',
  'Start-MCAAS-DES.bat',
  'Stop-MCAAS-DES.bat',
  'Clear-Persistent-Error.bat',
]) {
  copy(
    path.join(
      root,
      'scripts',
      file,
    ),
  );
}

fs.writeFileSync(
  path.join(
    release,
    'README-INSTALL.txt',
  ),
  [
    'MCAAS - DES v1.1.0',
    '',
    '1) Extraiga esta carpeta en la PC Windows.',
    '2) Abra PowerShell como Administrador.',
    '3) Ejecute: powershell -ExecutionPolicy Bypass -File .\\install.ps1',
    '4) Edite C:\\ProgramData\\MCAAS-DES\\.env',
    '5) Valide y pruebe conexiones antes de iniciar la tarea.',
    '',
    'El servidor destino NO necesita Node.js.',
    '',
  ].join('\r\n'),
  'utf8',
);

console.log('');
console.log(
  `Release listo en: ${release}`,
);