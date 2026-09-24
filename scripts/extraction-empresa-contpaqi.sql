-- MCAAS_NAME=Empresa_CONTPAQi_Directa
-- MCAAS_TARGET_TABLE=nucleo_empresa
-- MCAAS_KEY_COLUMNS=id

-- ============================================================
-- MCAAS-DES
-- Extraccion: CONTPAQi Nominas -> nucleo_empresa
-- Origen: dbo.NOM10000
--
-- La identidad funcional es GUIDEmpresa -> id.
--
-- NOM10000 puede contener mas de un registro con el mismo
-- GUIDEmpresa. En ese caso se conserva solamente el registro
-- mas reciente segun TimeStamp.
--
-- Ejemplo detectado:
--   IDEmpresa 4 y 5 comparten GUIDEmpresa.
--   Se conserva IDEmpresa 5 por tener TimeStamp mas reciente.
--
-- La empresa Predeterminada con GUIDEmpresa = 0 se descarta,
-- ya que no representa un GUID valido de 36 caracteres.
--
-- Compatible con SQL Server antiguo:
--   - No usa TRY_CONVERT
--   - No usa CONCAT
-- ============================================================

;WITH base AS (
    SELECT
        IDEmpresa AS id_empresa_origen,

        -- ----------------------------------------------------
        -- IDENTIFICADOR GLOBAL
        -- ----------------------------------------------------
        UPPER(
            REPLACE(
                REPLACE(
                    LTRIM(
                        RTRIM(
                            CONVERT(varchar(40), GUIDEmpresa)
                        )
                    ),
                    '{',
                    ''
                ),
                '}',
                ''
            )
        ) AS id,

        -- ----------------------------------------------------
        -- CODIGO LOCAL
        -- ----------------------------------------------------
        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(50), IDEmpresa)
                )
            ),
            ''
        ) AS codigo,

        -- ----------------------------------------------------
        -- NOMBRES
        -- ----------------------------------------------------
        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(200), NombreEmpresa)
                    )
                ),
                ''
            ),
            200
        ) AS nombre,

        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(100), NombreCorto)
                    )
                ),
                ''
            ),
            100
        ) AS nombre_corto,

        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(255), NombreEmpresaFiscal)
                    )
                ),
                ''
            ),
            200
        ) AS nombre_fiscal,

        -- ----------------------------------------------------
        -- RFC
        -- RFC + FechaConstitucion YYMMDD + Homoclave
        -- ----------------------------------------------------
        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(10), RFC)
                )
            ),
            ''
        ) AS rfc_prefijo,

        FechaConstitucion AS fecha_constitucion,

        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(10), Homoclave)
                )
            ),
            ''
        ) AS rfc_homoclave,

        -- ----------------------------------------------------
        -- REPRESENTANTE LEGAL
        -- ----------------------------------------------------
        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(80), NombreRepresentante)
                )
            ),
            ''
        ) AS representante_nombre,

        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(80), ApPaternoRepresentante)
                )
            ),
            ''
        ) AS representante_paterno,

        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(80), ApMaternoRepresentante)
                )
            ),
            ''
        ) AS representante_materno,

        -- ----------------------------------------------------
        -- REGISTROS
        -- ----------------------------------------------------
        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(50), RegistroIMSS)
                    )
                ),
                ''
            ),
            50
        ) AS registro_patronal_imss,

        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(50), RegistroInfonavit)
                    )
                ),
                ''
            ),
            50
        ) AS registro_infonavit,

        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(50), RegistroFonacot)
                    )
                ),
                ''
            ),
            50
        ) AS registro_fonacot,

        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(100), RegimenFiscal)
                    )
                ),
                ''
            ),
            100
        ) AS regimen_fiscal,

        -- ----------------------------------------------------
        -- DOMICILIO
        -- ----------------------------------------------------
        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(500), Direccion)
                    )
                ),
                ''
            ),
            500
        ) AS direccion,

        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(150), Localidad)
                    )
                ),
                ''
            ),
            150
        ) AS localidad,

        NULLIF(
            LTRIM(
                RTRIM(
                    CONVERT(varchar(10), CodigoPostal)
                )
            ),
            ''
        ) AS codigo_postal_raw,

        -- ----------------------------------------------------
        -- TELEFONOS
        -- ----------------------------------------------------
        NULLIF(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(30), Telefono1)
                    )
                ),
                ''
            ),
            '0'
        ) AS telefono_1,

        NULLIF(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(30), Telefono2)
                    )
                ),
                ''
            ),
            '0'
        ) AS telefono_2,

        NULLIF(
            NULLIF(
                LTRIM(
                    RTRIM(
                        CONVERT(varchar(30), Telefono3)
                    )
                ),
                ''
            ),
            '0'
        ) AS telefono_3,

        -- ----------------------------------------------------
        -- FECHAS
        -- ----------------------------------------------------
        [TimeStamp] AS actualizado_en_origen,
        FechaInicioHistoria AS fecha_inicio_historia

    FROM dbo.NOM10000
),

-- ============================================================
-- DEDUPLICACION
--
-- Si varias filas comparten GUIDEmpresa:
--   1. Gana TimeStamp mas reciente.
--   2. Si TimeStamp coincide, gana IDEmpresa mayor.
-- ============================================================
clasificada AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY id
            ORDER BY
                CASE
                    WHEN actualizado_en_origen IS NULL THEN 1
                    ELSE 0
                END,
                actualizado_en_origen DESC,
                id_empresa_origen DESC
        ) AS rn
    FROM base
    WHERE NULLIF(id, '') IS NOT NULL
      AND LEN(id) = 36
),

-- ============================================================
-- SOLO UNA FILA POR EMPRESA
-- ============================================================
origen AS (
    SELECT
        id,
        codigo,
        nombre,
        nombre_corto,
        nombre_fiscal,

        rfc_prefijo,
        fecha_constitucion,
        rfc_homoclave,

        representante_nombre,
        representante_paterno,
        representante_materno,

        registro_patronal_imss,
        registro_infonavit,
        registro_fonacot,
        regimen_fiscal,

        direccion,
        localidad,
        codigo_postal_raw,

        telefono_1,
        telefono_2,
        telefono_3,

        actualizado_en_origen,
        fecha_inicio_historia

    FROM clasificada
    WHERE rn = 1
),

-- ============================================================
-- MAPEO FINAL A nucleo_empresa
-- ============================================================
mapeada AS (
    SELECT
        id,
        codigo,
        nombre,
        nombre_corto,
        nombre_fiscal,

        -- ----------------------------------------------------
        -- RFC COMPLETO
        -- ----------------------------------------------------
        CASE
            WHEN rfc_prefijo IS NOT NULL
             AND fecha_constitucion IS NOT NULL
             AND rfc_homoclave IS NOT NULL
            THEN LEFT(
                UPPER(
                    rfc_prefijo
                    + CONVERT(char(6), fecha_constitucion, 12)
                    + rfc_homoclave
                ),
                20
            )
            ELSE NULL
        END AS rfc,

        -- ----------------------------------------------------
        -- REPRESENTANTE LEGAL
        -- ----------------------------------------------------
        LEFT(
            NULLIF(
                LTRIM(
                    RTRIM(
                        COALESCE(representante_nombre, '')
                        +
                        CASE
                            WHEN representante_paterno IS NOT NULL
                                THEN ' ' + representante_paterno
                            ELSE ''
                        END
                        +
                        CASE
                            WHEN representante_materno IS NOT NULL
                                THEN ' ' + representante_materno
                            ELSE ''
                        END
                    )
                ),
                ''
            ),
            200
        ) AS representante_legal,

        registro_patronal_imss,
        registro_infonavit,
        registro_fonacot,
        regimen_fiscal,

        direccion,
        localidad,

        -- ----------------------------------------------------
        -- CODIGO POSTAL
        -- ----------------------------------------------------
        CASE
            WHEN codigo_postal_raw IS NULL
                THEN NULL

            WHEN codigo_postal_raw NOT LIKE '%[^0-9]%'
             AND LEN(codigo_postal_raw) <= 5
                THEN RIGHT(
                    '00000' + codigo_postal_raw,
                    5
                )

            ELSE LEFT(
                codigo_postal_raw,
                10
            )
        END AS codigo_postal,

        -- ----------------------------------------------------
        -- TELEFONO
        -- Toma el primero disponible
        -- ----------------------------------------------------
        LEFT(
            COALESCE(
                telefono_1,
                telefono_2,
                telefono_3
            ),
            30
        ) AS telefono,

        -- NOM10000 no contiene un campo equivalente al
        -- estado funcional de nucleo_empresa.
        CAST('ACTIVO' AS varchar(8)) AS estado,

        -- ----------------------------------------------------
        -- ULTIMA ACTUALIZACION
        -- ----------------------------------------------------
        COALESCE(
            actualizado_en_origen,
            fecha_inicio_historia,
            CONVERT(datetime, '19000101', 112)
        ) AS actualizado_en

    FROM origen
)

-- ============================================================
-- RESULTADO FINAL ENVIADO POR MCAAS-DES
-- ============================================================
SELECT
    id,
    codigo,
    nombre,
    nombre_corto,
    nombre_fiscal,
    rfc,
    representante_legal,
    registro_patronal_imss,
    registro_infonavit,
    registro_fonacot,
    regimen_fiscal,
    direccion,
    localidad,
    codigo_postal,
    telefono,
    estado,
    actualizado_en

FROM mapeada

WHERE NULLIF(id, '') IS NOT NULL
  AND LEN(id) = 36
  AND NULLIF(codigo, '') IS NOT NULL
  AND NULLIF(nombre, '') IS NOT NULL;