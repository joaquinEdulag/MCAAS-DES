# Estado de validación - MCAAS - DES v1.0.0

Este archivo documenta qué se validó al preparar este snapshot del proyecto.

## Validado en el entorno de preparación

- Smoke test de metadatos SQL, detección NEW/UPDATED, estado independiente y error persistente: OK.
- Sintaxis de los scripts Node de build, empaquetado, instalador y Gmail OAuth: OK.
- Revisión estática de TypeScript del código fuente con el compilador disponible en el entorno: OK.
- Manual PDF generado y renderizado visualmente en 18 páginas: OK.
- Icono PNG e ICO incluidos en `assets/`.

## Pendiente de ejecutar en una máquina de build con acceso a npm

El entorno de preparación no pudo resolver `registry.npmjs.org`, por lo que no fue posible descargar las dependencias del proyecto ni producir/probar el ejecutable Windows final en esta sesión.

Antes de desplegar en producción ejecute, en una máquina de compilación con Node.js 22+ y acceso a npm:

```bash
npm install
npm run typecheck
npm test
npm run build:win
npm run package:release
```

Después pruebe el release en una PC Windows de staging antes de instalarlo en el servidor productivo.

El servidor de operación no necesita Node.js una vez generado `mcaas-des.exe`.
