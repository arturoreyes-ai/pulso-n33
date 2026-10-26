-- Lo que cuesta cada llamada a un modelo de Anthropic (lib/uso/modelo.ts).
--
-- Hasta el 26 de octubre de 2026 el tablero llamaba al modelo en seis
-- lugares —Analizar, la lectura de un post, el informe de una consulta, el
-- guion, Detallar y el resumen de /seguimiento— y nadie anotaba cuanto: Apify
-- tiene libro (0002, 0003) y cobro propio que se puede consultar, Anthropic
-- no tenia ninguno. El presidente de la empresa pidio ver lo que cuesta cada
-- accion desde su Claude (el MCP de app/api/mcp), y sin esta tabla la mitad
-- de la respuesta seria una estimacion.
--
-- Guarda cifras y nada mas: ni el texto que se mando, ni lo que contesto el
-- modelo, ni el termino buscado. `accion` es una etiqueta fija del codigo
-- («analizar», «guion:noticias33»…), nunca algo que escribio alguien.
--
-- `usd` se calcula al escribir con el precio de lista de ese dia
-- (lib/uso/modelo.ts::PRECIOS); si el precio cambia, las filas viejas
-- conservan lo que costaron entonces. Por eso tambien se guardan los tokens:
-- con ellos se puede recalcular.
--
-- Idempotente como las demas: el runner ejecuta todo db/ en cada corrida.

CREATE TABLE IF NOT EXISTS uso_modelo (
  id                      bigserial PRIMARY KEY,
  accion                  varchar(48) NOT NULL,
  -- El modelo que CONTESTO, no el pedido: una negativa reintentada en el de
  -- respaldo es otra fila, con su propio modelo.
  modelo                  varchar(64) NOT NULL,
  -- Sin llave foranea, como 0002 y 0003: el modo sin Entra usa el id 0. Nulo
  -- cuando la llamada no vino de una sesion (un script, una prueba).
  usuario_id              integer,
  tokens_entrada          integer NOT NULL DEFAULT 0,
  tokens_salida           integer NOT NULL DEFAULT 0,
  tokens_cache_escritura  integer NOT NULL DEFAULT 0,
  tokens_cache_lectura    integer NOT NULL DEFAULT 0,
  usd                     numeric(10, 6) NOT NULL,
  -- Una negativa tambien se cobra: se anota, y se dice que lo fue.
  negativa                boolean NOT NULL DEFAULT false,
  creado_en               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uso_modelo_creado_en ON uso_modelo (creado_en);
