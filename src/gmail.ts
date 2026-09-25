import type { GmailConfig, PersistentErrorState } from './types.js';
import { machineName } from './utils.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const HTTP_TIMEOUT_MS = 30000;

function base64Url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function encodeMimeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

async function responseDetails(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `${response.status} ${response.statusText}`.trim();

  try {
    const parsed = JSON.parse(text) as {
      error?: string | { message?: string; status?: string };
      error_description?: string;
    };

    if (typeof parsed.error === 'string') {
      return [parsed.error, parsed.error_description].filter(Boolean).join(': ');
    }

    if (parsed.error && typeof parsed.error === 'object') {
      return [parsed.error.status, parsed.error.message].filter(Boolean).join(': ');
    }
  } catch {
    // Si Google devuelve texto no JSON, no exponemos cuerpos largos ni secretos.
  }

  return text.slice(0, 500);
}

async function getAccessToken(config: GmailConfig): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.clientId!,
    client_secret: config.clientSecret!,
    refresh_token: config.refreshToken!,
    grant_type: 'refresh_token',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`OAuth de Google rechazó el refresh token (${response.status}): ${await responseDetails(response)}`);
  }

  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) {
    throw new Error('OAuth de Google respondió correctamente, pero no devolvió access_token.');
  }

  return payload.access_token;
}

async function sendRawMessage(accessToken: string, rawMessage: string): Promise<void> {
  const response = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64Url(rawMessage) }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Gmail API rechazó el envío (${response.status}): ${await responseDetails(response)}`);
  }
}

export async function sendPersistentErrorEmail(
  config: GmailConfig,
  state: PersistentErrorState,
  appName: string,
): Promise<void> {
  if (!config.enabled) return;

  if (!config.clientId || !config.clientSecret || !config.refreshToken || !config.from || !config.to) {
    throw new Error('Configuración de Gmail incompleta.');
  }

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
    `Subject: ${encodeMimeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
  ].join('\r\n');

  const accessToken = await getAccessToken(config);
  await sendRawMessage(accessToken, rawMessage);
}
