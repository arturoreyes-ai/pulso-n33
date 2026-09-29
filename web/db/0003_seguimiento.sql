-- El seguimiento de publicaciones (/seguimiento, lib/seguimiento/).
--
-- Es la primera tabla de la base que guarda algo que se ve en pantalla. Hasta
-- el 28 de septiembre de 2026 solo habia usuarios y el libro de gasto de la
-- busqueda en vivo, y todo lo del producto vivia en data/*.json con git como
-- archivo (AGENTS.md). Aqui no puede: la lista la arma quien usa el tablero,
-- desde un boton, y el pipeline no recibe nada de la pantalla.
--
-- Lo que decidio el cliente ese dia, y lo que cada tabla sostiene de eso:
--
--  - Una lista COMPARTIDA por el equipo: `seguimientos` no se filtra por
--    persona; `usuario_id` dice quien la agrego y nada mas.
--  - Cada actualizacion se paga al pulsar un boton, con un tope PROPIO, fuera
--    de los 50 USD de la busqueda en vivo: `gasto_seguimiento` es ese libro.
--    Va aparte de las actualizaciones a proposito: borrar una publicacion
--    borra su historia, y si el gasto se fuera con ella, borrar y volver a
--    agregar liberaria el tope del mes.
--  - El texto de los comentarios se guarda 15 dias y se borra solo; antes, si
--    alguien deja de seguir la publicacion. `seguimiento_comentarios` guarda
--    el texto y nada de quien lo escribio: ni nombre, ni usuario, ni id de la
--    red, ni foto. `huella` es sha256(url|texto plegado)[:16], la misma llave
--    que el pipeline (pulso/redes.py::_id_comentario), y no identifica a
--    nadie. Nunca llega a git.
--
-- Idempotente como 0001 y 0002: el runner ejecuta todo db/ en cada corrida.

CREATE TABLE IF NOT EXISTS seguimientos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  red           varchar(12) NOT NULL,
  -- La URL CANONICA (lib/dominio/publicaciones.ts::canonizarPublicacion): la
  -- misma publicacion pegada con otro parametro de rastreo no se sigue dos
  -- veces.
  url           text NOT NULL UNIQUE,
  -- Lo DECLARA quien la agrega; nunca se adivina del texto (AGENTS.md, regla
  -- de idioma). En ingles no se pide tono: el modelo solo habla espanol.
  idioma        char(2) NOT NULL DEFAULT 'es',
  -- La primera linea del pie, como en las otras redes. Llega con la primera
  -- actualizacion que lee la publicacion.
  titulo        text,
  -- Solo TikTok: el @ de quien publico, que la URL ya trae y el cliente
  -- decidio publicar el 8 de septiembre de 2026.
  creador       varchar(64),
  publicado     timestamptz,
  tipo          varchar(12),
  -- Sin llave foranea a usuarios: el modo sin Entra de desarrollo usa un
  -- usuario sintetico con id 0, que no esta en la tabla (como 0002).
  usuario_id    integer NOT NULL,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seguimientos_red_check CHECK (red IN ('instagram', 'tiktok', 'facebook')),
  CONSTRAINT seguimientos_idioma_check CHECK (idioma IN ('es', 'en'))
);

CREATE TABLE IF NOT EXISTS gasto_seguimiento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    integer NOT NULL,
  -- Lo que se reserva al pulsar (el peor caso de las dos corridas) y lo que
  -- de verdad cobro Apify al terminar. Mientras no termina, el tope del mes
  -- cuenta la reserva: es el peor caso, y es el que el tope tiene que cubrir.
  tope_usd      numeric(8, 4) NOT NULL,
  usd           numeric(8, 4) NOT NULL DEFAULT 0,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  terminado_en  timestamptz
);

CREATE INDEX IF NOT EXISTS gasto_seguimiento_creado ON gasto_seguimiento (creado_en);

CREATE TABLE IF NOT EXISTS seguimiento_actualizaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seguimiento_id  uuid NOT NULL REFERENCES seguimientos (id) ON DELETE CASCADE,
  gasto_id        uuid NOT NULL REFERENCES gasto_seguimiento (id),
  estado          varchar(20) NOT NULL DEFAULT 'leyendo',
  -- Los ids de las dos corridas de Apify y sus conjuntos de datos. Nada de lo
  -- que traen: eso se limpia y se guarda abajo, y el conjunto de datos se
  -- borra de Apify en cuanto se guardo (traia la identidad de quien comento).
  corridas        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Cuando una peticion gano el derecho a guardar; si murio, otra lo retoma.
  reclamada_en    timestamptz,
  -- Lo que la red decia de la publicacion en ese momento: likes, comentarios,
  -- reproducciones, compartidos, guardados. null en un campo es «sin dato»,
  -- nunca cero.
  metricas        jsonb,
  -- Cuantos comentarios trajo esta lectura y cuantos no se habian visto.
  leidos          integer,
  nuevos          integer,
  -- El tono de los comentarios que trajo ESTA lectura, en conteos. Sobrevive
  -- al borrado del texto: son cuentas, no lo que alguien escribio.
  tono            jsonb,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  terminado_en    timestamptz,
  CONSTRAINT seguimiento_actualizaciones_estado_check CHECK (estado IN ('leyendo', 'guardando', 'listo', 'fallo'))
);

CREATE INDEX IF NOT EXISTS seguimiento_actualizaciones_seguimiento ON seguimiento_actualizaciones (seguimiento_id, creado_en DESC);

CREATE TABLE IF NOT EXISTS seguimiento_comentarios (
  seguimiento_id  uuid NOT NULL REFERENCES seguimientos (id) ON DELETE CASCADE,
  huella          char(16) NOT NULL,
  -- Con las menciones enmascaradas («@…») y recortado a 300 caracteres, como
  -- lo publica el pipeline (pulso/redes.py::publicar_comentarios).
  texto           text NOT NULL,
  likes           integer NOT NULL DEFAULT 0,
  -- Cuando se escribio, segun la red. Ordena «lo mas reciente».
  escrito_en      timestamptz,
  sentimiento     varchar(10),
  -- La primera lectura que lo trajo, para marcar lo nuevo, y la ultima, que
  -- es la que cuenta para los 15 dias: un comentario que la red sigue
  -- mostrando se vuelve a leer y su copia es de hoy, igual que en cache/.
  primera_vez     timestamptz NOT NULL DEFAULT now(),
  cosechado_en    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (seguimiento_id, huella),
  CONSTRAINT seguimiento_comentarios_sentimiento_check CHECK (sentimiento IS NULL OR sentimiento IN ('positivo', 'negativo', 'neutral'))
);

CREATE INDEX IF NOT EXISTS seguimiento_comentarios_cosechado ON seguimiento_comentarios (cosechado_en);
