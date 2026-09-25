import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendPersistentErrorEmail } from '../src/gmail.js';
import type { GmailConfig, PersistentErrorState } from '../src/types.js';

const config: GmailConfig = {
  enabled: true,
  clientId: 'client-id',
  clientSecret: 'client-secret',
  refreshToken: 'refresh-token',
  redirectUri: 'http://localhost:53682/oauth2callback',
  from: 'alerts@example.com',
  to: 'support@example.com',
};

const state: PersistentErrorState = {
  active: true,
  failureTimestamps: ['2026-09-25T12:00:00.000Z'],
  firstTriggeredAt: '2026-09-25T12:00:00.000Z',
  lastFailureAt: '2026-09-25T12:00:00.000Z',
  lastReason: 'Error de prueba',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Gmail API mediante fetch nativo', () => {
  it('intercambia refresh token y envia el mensaje sin googleapis', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'access-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'gmail-message-id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

    vi.stubGlobal('fetch', fetchMock);

    await sendPersistentErrorEmail(config, state, 'MCAAS - DES');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');
    expect(fetchMock.mock.calls[1][0]).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer access-token' });
  });

  it('expone un invalid_grant como error OAuth real', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      error: 'invalid_grant',
      error_description: 'Token has been expired or revoked.',
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }));

    vi.stubGlobal('fetch', fetchMock);

    await expect(sendPersistentErrorEmail(config, state, 'MCAAS - DES'))
      .rejects
      .toThrow(/invalid_grant/i);
  });
});
