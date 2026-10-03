# Migracion de nombres fisicos del ERP - 2026-10-03

El ERP cambio su convencion de tablas fisicas. MCAAS-DES queda alineado con esa nomenclatura y conserva compatibilidad temporal con configuraciones que todavia tengan nombres anteriores.

## Tablas usadas actualmente por MCAAS

| Uso | Nombre anterior | Nombre actual |
| --- | --- | --- |
| Empresas | `nucleo_empresa` | `erp_nucleo_empresa` |
| Empleados | `rh_empleado` | `erp_rh_empleado` |

Los metadatos `MCAAS_TARGET_TABLE`, los ejemplos `.env`, las consultas de validacion y los scripts auxiliares ya usan los nombres actuales.

## Compatibilidad con un .env instalado anteriormente

Si una instalacion existente conserva un override como:

```env
DEST_1_TARGET_TABLE=nucleo_empresa
```

o cualquier otro nombre incluido en la migracion del ERP, MCAAS normaliza ese valor al nombre actual antes de escribir. El log deja una advertencia para que el `.env` se actualice posteriormente.

No se normalizan nombres ajenos al mapa del ERP.

## Estado local de sincronizacion

El identificador de cada stream incluye la tabla destino. Como la tabla fisica fue renombrada, una actualizacion simple cambiaria ese identificador y podria provocar una resincronizacion completa.

Esta entrega migra automaticamente el stream local cuando encuentra el estado correspondiente al nombre anterior. De esta forma, si la migracion del ERP fue un `RENAME TABLE` y los datos ya existen, MCAAS conserva las huellas conocidas y no vuelve a tratar todas las filas como nuevas solo por el cambio de nomenclatura.

## Mapa conocido por MCAAS

| Anterior | Actual |
| --- | --- |
| `nucleo_empresa` | `erp_nucleo_empresa` |
| `organizacion_area` | `erp_organizacion_area` |
| `organizacion_area_jefe` | `erp_organizacion_area_jefe` |
| `organizacion_puesto` | `erp_organizacion_puesto` |
| `rh_empleado` | `erp_rh_empleado` |
| `rh_empleado_asignacion` | `erp_rh_empleado_asignacion` |
| `rh_empleado_asignacion_historico` | `erp_rh_empleado_asignacion_historico` |
| `rh_horario` | `erp_rh_horario` |
| `rh_horario_dia` | `erp_rh_horario_dia` |
| `rh_rotacion` | `erp_rh_rotacion` |
| `rh_rotacion_turno` | `erp_rh_rotacion_turno` |
| `rh_turno` | `erp_rh_turno` |
| `rh_turno_horario` | `erp_rh_turno_horario` |
| `acceso_rol` | `casl_rol` |
| `acceso_permiso` | `casl_permiso` |
| `acceso_permiso_tabla` | `casl_permiso_tabla` |
| `acceso_permiso_campo` | `casl_permiso_campo` |
| `acceso_rol_permiso` | `casl_rol_permiso` |
| `acceso_area_rol` | `casl_area_rol` |
| `acceso_usuario_config` | `casl_usuario_config` |
| `acceso_usuario_rol` | `casl_usuario_rol` |
| `acceso_identidad_entra` | `entra_identidad_empleado` |

Actualmente los flujos incluidos escriben solo en `erp_nucleo_empresa` y `erp_rh_empleado`; el resto del mapa se conserva para que futuros scripts de MCAAS no vuelvan a apuntar accidentalmente a nombres legacy.

## Actualizacion recomendada de una instalacion Windows

1. Detenga temporalmente la tarea `MCAAS-DES Core`.
2. Reemplace el ejecutable/scripts con la nueva compilacion.
3. En `C:\ProgramData\MCAAS-DES\.env`, cambie cualquier `nucleo_empresa` por `erp_nucleo_empresa` y cualquier `rh_empleado` por `erp_rh_empleado`.
4. Si `DEST_N_TARGET_TABLE` esta vacio, dejelo vacio: cada script ya define su tabla correcta.
5. Ejecute `--validate-config`, `--check-connections` y luego `--run-once`.
6. Revise el log y vuelva a iniciar la tarea programada.

La compatibilidad automatica permite arrancar aun antes de editar el `.env`, pero mantener la configuracion con nombres actuales evita advertencias y deja el despliegue consistente con el ERP.
