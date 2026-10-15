# MCAAS-DES - Compatibilidad con ERP (15 de octubre de 2026)

## Que se comparo

Se contrastaron los scripts del conector con las definiciones `CREATE TABLE` del respaldo `edulag_erp_dev(4).sql` proporcionado. La comparacion es **del respaldo**, no una conexion ni prueba contra Aiven o CONTPAQi en vivo. No se modifica la BD, ni se incluye el respaldo con datos personales en el ZIP.

| Extraccion | Antes (ya no existe en el respaldo) | Tabla actual | Clave de busqueda |
| --- | --- | --- | --- |
| Empresa CONTPAQi | `erp_nucleo_empresa` | `erp_organizacion_empresa` | `id` (GUID de empresa) |
| Empleados EDULAG/Tequilera/Pentagono | `erp_rh_empleado` | `erp_organizacion_empleado` | `empresa_id,numero_empleado` |

La tabla de empleados **no tiene** `source_name`. Por ello, los tres scripts de empleados conservan el nombre de origen en MCAAS/logs, pero ya no envian esa columna a MySQL. Para distinguir numeros de empleado iguales de empresas diferentes usan `empresa_id + numero_empleado`.

Los campos de empresa usados por el script si existen en el esquema del respaldo. Los campos de empleado exportados tambien existen. Se mantiene sin enviar `id` de empleado (AUTO_INCREMENT), `fecha_baja`, `motivo_baja`, `transporte`, `vales`, `vacaciones_totales` y `vacaciones_disponibles`, que no deben sobrescribirse por esta extraccion.

## Compatibilidad con la configuracion anterior

`src/table-names.ts` convierte automaticamente los aliases antiguos `nucleo_empresa` / `erp_nucleo_empresa` a `erp_organizacion_empresa`, y `rh_empleado` / `erp_rh_empleado` a `erp_organizacion_empleado`. Los demas aliases historicos se conservan como estaban y NO se revisaron porque no los usan estas extracciones.

Para evitar advertencias conviene actualizar el `.env` **instalado** (no se incluye ni reemplaza). Si solo usa Empresa:

```env
EXTRACT_1_TARGET_TABLE=erp_organizacion_empresa
EXTRACT_1_SYNC_KEY_COLUMNS=id
DEST_1_TARGET_TABLE=erp_organizacion_empresa
INCLUDE_SOURCE_NAME=false
```

Si usa ademas empleados de distintas empresas:

```env
INCLUDE_SOURCE_NAME=false
DEST_1_TARGET_TABLE=
# En los bloques de empleado EXTRACT_N:
EXTRACT_N_TARGET_TABLE=erp_organizacion_empleado
EXTRACT_N_SYNC_KEY_COLUMNS=empresa_id,numero_empleado
```

> `EXTRACT_N` es un ejemplo: reemplace N por el numero real de cada extraccion. No pegue literalmente un bloque con N. Con varias tablas, `DEST_1_TARGET_TABLE` debe quedar VACIO porque de otro modo forzaria todas las extracciones a una sola tabla. `ORIGIN_FIELD_NAME=source_name` puede seguir definido siempre que `INCLUDE_SOURCE_NAME=false`.

## Sincronizacion de estado

- **Empresas:** el motor puede recuperar las huellas guardadas para `erp_nucleo_empresa`, porque el GUID `id` sigue siendo la clave. Esto evita sincronizaciones innecesarias si la tabla se renombro conservando datos.
- **Empleados:** cambian tanto la tabla como la clave. Se crea una nueva identidad de seguimiento local, de manera que en la primera ejecucion pueden aparecer muchas filas como "nuevas" **para MCAAS**. MySQL busca primero por `(empresa_id,numero_empleado)` y actualiza la fila existente si la encuentra, en lugar de insertar siempre. No borre `state` para intentar acelerar esta conversion.
- **Precaucion:** el esquema actual de empleados no exige unicidad para `(empresa_id,numero_empleado)`. El respaldo entregado no muestra duplicados en ese par, pero compruebe los datos **reales** con la consulta 4 de `scripts/validation-empleados-multiempresa-aiven.sql` antes de habilitar extracciones de empleados. Si devuelve filas, no sincronice hasta resolverlas con el equipo responsable.

## Archivos de origen y despliegue

La entrega incluye `src/table-names.ts`, los cuatro scripts SQL de CONTPAQi, validaciones, pruebas y ejemplos de configuracion. No contiene contrasenas ni `.env` real, bases de datos, ejecutables recompilados, ni carpetas de estado/logs.

**Importante:** copiar solo `src` y `scripts` al proyecto no actualiza el `mcaas-des.exe` que pueda estar funcionando como tarea de Windows. Para una instalacion automatizada, hay que construir el ejecutable con `corepack pnpm run build:win` en un entorno Windows con Node.js 22+ y copiarlo a `C:\Program Files\MCAAS-DES`, ademas de actualizar los SQL en `C:\ProgramData\MCAAS-DES\scripts`. Siga `GUIA_ACTUALIZACION_MCAAS_2026-10-15.md`.

## Validaciones

- Pruebas automaticas del repositorio: `corepack pnpm test`
- Verificacion de tipos: `corepack pnpm run typecheck`
- Compilacion Windows: `corepack pnpm run build:win`
- Validacion de configuracion instalada: `mcaas-des.exe --validate-config --config C:\ProgramData\MCAAS-DES\.env`
- Conexion a las BD: `mcaas-des.exe --check-connections --config C:\ProgramData\MCAAS-DES\.env`
- Consultas de verificacion en Aiven/MySQL: `scripts/validation-empleados-multiempresa-aiven.sql` (solo `SELECT`).

Ninguno de los pasos de comparacion del respaldo ejecuto operaciones sobre una BD real.
