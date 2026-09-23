-- El libro de gasto de la busqueda PAGADA en redes (lib/redes-en-vivo/libro.ts).
--
-- No es dato del producto, y por eso no vive en data/: es contabilidad. Cada
-- fila es una busqueda que alguien pidio desde el boton de Redes, con lo que
-- costo. Existe porque una funcion de Vercel no guarda estado entre
-- peticiones, y sin un lugar comun los dos topes que el cliente fijo el 23 de
-- septiembre de 2026 (50 USD al mes, diez busquedas por persona al dia) no se
-- podrian sostener: dos peticiones simultaneas verian cada una el mes vacio.
--
-- Lo que NO guarda, y es la mitad del diseno. Ni el termino ni una palabra de
-- lo que se encontro. `clave` es un HMAC del termino plegado con AUTH_SECRET,
-- asi que sin el secreto la tabla no dice a quien se busco, y el texto de los
-- comentarios vive solo en el conjunto de datos de la corrida de Apify y en
-- transito, como el de la cosecha programada. `corridas` guarda los ids de las
-- corridas, sus fases y lo que costo cada una.
--
-- Idempotente como 0001: el runner ejecuta todo db/ en cada corrida.

CREATE TABLE IF NOT EXISTS busquedas_redes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave         char(64) NOT NULL,
  -- Sin llave foranea a usuarios: el modo sin Entra de desarrollo usa un
  -- usuario sintetico con id 0, que no esta en la tabla.
  usuario_id    integer NOT NULL,
  estado        varchar(20) NOT NULL DEFAULT 'buscando',
  corridas      jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Lo que se reserva al empezar (el peor caso de las seis corridas) y lo
  -- que de verdad cobro Apify al terminar. Mientras no termina, el tope del
  -- mes cuenta la reserva.
  tope_usd      numeric(8, 4) NOT NULL,
  usd           numeric(8, 4) NOT NULL DEFAULT 0,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  terminado_en  timestamptz,
  CONSTRAINT busquedas_redes_estado_check CHECK (estado IN ('buscando', 'listo', 'fallo'))
);

CREATE INDEX IF NOT EXISTS busquedas_redes_clave ON busquedas_redes (clave, creado_en DESC);

CREATE INDEX IF NOT EXISTS busquedas_redes_creado ON busquedas_redes (creado_en);
