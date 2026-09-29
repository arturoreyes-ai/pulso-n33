-- «Lo que dicen los comentarios» de cada lectura del seguimiento
-- (lib/analisis/seguimiento.ts), pedido por el cliente el 29 de septiembre de
-- 2026 con el «Customers say» de Amazon como ejemplo.
--
-- Va en la fila de la actualizacion que lo pago y no en una tabla propia: es
-- de esa lectura, y borrar la publicacion lo borra con ella (ON DELETE
-- CASCADE de 0003). Es derivado del texto de los comentarios, asi que vive lo
-- mismo que el texto: almacen.ts::purgar lo pone en NULL a los 15 dias.
-- Forma: {"texto": "...", "leidos": 11, "generado": "2026-09-29T..."}.
--
-- Idempotente como las demas: el runner ejecuta todo db/ en cada corrida.
-- Aplicado en produccion el 29 de septiembre de 2026.

ALTER TABLE seguimiento_actualizaciones ADD COLUMN IF NOT EXISTS resumen jsonb;
