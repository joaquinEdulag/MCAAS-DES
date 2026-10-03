-- MCAAS_NAME=Empleado_TEQUILERA_CASA_ALAMOS
-- MCAAS_TARGET_TABLE=erp_rh_empleado
-- MCAAS_KEY_COLUMNS=source_name,numero_empleado

-- ============================================================
-- MCAAS-DES
-- EMPLEADOS TEQUILERA CASA ALAMOS
--
-- ORIGEN:
--   SQL Server
--   BD: ctNOM_TEQUILERA_CASA
--
-- TABLAS:
--   dbo.nom10001 = Empleados
--   dbo.nom10003 = Departamentos
--   dbo.nom10006 = Puestos
--
-- DESTINO:
--   MySQL / Aiven
--   BD: edulag_erp_dev
--   Tabla: erp_rh_empleado
--
-- IDENTIDAD MCAAS:
--   source_name + numero_empleado
--
-- ID AIVEN:
--   No se envia.
--   erp_rh_empleado.id es AUTO_INCREMENT.
--
-- EMPRESA:
--   Los empleados de esta extracción pertenecen exclusivamente
--   a TEQUILERA CASA ALAMOS.
--
--   empresa_id:
--   D1EEE7F0-ED97-4339-ABF3-BAC4BC260F18
--
--   Este valor corresponde a erp_nucleo_empresa.id.
--
-- IMPORTANTE:
--   No se consulta NOM10000 desde esta extracción.
--   Esto evita dependencias innecesarias contra nomGenerales
--   y elimina los problemas relacionados con IDEmpresa.
--
-- MAPEO:
--
--   nom10001.iddepartamento
--       -> nom10003.iddepartamento
--       -> nom10003.descripcion
--       -> erp_rh_empleado.area_contpaqi
--
--   nom10001.idpuesto
--       -> nom10006.idpuesto
--       -> nom10006.descripcion
--       -> erp_rh_empleado.puesto_contpaqi
--
-- NO SE MODIFICAN:
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

        -- ====================================================
        -- CONTROL INTERNO CONTAPAQI
        -- No se envia a Aiven.
        -- ====================================================
        e.idempleado AS id_empleado_contpaqi,


        -- ====================================================
        -- ORIGEN LOGICO
        -- ====================================================
        CAST('TEQUILERA_CASA_ALAMOS' AS varchar(150)) AS source_name,


        -- ====================================================
        -- EMPRESA
        --
        -- GUID definitivo de Tequilera Casa Alamos.
        -- Coincide con erp_nucleo_empresa.id.
        --
        -- Se coloca directamente porque esta extracción
        -- pertenece exclusivamente a TEQUILERA CASA ALAMOS.
        -- ====================================================
        CAST(
            'D1EEE7F0-ED97-4339-ABF3-BAC4BC260F18'
            AS varchar(36)
        ) AS empresa_id,


        -- ====================================================
        -- NUMERO DE EMPLEADO
        -- ====================================================
        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(50), e.codigoempleado)
                )
            ),
            ''
        ) AS numero_empleado,


        -- ====================================================
        -- NOMBRE COMPLETO
        -- ====================================================
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
        -- nom10003.iddepartamento
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
        -- nom10006.idpuesto
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


        -- ====================================================
        -- CORREO
        -- ====================================================
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


        -- ====================================================
        -- GENERO / SEXO
        -- ====================================================
        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(20), e.sexo)
                    )
                ),
                ''
            ),
            20
        ) AS genero_origen,


        -- ====================================================
        -- FECHA NACIMIENTO
        --
        -- Se mantiene como fecha dentro del procesamiento.
        -- Se convertira a AAAA-MM-DD antes de enviarse.
        -- ====================================================
        e.fechanacimiento AS fecha_nacimiento_origen,


        -- ====================================================
        -- COMPONENTES CURP
        -- ====================================================
        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(30), e.curpi)
                )
            ),
            ''
        ) AS curp_inicio,


        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(30), e.curpf)
                )
            ),
            ''
        ) AS curp_final,


        -- ====================================================
        -- COMPONENTES RFC
        -- ====================================================
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


        -- ====================================================
        -- FONACOT
        -- ====================================================
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


        -- ====================================================
        -- ESTADO CIVIL
        -- ====================================================
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


        -- ====================================================
        -- LUGAR NACIMIENTO
        -- ====================================================
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


        -- ====================================================
        -- ESTATUS LABORAL
        -- ====================================================
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


        -- ====================================================
        -- FECHAS LABORALES
        -- ====================================================
        e.fechaalta AS fecha_alta,

        e.fechabaja AS fecha_baja_contpaqi,

        e.fechareingreso AS fecha_reingreso,


        -- ====================================================
        -- MOTIVO BAJA CONTAPAQI
        -- ====================================================
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


        -- ====================================================
        -- SALARIO DIARIO
        -- ====================================================
        CAST(
            e.sueldodiario
            AS decimal(12, 2)
        ) AS salario_diario,


        -- ====================================================
        -- CONTROL DE ACTUALIZACION
        --
        -- No se envia a Aiven.
        -- Se utiliza para resolver duplicados.
        -- ====================================================
        e.[timestamp] AS actualizado_en_origen


    FROM [ctNOM_TEQUILERA_CASA].[dbo].[nom10001] AS e


    -- ========================================================
    -- DEPARTAMENTO
    -- ========================================================
    LEFT JOIN [ctNOM_TEQUILERA_CASA].[dbo].[nom10003] AS d
        ON d.iddepartamento = e.iddepartamento


    -- ========================================================
    -- PUESTO
    -- ========================================================
    LEFT JOIN [ctNOM_TEQUILERA_CASA].[dbo].[nom10006] AS p
        ON p.idpuesto = e.idpuesto
),


-- ============================================================
-- DEDUPLICACION
--
-- Identidad funcional:
--
--   source_name + numero_empleado
--
-- Ejemplo:
--
--   TEQUILERA_CASA_ALAMOS + 25
--
-- Si hubiera varias filas:
--
--   1. TimeStamp mas reciente.
--   2. idempleado mayor.
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
                    WHEN actualizado_en_origen IS NULL
                        THEN 1
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

        empresa_id,

        numero_empleado,

        nombre_completo,

        area_contpaqi,

        puesto_contpaqi,

        correo_electronico,

        genero_origen,

        fecha_nacimiento_origen,

        curp_inicio,

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

        -- ====================================================
        -- PROCEDENCIA
        -- ====================================================
        source_name,


        -- ====================================================
        -- EMPRESA
        -- ====================================================
        empresa_id,


        -- ====================================================
        -- EMPLEADO
        -- ====================================================
        numero_empleado,

        nombre_completo,


        -- ====================================================
        -- AREA / PUESTO CONTAPAQI
        -- ====================================================
        area_contpaqi,

        puesto_contpaqi,


        -- ====================================================
        -- CORREO
        -- ====================================================
        correo_electronico,


        -- ====================================================
        -- GENERO
        -- ====================================================
        genero_origen AS genero,


        -- ====================================================
        -- FECHA NACIMIENTO
        --
        -- Se envia como texto ISO AAAA-MM-DD.
        --
        -- Esto evita que JavaScript convierta el valor DATE
        -- mediante UTC y pueda mover un dia la fecha.
        -- ====================================================
        CASE
            WHEN fecha_nacimiento_origen IS NULL
                THEN NULL

            ELSE CONVERT(
                char(10),
                fecha_nacimiento_origen,
                23
            )
        END AS fecha_nacimiento,


        -- ====================================================
        -- CURP
        --
        -- curpi + YYMMDD + curpf
        -- ====================================================
        CASE

            WHEN curp_inicio IS NOT NULL
             AND fecha_nacimiento_origen IS NOT NULL
             AND curp_final IS NOT NULL

            THEN LEFT(

                UPPER(
                    curp_inicio
                    +
                    CONVERT(
                        char(6),
                        fecha_nacimiento_origen,
                        12
                    )
                    +
                    curp_final
                ),

                18
            )

            ELSE NULL

        END AS curp,


        -- ====================================================
        -- RFC
        --
        -- rfc + YYMMDD + homoclave
        -- ====================================================
        CASE

            WHEN rfc_inicio IS NOT NULL
             AND fecha_nacimiento_origen IS NOT NULL
             AND rfc_homoclave IS NOT NULL

            THEN LEFT(

                UPPER(
                    rfc_inicio
                    +
                    CONVERT(
                        char(6),
                        fecha_nacimiento_origen,
                        12
                    )
                    +
                    rfc_homoclave
                ),

                20
            )

            ELSE NULL

        END AS rfc,


        -- ====================================================
        -- FONACOT
        -- ====================================================
        numero_fonacot,


        -- ====================================================
        -- DATOS PERSONALES
        -- ====================================================
        estado_civil,

        lugar_nacimiento,


        -- ====================================================
        -- ESTATUS
        -- ====================================================
        estatus_laboral,


        -- ====================================================
        -- FECHA ALTA
        --
        -- Se envia AAAA-MM-DD para evitar conversion UTC.
        -- ====================================================
        CASE
            WHEN fecha_alta IS NULL
                THEN NULL

            ELSE CONVERT(
                char(10),
                fecha_alta,
                23
            )
        END AS fecha_alta,


        -- ====================================================
        -- FECHA BAJA CONTAPAQI
        -- ====================================================
        CASE
            WHEN fecha_baja_contpaqi IS NULL
                THEN NULL

            ELSE CONVERT(
                char(10),
                fecha_baja_contpaqi,
                23
            )
        END AS fecha_baja_contpaqi,


        -- ====================================================
        -- FECHA REINGRESO
        -- ====================================================
        CASE
            WHEN fecha_reingreso IS NULL
                THEN NULL

            ELSE CONVERT(
                char(10),
                fecha_reingreso,
                23
            )
        END AS fecha_reingreso,


        -- ====================================================
        -- MOTIVO BAJA
        -- ====================================================
        motivo_baja_contpaqi,


        -- ====================================================
        -- SALARIO
        -- ====================================================
        salario_diario

    FROM origen
)


-- ============================================================
-- RESULTADO FINAL
--
-- MCAAS enviara solamente estos campos.
--
-- NO SE ENVIA:
--
--   id
--   area_id
--   puesto_id
--   fecha_baja
--   motivo_baja
--   transporte
--   vales
--
-- erp_rh_empleado.id:
--   generado por AUTO_INCREMENT.
--
-- Identidad MCAAS:
--
--   source_name + numero_empleado
--
-- Esto permite actualizar las filas ya existentes.
-- ============================================================
SELECT

    source_name,

    empresa_id,

    numero_empleado,

    nombre_completo,

    area_contpaqi,

    puesto_contpaqi,

    correo_electronico,

    genero,

    fecha_nacimiento,

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

  AND empresa_id IS NOT NULL

  AND LEN(empresa_id) = 36

  AND numero_empleado IS NOT NULL

  AND nombre_completo IS NOT NULL;