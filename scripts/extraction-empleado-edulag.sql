-- MCAAS_NAME=Empleado_EDULAG
-- MCAAS_TARGET_TABLE=rh_empleado
-- MCAAS_KEY_COLUMNS=source_name,numero_empleado

-- ============================================================
-- MCAAS-DES
-- EXTRACCION DE EMPLEADOS EDULAG
--
-- ORIGEN
--   Motor: SQL Server / CONTPAQi Nominas
--   BD:    ctNOM_Edulag_2021
--   Tabla: dbo.nom10001
--
-- DESTINO
--   Motor: MySQL / Aiven
--   BD:    edulag_erp_dev
--   Tabla: rh_empleado
--
-- IDENTIDAD FUNCIONAL MCAAS
--
--   source_name + numero_empleado
--
-- Ejemplo:
--
--   EDULAG      + 25
--   DEOMEDIC    + 25
--   CORPORATIVO + 25
--
-- son empleados diferentes.
--
-- IMPORTANTE:
--
-- - NO se envia id.
-- - NO se envia empresa_id.
-- - NO se envia area_id.
-- - NO se envia puesto_id.
-- - NO se envia fecha_baja.
-- - NO se envia motivo_baja.
-- - NO se envia transporte.
-- - NO se envia vales.
--
-- Esas columnas quedan bajo control de Aiven/RRHH.
--
-- Compatible con SQL Server antiguo:
-- - No usa TRY_CONVERT
-- - No usa CONCAT
-- ============================================================


;WITH base AS (
    SELECT

        -- ----------------------------------------------------
        -- IDENTIFICADOR INTERNO CONTAPAQI
        --
        -- Solo sirve para resolver posibles duplicados.
        -- No se envia a Aiven.
        -- ----------------------------------------------------
        idempleado AS id_empleado_contpaqi,


        -- ----------------------------------------------------
        -- EMPRESA DE PROCEDENCIA
        -- ----------------------------------------------------
        CAST('EDULAG' AS varchar(150)) AS source_name,


        -- ----------------------------------------------------
        -- NUMERO DE EMPLEADO
        -- ----------------------------------------------------
        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(50), codigoempleado)
                )
            ),
            ''
        ) AS numero_empleado,


        -- ----------------------------------------------------
        -- NOMBRE COMPLETO
        -- ----------------------------------------------------
        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(250), nombrelargo)
                    )
                ),
                ''
            ),
            250
        ) AS nombre_completo,


        -- ----------------------------------------------------
        -- CORREO ELECTRONICO
        -- ----------------------------------------------------
        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(254), CorreoElectronico)
                    )
                ),
                ''
            ),
            254
        ) AS correo_electronico,


        -- ----------------------------------------------------
        -- COMPONENTES CURP
        --
        -- curpi + fecha nacimiento YYMMDD + curpf
        -- ----------------------------------------------------
        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(30), curpi)
                )
            ),
            ''
        ) AS curp_inicio,

        fechanacimiento AS fecha_nacimiento_origen,

        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(30), curpf)
                )
            ),
            ''
        ) AS curp_final,


        -- ----------------------------------------------------
        -- COMPONENTES RFC
        --
        -- rfc + fecha nacimiento YYMMDD + homoclave
        -- ----------------------------------------------------
        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(30), rfc)
                )
            ),
            ''
        ) AS rfc_inicio,

        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(20), homoclave)
                )
            ),
            ''
        ) AS rfc_homoclave,


        -- ----------------------------------------------------
        -- FONACOT
        -- ----------------------------------------------------
        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(50), NumeroFonacot)
                    )
                ),
                ''
            ),
            50
        ) AS numero_fonacot,


        -- ----------------------------------------------------
        -- ESTADO CIVIL
        -- ----------------------------------------------------
        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(50), estadocivil)
                    )
                ),
                ''
            ),
            50
        ) AS estado_civil,


        -- ----------------------------------------------------
        -- LUGAR DE NACIMIENTO
        -- ----------------------------------------------------
        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(150), lugarnacimiento)
                    )
                ),
                ''
            ),
            150
        ) AS lugar_nacimiento,


        -- ----------------------------------------------------
        -- ESTATUS LABORAL CONTAPAQI
        -- ----------------------------------------------------
        UPPER(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(50), estadoempleado)
                    )
                ),
                ''
            )
        ) AS estado_empleado_codigo,


        -- ----------------------------------------------------
        -- FECHAS
        -- ----------------------------------------------------
        fechaalta AS fecha_alta,

        fechabaja AS fecha_baja_contpaqi,

        fechareingreso AS fecha_reingreso,


        -- ----------------------------------------------------
        -- MOTIVO BAJA CONTAPAQI
        -- ----------------------------------------------------
        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(255), causabaja)
                    )
                ),
                ''
            ),
            255
        ) AS motivo_baja_contpaqi,


        -- ----------------------------------------------------
        -- SALARIO DIARIO
        -- ----------------------------------------------------
        CAST(
            sueldodiario
            AS decimal(12, 2)
        ) AS salario_diario,


        -- ----------------------------------------------------
        -- CONTROL INTERNO DE ACTUALIZACION
        --
        -- No se envia a Aiven.
        -- ----------------------------------------------------
        [timestamp] AS actualizado_en_origen

    FROM [ctNOM_Edulag_2021].[dbo].[nom10001]
),


-- ============================================================
-- DEDUPLICACION
--
-- Dentro de EDULAG:
--
--   source_name + numero_empleado
--
-- debe aparecer una sola vez.
--
-- Si CONTPAQi contiene varias filas con el mismo numero:
--
-- 1. gana el registro mas reciente por timestamp;
-- 2. si empatan, gana idempleado mayor.
-- ============================================================
clasificada AS (
    SELECT
        *,

        ROW_NUMBER() OVER (
            PARTITION BY
                source_name,
                numero_empleado

            ORDER BY
                CASE
                    WHEN actualizado_en_origen IS NULL THEN 1
                    ELSE 0
                END,

                actualizado_en_origen DESC,
                id_empleado_contpaqi DESC
        ) AS rn

    FROM base

    WHERE numero_empleado IS NOT NULL
),


-- ============================================================
-- UNA SOLA FILA ACTUAL POR EMPLEADO
-- ============================================================
origen AS (
    SELECT
        source_name,

        numero_empleado,
        nombre_completo,
        correo_electronico,

        curp_inicio,
        fecha_nacimiento_origen,
        curp_final,

        rfc_inicio,
        rfc_homoclave,

        numero_fonacot,

        estado_civil,
        lugar_nacimiento,

        estado_empleado_codigo,

        fecha_alta,
        fecha_baja_contpaqi,
        fecha_reingreso,

        motivo_baja_contpaqi,

        salario_diario

    FROM clasificada

    WHERE rn = 1
),


-- ============================================================
-- MAPEO FINAL HACIA edulag_erp_dev.rh_empleado
-- ============================================================
mapeada AS (
    SELECT

        -- ----------------------------------------------------
        -- EMPRESA / FUENTE
        -- ----------------------------------------------------
        source_name,


        -- ----------------------------------------------------
        -- NUMERO EMPLEADO
        -- ----------------------------------------------------
        numero_empleado,


        -- ----------------------------------------------------
        -- NOMBRE
        -- ----------------------------------------------------
        nombre_completo,


        -- ----------------------------------------------------
        -- CORREO
        -- ----------------------------------------------------
        correo_electronico,


        -- ----------------------------------------------------
        -- CURP
        --
        -- curpi + YYMMDD + curpf
        -- ----------------------------------------------------
        CASE
            WHEN curp_inicio IS NOT NULL
             AND fecha_nacimiento_origen IS NOT NULL
             AND curp_final IS NOT NULL

            THEN LEFT(
                UPPER(
                    curp_inicio
                    + CONVERT(
                        char(6),
                        fecha_nacimiento_origen,
                        12
                    )
                    + curp_final
                ),
                18
            )

            ELSE NULL
        END AS curp,


        -- ----------------------------------------------------
        -- RFC
        --
        -- rfc + YYMMDD + homoclave
        -- ----------------------------------------------------
        CASE
            WHEN rfc_inicio IS NOT NULL
             AND fecha_nacimiento_origen IS NOT NULL
             AND rfc_homoclave IS NOT NULL

            THEN LEFT(
                UPPER(
                    rfc_inicio
                    + CONVERT(
                        char(6),
                        fecha_nacimiento_origen,
                        12
                    )
                    + rfc_homoclave
                ),
                20
            )

            ELSE NULL
        END AS rfc,


        -- ----------------------------------------------------
        -- FONACOT
        -- ----------------------------------------------------
        numero_fonacot,


        -- ----------------------------------------------------
        -- ESTADO CIVIL
        -- ----------------------------------------------------
        estado_civil,


        -- ----------------------------------------------------
        -- LUGAR DE NACIMIENTO
        -- ----------------------------------------------------
        lugar_nacimiento,


        -- ----------------------------------------------------
        -- ESTATUS LABORAL
        --
        -- Se conserva el codigo/valor proporcionado
        -- directamente por CONTPAQi.
        -- ----------------------------------------------------
        estado_empleado_codigo AS estatus_laboral,


        -- ----------------------------------------------------
        -- FECHA ALTA
        -- ----------------------------------------------------
        fecha_alta,


        -- ----------------------------------------------------
        -- FECHA BAJA CONTAPAQI
        --
        -- NO se utiliza fecha_baja porque esa columna
        -- pertenece a RRHH.
        -- ----------------------------------------------------
        fecha_baja_contpaqi,


        -- ----------------------------------------------------
        -- FECHA REINGRESO
        -- ----------------------------------------------------
        fecha_reingreso,


        -- ----------------------------------------------------
        -- MOTIVO BAJA CONTAPAQI
        --
        -- NO se utiliza motivo_baja porque pertenece a RRHH.
        -- ----------------------------------------------------
        motivo_baja_contpaqi,


        -- ----------------------------------------------------
        -- PERMANENCIA
        --
        -- Si existe fecha de baja:
        --   fechaalta -> fechabaja
        --
        -- Si no existe:
        --   fechaalta -> hoy
        -- ----------------------------------------------------
        CASE
            WHEN fecha_alta IS NULL
                THEN NULL

            WHEN fecha_baja_contpaqi IS NOT NULL

                THEN DATEDIFF(
                    day,
                    fecha_alta,
                    fecha_baja_contpaqi
                )

            ELSE DATEDIFF(
                day,
                fecha_alta,
                GETDATE()
            )
        END AS permanencia_dias,


        -- ----------------------------------------------------
        -- SEMANA DE BAJA
        -- ----------------------------------------------------
        CASE
            WHEN fecha_baja_contpaqi IS NOT NULL

                THEN DATEPART(
                    week,
                    fecha_baja_contpaqi
                )

            ELSE NULL
        END AS semana_baja,


        -- ----------------------------------------------------
        -- SALARIO DIARIO
        -- ----------------------------------------------------
        salario_diario

    FROM origen
)


-- ============================================================
-- RESULTADO FINAL
--
-- COLUMNAS QUE MCAAS VA A INSERTAR / ACTUALIZAR:
--
-- source_name
-- numero_empleado
-- nombre_completo
-- correo_electronico
-- curp
-- rfc
-- numero_fonacot
-- estado_civil
-- lugar_nacimiento
-- estatus_laboral
-- fecha_alta
-- fecha_baja_contpaqi
-- fecha_reingreso
-- motivo_baja_contpaqi
-- permanencia_dias
-- semana_baja
-- salario_diario
--
-- NO se devuelve id.
-- NO se devuelve empresa_id.
-- NO se devuelve area_id.
-- NO se devuelve puesto_id.
-- NO se devuelve fecha_baja.
-- NO se devuelve motivo_baja.
-- NO se devuelve transporte.
-- NO se devuelve vales.
-- ============================================================
SELECT
    source_name,

    numero_empleado,
    nombre_completo,
    correo_electronico,

    curp,
    rfc,
    numero_fonacot,

    estado_civil,
    lugar_nacimiento,
    estatus_laboral,

    fecha_alta,
    fecha_baja_contpaqi,
    fecha_reingreso,

    motivo_baja_contpaqi,

    permanencia_dias,
    semana_baja,

    salario_diario

FROM mapeada

WHERE source_name IS NOT NULL
  AND numero_empleado IS NOT NULL
  AND nombre_completo IS NOT NULL;