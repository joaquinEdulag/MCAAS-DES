-- MCAAS_NAME=Empresa_CONTPAQi_Directa
-- MCAAS_TARGET_TABLE=nucleo_empresa
-- MCAAS_KEY_COLUMNS=id

-- Extraccion directa CONTPAQi Nominas -> nucleo_empresa.
--
-- Mapeo aplicado contra la estructura REAL de nucleo_empresa:
--   GUIDEmpresa                                      -> id
--   CodigoERP                                        -> codigo
--   NombreEmpresa                                    -> nombre
--   NombreCorto                                      -> nombre_corto
--   NombreEmpresaFiscal                              -> nombre_fiscal
--   RFC + FechaConstitucion (YYMMDD) + Homoclave     -> rfc
--   RepresentanteLegalERP / nombre + apellidos       -> representante_legal
--   RegistroIMSS                                     -> registro_patronal_imss
--   RegistroInfonavit                                -> registro_infonavit
--   RegistroFonacot                                  -> registro_fonacot
--   RegimenFiscal                                    -> regimen_fiscal
--   Direccion                                        -> direccion
--   Localidad                                        -> localidad
--   CodigoPostal                                     -> codigo_postal
--   TelefonoPrincipalERP / Telefono1/2/3             -> telefono
--   EstadoERP                                        -> estado
--   TimeStamp                                        -> actualizado_en
--
-- No se envia creado_en porque el destino ya define CURRENT_TIMESTAMP(3).
-- source_name tampoco forma parte de este SELECT. Para este flujo configure
-- INCLUDE_SOURCE_NAME=false en .env.
--
-- IMPORTANTE SOBRE RFC:
-- No se usa RFCCompletoERP. El RFC se reconstruye directamente con los tres
-- componentes de CONTPAQi: RFC + FechaConstitucion en YYMMDD + Homoclave.

;WITH origen AS (
    SELECT
        UPPER(REPLACE(REPLACE(LTRIM(RTRIM(CONVERT(varchar(40), GUIDEmpresa))), '{', ''), '}', '')) AS id,
        LEFT(NULLIF(LTRIM(RTRIM(CONVERT(varchar(50), CodigoERP))), ''), 50) AS codigo,
        LEFT(NULLIF(LTRIM(RTRIM(CONVERT(varchar(200), NombreEmpresa))), ''), 200) AS nombre,
        LEFT(NULLIF(LTRIM(RTRIM(CONVERT(varchar(100), NombreCorto))), ''), 100) AS nombre_corto,
        LEFT(NULLIF(LTRIM(RTRIM(CONVERT(varchar(200), NombreEmpresaFiscal))), ''), 200) AS nombre_fiscal,

        NULLIF(LTRIM(RTRIM(CONVERT(varchar(4), RFC))), '') AS rfc_prefijo,
        TRY_CONVERT(date, FechaConstitucion) AS fecha_constitucion,
        NULLIF(LTRIM(RTRIM(CONVERT(varchar(4), Homoclave))), '') AS rfc_homoclave,

        LEFT(NULLIF(LTRIM(RTRIM(CONVERT(varchar(200), RepresentanteLegalERP))), ''), 200) AS representante_legal_erp,
        NULLIF(LTRIM(RTRIM(CONVERT(varchar(40), NombreRepresentante))), '') AS representante_nombre,
        NULLIF(LTRIM(RTRIM(CONVERT(varchar(40), ApPaternoRepresentante))), '') AS representante_paterno,
        NULLIF(LTRIM(RTRIM(CONVERT(varchar(40), ApMaternoRepresentante))), '') AS representante_materno,

        LEFT(NULLIF(LTRIM(RTRIM(CONVERT(varchar(50), RegistroIMSS))), ''), 50) AS registro_patronal_imss,
        LEFT(NULLIF(LTRIM(RTRIM(CONVERT(varchar(50), RegistroInfonavit))), ''), 50) AS registro_infonavit,
        LEFT(NULLIF(LTRIM(RTRIM(CONVERT(varchar(50), RegistroFonacot))), ''), 50) AS registro_fonacot,
        LEFT(NULLIF(LTRIM(RTRIM(CONVERT(varchar(100), RegimenFiscal))), ''), 100) AS regimen_fiscal,

        LEFT(NULLIF(LTRIM(RTRIM(CONVERT(varchar(500), Direccion))), ''), 500) AS direccion,
        LEFT(NULLIF(LTRIM(RTRIM(CONVERT(varchar(150), Localidad))), ''), 150) AS localidad,
        NULLIF(LTRIM(RTRIM(CONVERT(varchar(10), CodigoPostal))), '') AS codigo_postal_raw,

        NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(varchar(30), TelefonoPrincipalERP))), ''), '0') AS telefono_principal_erp,
        NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(varchar(30), Telefono1))), ''), '0') AS telefono_1,
        NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(varchar(30), Telefono2))), ''), '0') AS telefono_2,
        NULLIF(NULLIF(LTRIM(RTRIM(CONVERT(varchar(30), Telefono3))), ''), '0') AS telefono_3,

        UPPER(NULLIF(LTRIM(RTRIM(CONVERT(varchar(20), EstadoERP))), '')) AS estado_erp,
        TRY_CONVERT(datetime2(3), [TimeStamp]) AS actualizado_en_origen,
        TRY_CONVERT(datetime2(3), FechaInicioHistoria) AS fecha_inicio_historia
    FROM dbo.NOM10000
),
mapeada AS (
    SELECT
        id,
        codigo,
        nombre,
        nombre_corto,
        nombre_fiscal,

        CASE
            WHEN rfc_prefijo IS NOT NULL
             AND fecha_constitucion IS NOT NULL
             AND rfc_homoclave IS NOT NULL
            THEN LEFT(
                UPPER(CONCAT(
                    rfc_prefijo,
                    CONVERT(char(6), fecha_constitucion, 12),
                    rfc_homoclave
                )),
                20
            )
            ELSE NULL
        END AS rfc,

        LEFT(
            COALESCE(
                representante_legal_erp,
                NULLIF(
                    LTRIM(RTRIM(CONCAT(
                        representante_nombre,
                        CASE WHEN representante_paterno IS NOT NULL THEN CONCAT(' ', representante_paterno) ELSE '' END,
                        CASE WHEN representante_materno IS NOT NULL THEN CONCAT(' ', representante_materno) ELSE '' END
                    ))),
                    ''
                )
            ),
            200
        ) AS representante_legal,

        registro_patronal_imss,
        registro_infonavit,
        registro_fonacot,
        regimen_fiscal,
        direccion,
        localidad,

        CASE
            WHEN codigo_postal_raw IS NULL THEN NULL
            WHEN codigo_postal_raw NOT LIKE '%[^0-9]%'
             AND LEN(codigo_postal_raw) <= 5
            THEN RIGHT('00000' + codigo_postal_raw, 5)
            ELSE LEFT(codigo_postal_raw, 10)
        END AS codigo_postal,

        LEFT(COALESCE(telefono_principal_erp, telefono_1, telefono_2, telefono_3), 30) AS telefono,

        CAST(
            CASE
                WHEN estado_erp = 'INACTIVO' THEN 'INACTIVO'
                ELSE 'ACTIVO'
            END
            AS varchar(8)
        ) AS estado,

        COALESCE(
            actualizado_en_origen,
            fecha_inicio_historia,
            CAST('19000101' AS datetime2(3))
        ) AS actualizado_en
    FROM origen
)
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
