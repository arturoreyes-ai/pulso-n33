-- Los codigos y los tokens de refresco del MCP de gasto (lib/mcp/oauth/).
--
-- El 26 de octubre de 2026 el MCP dejo de aceptar una llave en la URL: la
-- especificacion de MCP prohibe tokens en la query y Anthropic pide lo mismo
-- a un conector. Lo reemplaza OAuth con el tablero como su propio servidor de
-- autorizacion: quien conecta su Claude entra con la cuenta de Microsoft
-- Entra del tablero, y solo un administrador aprobado recibe token.
--
-- El token de ACCESO no se guarda: es firmado y dura una hora
-- (lib/mcp/oauth/claves.ts), y se revoca solo con quitarle a la persona el
-- rol o la cuenta, porque cada peticion vuelve a leer `usuarios`. Lo que si se
-- guarda es lo que tiene que poder usarse UNA vez: el codigo de autorizacion
-- (dos minutos) y el token de refresco (30 dias, rotado en cada uso). De los
-- dos solo la huella sha256, nunca el valor: quien lea esta tabla no puede
-- canjear nada.
--
-- `familia` agrupa un refresco con los que nacen de el. Si llega uno ya
-- usado, alguien lo copio: se quema la familia entera y esa conexion tiene
-- que volver a entrar (OAuth 2.1, deteccion de reuso).
--
-- Idempotente como las demas: el runner ejecuta todo db/ en cada corrida.

CREATE TABLE IF NOT EXISTS mcp_oauth (
  huella        char(64) PRIMARY KEY,
  tipo          varchar(8) NOT NULL,
  usuario_id    integer NOT NULL,
  cliente_id    text NOT NULL,
  -- Solo en un codigo: a donde se entrego y el desafio PKCE (S256).
  redirect_uri  text,
  desafio       varchar(64),
  recurso       text NOT NULL,
  familia       uuid NOT NULL,
  expira_en     timestamptz NOT NULL,
  usado_en      timestamptz,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_oauth_tipo_check CHECK (tipo IN ('codigo', 'refresco'))
);

CREATE INDEX IF NOT EXISTS mcp_oauth_expira_en ON mcp_oauth (expira_en);
CREATE INDEX IF NOT EXISTS mcp_oauth_familia ON mcp_oauth (familia);
