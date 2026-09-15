import http from 'node:http';
import { URL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { google } from 'googleapis';

const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };
const configPath = path.resolve(arg('--config') || '.env');
if (fs.existsSync(configPath)) dotenv.config({ path: configPath, override: true });
else dotenv.config();

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:53682/oauth2callback';
if (!clientId || !clientSecret) {
  console.error('Defina GMAIL_CLIENT_ID y GMAIL_CLIENT_SECRET en el .env antes de ejecutar este asistente.');
  process.exit(1);
}
const redirect = new URL(redirectUri);
if (!['localhost', '127.0.0.1'].includes(redirect.hostname)) {
  console.error('Para este asistente, GMAIL_REDIRECT_URI debe apuntar a localhost/127.0.0.1.');
  process.exit(1);
}
const port = Number(redirect.port || 80);
const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
const url = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/gmail.send'],
});
console.log('\nAbra esta URL en su navegador y autorice la cuenta que enviará las alertas:\n');
console.log(url);
console.log(`\nEsperando el callback en ${redirectUri} ...\n`);

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host}`);
    if (requestUrl.pathname !== redirect.pathname) { res.writeHead(404); res.end('Not found'); return; }
    const code = requestUrl.searchParams.get('code');
    const error = requestUrl.searchParams.get('error');
    if (error) throw new Error(`Google devolvió: ${error}`);
    if (!code) throw new Error('No se recibió código de autorización.');
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Autorización completada. Puede cerrar esta pestaña y regresar a la terminal.');
    console.log('Autorización completada.');
    console.log('\nCopie este valor en GMAIL_REFRESH_TOKEN de su .env:\n');
    console.log(tokens.refresh_token || '(Google no devolvió refresh_token; revoque el acceso previo y repita con prompt=consent)');
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(error));
    console.error(error);
  } finally {
    server.close();
  }
});
server.listen(port, redirect.hostname);
