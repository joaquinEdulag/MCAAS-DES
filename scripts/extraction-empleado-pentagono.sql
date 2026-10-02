-- MCAAS_NAME=Empleado_PENTAGONO_AGRICOLA
-- MCAAS_TARGET_TABLE=rh_empleado
-- MCAAS_KEY_COLUMNS=source_name,numero_empleado

-- ============================================================
-- MCAAS-DES
-- EMPLEADOS PENTAGONO AGRICOLA
--
-- ORIGEN:
--   SQL Server
--   BD: ctPentagono_Agric
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
-- Se sincroniza tambien:
--   empresa_id = GUIDEmpresa de dbo.NOM10000.
--   Debe coincidir con nucleo_empresa.id cargado por extraction-empresa-contpaqi.sql.
--   GUID esperado para esta empresa: E0DA7FED-2B95-41F1-B81D-54260A680800.
--   Si NOM10000 no devuelve ese GUID, la extraccion devuelve 0 empleados
--   para evitar relacionarlos con una empresa incorrecta.
--
-- NO se modifican:
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


;WITH empresa_actual AS (
    SELECT TOP (1)
        UPPER(
            REPLACE(
                REPLACE(
                    LTRIM(RTRIM(CONVERT(varchar(40), GUIDEmpresa))),
                    '{',
                    ''
                ),
                '}',
                ''
            )
        ) AS empresa_id
    FROM [ctPentagono_Agric].[dbo].[NOM10000]
    WHERE LEN(
        UPPER(
            REPLACE(
                REPLACE(
                    LTRIM(RTRIM(CONVERT(varchar(40), GUIDEmpresa))),
                    '{',
                    ''
                ),
                '}',
                ''
            )
        )
    ) = 36
      AND UPPER(
            REPLACE(
                REPLACE(
                    LTRIM(RTRIM(CONVERT(varchar(40), GUIDEmpresa))),
                    '{',
                    ''
                ),
                '}',
                ''
            )
          ) = 'E0DA7FED-2B95-41F1-B81D-54260A680800'
    ORDER BY
        CASE WHEN [TimeStamp] IS NULL THEN 1 ELSE 0 END,
        [TimeStamp] DESC,
        IDEmpresa DESC
),
base AS (
    SELECT

        -- ----------------------------------------------------
        -- CONTROL INTERNO CONTAPAQI
        -- No se envia a Aiven.
        -- ----------------------------------------------------
        e.idempleado AS id_empleado_contpaqi,


        -- ----------------------------------------------------
        -- ORIGEN
        -- ----------------------------------------------------
        CAST('PENTAGONO_AGRICOLA' AS varchar(150)) AS source_name,


        -- ----------------------------------------------------
        -- EMPRESA ERP
        -- Mismo GUID utilizado por nucleo_empresa.id.
        -- ----------------------------------------------------
        empresa.empresa_id AS empresa_id,


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
        -- GENERO / SEXO CONTAPAQI
        -- ----------------------------------------------------
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


    FROM [ctPentagono_Agric].[dbo].[nom10001] AS e


    -- ========================================================
    -- DEPARTAMENTOS
    -- ========================================================
    LEFT JOIN [ctPentagono_Agric].[dbo].[nom10003] AS d
        ON d.iddepartamento = e.iddepartamento


    -- ========================================================
    -- PUESTOS
    -- ========================================================
    LEFT JOIN [ctPentagono_Agric].[dbo].[nom10006] AS p
        ON p.idpuesto = e.idpuesto

    CROSS JOIN empresa_actual AS empresa
),


-- ============================================================
-- DEDUPLICACION EMPLEADOS
--
-- Una fila por:
--
--   PENTAGONO_AGRICOLA + numero_empleado
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

        source_name,
        empresa_id,

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
        -- GENERO
        -- Fuente maestra: CONTPAQI
        -- ----------------------------------------------------
        genero_origen AS genero,


        -- ----------------------------------------------------
        -- FECHA DE NACIMIENTO
        -- Fuente maestra: CONTPAQI
        -- ----------------------------------------------------
        -- Se envia como texto AAAA-MM-DD para conservar la fecha de calendario.
        -- No se suma +1: se evita que Node convierta un DATE a otra zona horaria.
        CONVERT(char(10), fecha_nacimiento_origen, 23) AS fecha_nacimiento,

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

        -- Las columnas destino son DATE. Se envian como AAAA-MM-DD para que
        -- el puente no las transforme mediante objetos Date/UTC de JavaScript.
        CONVERT(char(10), fecha_alta, 23) AS fecha_alta,

        CONVERT(char(10), fecha_baja_contpaqi, 23) AS fecha_baja_contpaqi,

        CONVERT(char(10), fecha_reingreso, 23) AS fecha_reingreso,

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
-- empresa_id se actualiza siempre con el GUID real de la empresa.
-- area_id / puesto_id NO se modifican.
--
-- Se actualizan:
--   area_contpaqi
--   puesto_contpaqi
-- junto con los demás campos maestros de CONTPAQi.
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
  AND numero_empleado IS NOT NULL
  AND nombre_completo IS NOT NULL;