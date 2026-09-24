-- MCAAS_NAME=Empleado_EDULAG
-- MCAAS_TARGET_TABLE=rh_empleado
-- MCAAS_KEY_COLUMNS=source_name,numero_empleado

-- ============================================================
-- MCAAS-DES
-- EMPLEADOS EDULAG
--
-- ORIGEN:
--   SQL Server
--   BD: ctNOM_Edulag_2021
--
-- TABLAS:
--   dbo.nom10001 = Empleados
--   dbo.nom10003 = Departamentos
--   dbo.nom10006 = Puestos
--
-- DESTINO:
--   MySQL / Aiven
--   BD: edulag_erp_dev
--   Tabla: rh_empleado
--
-- IDENTIDAD MCAAS:
--   source_name + numero_empleado
--
-- ID DE AIVEN:
--   No se envia.
--   rh_empleado.id es AUTO_INCREMENT.
--
-- MAPEO ESTRUCTURA CONTAPAQI:
--
--   nom10001.iddepartamento
--          -> nom10003.iddepartamento
--          -> nom10003.descripcion
--          -> rh_empleado.area_contpaqi
--
--   nom10001.idpuesto
--          -> nom10006.idpuesto
--          -> nom10006.descripcion
--          -> rh_empleado.puesto_contpaqi
--
-- NO se modifican:
--   empresa_id
--   area_id
--   puesto_id
--   fecha_baja
--   motivo_baja
--   transporte
--   vales
--
-- Compatible con SQL Server antiguo:
--   No utiliza TRY_CONVERT
--   No utiliza CONCAT
-- ============================================================


;WITH base AS (
    SELECT

        -- ----------------------------------------------------
        -- CONTROL INTERNO CONTAPAQI
        -- No se envia a Aiven.
        -- ----------------------------------------------------
        e.idempleado AS id_empleado_contpaqi,


        -- ----------------------------------------------------
        -- ORIGEN
        -- ----------------------------------------------------
        CAST('EDULAG' AS varchar(150)) AS source_name,


        -- ----------------------------------------------------
        -- NUMERO EMPLEADO
        -- ----------------------------------------------------
        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(50), e.codigoempleado)
                )
            ),
            ''
        ) AS numero_empleado,


        -- ----------------------------------------------------
        -- NOMBRE
        -- ----------------------------------------------------
        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(250), e.nombrelargo)
                    )
                ),
                ''
            ),
            250
        ) AS nombre_completo,


        -- ====================================================
        -- AREA CONTAPAQI
        --
        -- nom10001.iddepartamento
        --       ->
        -- nom10003.descripcion
        -- ====================================================
        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(200), d.descripcion)
                    )
                ),
                ''
            ),
            200
        ) AS area_contpaqi,


        -- ====================================================
        -- PUESTO CONTAPAQI
        --
        -- nom10001.idpuesto
        --       ->
        -- nom10006.descripcion
        -- ====================================================
        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(200), p.descripcion)
                    )
                ),
                ''
            ),
            200
        ) AS puesto_contpaqi,


        -- ----------------------------------------------------
        -- CORREO
        -- ----------------------------------------------------
        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(254), e.CorreoElectronico)
                    )
                ),
                ''
            ),
            254
        ) AS correo_electronico,


        -- ----------------------------------------------------
        -- COMPONENTES CURP
        -- ----------------------------------------------------
        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(30), e.curpi)
                )
            ),
            ''
        ) AS curp_inicio,

        e.fechanacimiento AS fecha_nacimiento_origen,

        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(30), e.curpf)
                )
            ),
            ''
        ) AS curp_final,


        -- ----------------------------------------------------
        -- COMPONENTES RFC
        -- ----------------------------------------------------
        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(30), e.rfc)
                )
            ),
            ''
        ) AS rfc_inicio,

        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(20), e.homoclave)
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
                        CONVERT(varchar(50), e.NumeroFonacot)
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
                        CONVERT(varchar(50), e.estadocivil)
                    )
                ),
                ''
            ),
            50
        ) AS estado_civil,


        -- ----------------------------------------------------
        -- LUGAR NACIMIENTO
        -- ----------------------------------------------------
        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(150), e.lugarnacimiento)
                    )
                ),
                ''
            ),
            150
        ) AS lugar_nacimiento,


        -- ----------------------------------------------------
        -- ESTATUS LABORAL
        -- ----------------------------------------------------
        UPPER(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(50), e.estadoempleado)
                    )
                ),
                ''
            )
        ) AS estatus_laboral,


        -- ----------------------------------------------------
        -- FECHAS
        -- ----------------------------------------------------
        e.fechaalta AS fecha_alta,

        e.fechabaja AS fecha_baja_contpaqi,

        e.fechareingreso AS fecha_reingreso,


        -- ----------------------------------------------------
        -- MOTIVO BAJA CONTAPAQI
        -- ----------------------------------------------------
        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(255), e.causabaja)
                    )
                ),
                ''
            ),
            255
        ) AS motivo_baja_contpaqi,


        -- ----------------------------------------------------
        -- SALARIO
        -- ----------------------------------------------------
        CAST(
            e.sueldodiario
            AS decimal(12, 2)
        ) AS salario_diario,


        -- ----------------------------------------------------
        -- CONTROL DE ACTUALIZACION
        -- No se envia.
        -- ----------------------------------------------------
        e.[timestamp] AS actualizado_en_origen


    FROM [ctNOM_Edulag_2021].[dbo].[nom10001] AS e


    -- ========================================================
    -- DEPARTAMENTOS
    -- ========================================================
    LEFT JOIN [ctNOM_Edulag_2021].[dbo].[nom10003] AS d
        ON d.iddepartamento = e.iddepartamento


    -- ========================================================
    -- PUESTOS
    -- ========================================================
    LEFT JOIN [ctNOM_Edulag_2021].[dbo].[nom10006] AS p
        ON p.idpuesto = e.idpuesto
),


-- ============================================================
-- DEDUPLICACION EMPLEADOS
--
-- Una fila por:
--
--   EDULAG + numero_empleado
--
-- Si existieran varias:
--   timestamp mas reciente
--   y después idempleado mayor.
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
-- UNA FILA ACTUAL POR EMPLEADO
-- ============================================================
origen AS (
    SELECT
        source_name,

        numero_empleado,
        nombre_completo,

        area_contpaqi,
        puesto_contpaqi,

        correo_electronico,

        curp_inicio,
        fecha_nacimiento_origen,
        curp_final,

        rfc_inicio,
        rfc_homoclave,

        numero_fonacot,

        estado_civil,
        lugar_nacimiento,

        estatus_laboral,

        fecha_alta,
        fecha_baja_contpaqi,
        fecha_reingreso,

        motivo_baja_contpaqi,

        salario_diario

    FROM clasificada

    WHERE rn = 1
),


-- ============================================================
-- MAPEO FINAL A AIVEN
-- ============================================================
mapeada AS (
    SELECT

        source_name,

        numero_empleado,

        nombre_completo,


        -- ----------------------------------------------------
        -- AREA / PUESTO CONTAPAQI
        -- ----------------------------------------------------
        area_contpaqi,

        puesto_contpaqi,


        -- ----------------------------------------------------
        -- CORREO
        -- ----------------------------------------------------
        correo_electronico,


        -- ----------------------------------------------------
        -- CURP
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


        numero_fonacot,

        estado_civil,

        lugar_nacimiento,

        estatus_laboral,

        fecha_alta,

        fecha_baja_contpaqi,

        fecha_reingreso,

        motivo_baja_contpaqi,

        salario_diario

    FROM origen
)


-- ============================================================
-- RESULTADO FINAL
--
-- id NO se envia.
-- Aiven lo genera mediante AUTO_INCREMENT.
--
-- area_id / puesto_id NO se modifican.
--
-- Se actualizan:
--   area_contpaqi
--   puesto_contpaqi
-- junto con los demás campos maestros de CONTPAQi.
-- ============================================================
SELECT
    source_name,

    numero_empleado,

    nombre_completo,

    area_contpaqi,

    puesto_contpaqi,

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

    salario_diario

FROM mapeada

WHERE source_name IS NOT NULL
  AND numero_empleado IS NOT NULL
  AND nombre_completo IS NOT NULL;