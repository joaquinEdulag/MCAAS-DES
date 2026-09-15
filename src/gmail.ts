import { google } from 'googleapis';
import type { GmailConfig, PersistentErrorState } from './types.js';
import { machineName } from './utils.js';

function base64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function sendPersistentErrorEmail(config: GmailConfig, state: PersistentErrorState, appName: string): Promise<void> {
  if (!config.enabled) return;
  if (!config.clientId || !config.clientSecret || !config.refreshToken || !config.from || !config.to) {
    throw new Error('Configuración de Gmail incompleta.');
  }
  const auth = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
  auth.setCredentials({ refresh_token: config.refreshToken });
  const gmail = google.gmail({ version: 'v1', auth });
  const subject = `[${appName}] Error persistente requiere atención`;
  const body = [
    `${appName} ha detenido temporalmente la sincronización por un error persistente.`,
    '',
    `Equipo: ${machineName()}`,
    `Inicio del estado persistente: ${state.firstTriggeredAt || 'N/D'}`,
    `Último fallo: ${state.lastFailureAt || 'N/D'}`,
    `Fallos dentro de la ventana actual: ${state.failureTimestamps.length}`,
    `Último motivo: ${state.lastReason || 'N/D'}`,
    '',
    'La aplicación permanece activa, pero no realizará nuevas extracciones/envíos hasta que se atienda el problema y se ejecute el comando de limpieza del error persistente.',
    '',
    'Este correo no contiene filas ni valores extraídos de las bases de datos.',
  ].join('\r\n');
  const rawMessage = [
    `From: ${config.from}`,
    `To: ${config.to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].join('\r\n');
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: base64Url(rawMessage) } });
}
