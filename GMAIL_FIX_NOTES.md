# Gmail API packaging fix

## Cambio aplicado

`src/gmail.ts` ya no importa `googleapis` durante la ejecución de MCAAS-DES.

El flujo ahora es:

1. Intercambiar `GMAIL_REFRESH_TOKEN` por un `access_token` en `https://oauth2.googleapis.com/token`.
2. Construir el mensaje MIME y codificarlo como Base64URL.
3. Enviar el mensaje con `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send` usando `fetch` nativo de Node.js 22.

Las variables `.env` de Gmail no cambian.

## Build

Desde la raíz del proyecto:

```powershell
pnpm install
pnpm run typecheck
pnpm test
pnpm run build:win
```

El comando `bundle` ahora limpia `build/` antes de ejecutar NCC para no conservar chunks de builds anteriores.

## Despliegue

Reemplace el ejecutable instalado por el nuevo `dist/windows/MCAAS-DES-Windows-x64/mcaas-des.exe` siguiendo el flujo normal de actualización. Conserve el `.env` del servidor.

Después active temporalmente:

```env
GMAIL_ENABLED=true
```

Para probar la alerta de forma real, provoque únicamente en un entorno controlado la condición de error persistente o utilice el flujo normal del sistema. Si OAuth tiene un problema, el log ahora mostrará mensajes como `invalid_grant`, `401` o `403` en vez del error local `./57.index.js`.
