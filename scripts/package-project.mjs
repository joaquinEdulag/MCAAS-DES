import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const outPath = path.join(path.dirname(root), 'MCAAS-DES-project.zip');
const output = fs.createWriteStream(outPath);
const archive = archiver('zip', { zlib: { level: 9 } });
archive.pipe(output);
archive.glob('**/*', {
  cwd: root,
  ignore: ['node_modules/**', 'build-ts/**', 'state/**', 'logs/**', '.env', '*.log'],
  dot: true,
});
await archive.finalize();
await new Promise((resolve, reject) => { output.on('close', resolve); output.on('error', reject); });
console.log(outPath);
