# Pulso N33 · Documentación

Inteligencia regional del corredor Tijuana–San Diego — Vive en la Baja.

Verificado contra el código (commit `2e66668`, 2 de octubre de 2026) y contra
la base de producción en Neon el 5 de octubre de 2026.

## Qué hay aquí

| Documento | Para quién | Qué cuenta |
|---|---|---|
| [01 · Estructura del proyecto](01-estructura.md) | Técnico | Arquitectura, árbol de carpetas, las 13 pantallas, permisos, servicios externos |
| [02 · Modelo de datos](02-datos.md) | Técnico | Los archivos de `data/`, los catálogos de `config/`, las 6 tablas de Neon con sus conteos reales, qué se borra y cuándo |
| [03 · Manual técnico](03-manual-tecnico.md) | Mantenimiento / DevOps | Entorno local, el ciclo de la ingesta, despliegue, servicio de tono, diagnóstico |
| [04 · Manual del administrador](04-manual-administrador.md) | Administrador | Accesos, interruptores y topes de gasto, catálogos de fuentes, reportes, rutina diaria |
| [05 · Manual del usuario](05-manual-usuario.md) | Uso diario | En Tendencia, Redes, Garitas, Guion, Seguimiento, Gasto electoral, dudas frecuentes |

Cada documento está además en PDF en [`pdf/`](pdf/), listo para imprimir o
enviar.

## Los diagramas, aparte

| Archivo | Para qué |
|---|---|
| [`diagramas/arquitectura.drawio`](diagramas/arquitectura.drawio) | Fuentes, cron, almacenes, Vercel y servicios externos |
| [`diagramas/neon-modelo-de-datos.drawio`](diagramas/neon-modelo-de-datos.drawio) | Las 6 tablas de Neon con sus conteos reales y sus relaciones |
| [`diagramas/ciclo-de-ingesta.drawio`](diagramas/ciclo-de-ingesta.drawio) | Los pasos del cron, gratuitos y pagados, y los dos commits |

Se abren y editan en draw.io (diagrams.net, escritorio o web). Junto a cada uno
está su `.png`, la misma imagen, para pegar en una presentación o un correo.
Los dos últimos se generan con `python docs/manuales/diagramas/generar.py`;
los PNG y los PDF, con `node docs/manuales/construir-pdf.mjs`.

## Tres cosas que conviene saber antes de leer nada

1. **Casi no hay base de datos, y es a propósito.** Las noticias, las redes,
   las tendencias y los indicadores son archivos JSON en `data/` que un robot
   de GitHub Actions escribe y commitea cada seis horas. **El historial de git
   es el archivo histórico.** Neon (Postgres) guarda solo seis tablas: quién
   entra al tablero y lo que el equipo sigue en `/seguimiento`. Una pregunta
   del tipo «cuántas notas hubo en agosto» se contesta con `data/archivo/`, no
   con SQL.
2. **El texto de los comentarios nunca entra a git.** Por ley (LFPDPPP, CPRA)
   y por las políticas de las plataformas, vive en archivos ignorados
   (`data/*-comentarios.json`) y en `cache/`, con retención de 30 días. La
   consecuencia práctica: el sitio que Vercel construye desde el repositorio
   **sale sin texto de comentarios**. El despliegue desde el runner, que sí lo
   lleva, existe pero está apagado (`DESPLEGAR_TABLERO`). Si alguien pregunta
   «¿por qué no veo los comentarios?», la respuesta empieza aquí.
3. **Cuando un panel se queda viejo, nadie recibe un correo.** Del 24 al 25 de
   septiembre las redes dejaron de actualizarse porque `APIFY_HABILITADO` se
   apagó y nadie lo volvió a encender. Hoy el cron deja una anotación de aviso
   en la corrida y `pulso validar` avisa por panel, pero hay que **mirar la
   página de Actions**. Es lo más barato de vigilar y lo que más vale de esta
   documentación (manual del administrador, §6).

## Si solo vas a leer una cosa

| Situación | Dónde |
|---|---|
| Vas a desplegar | Manual técnico, §5 |
| Un panel está viejo o vacío | Manual técnico, §7 |
| Alguien pide acceso al tablero | Manual del administrador, §2 |
| Vas a dar de alta una cuenta o un medio | Manual del administrador, §4 |
| Vas a escribir una consulta o leer `data/` | Modelo de datos, §2 y §4 |
| Acabas de entrar al equipo | Manual del usuario |

## Qué no cubre

- Las reglas para modificar el código, una por una: están en
  [`AGENTS.md`](../../AGENTS.md), y son de lectura obligatoria antes de tocar
  `pulso/`.
- Qué afirma el producto y qué se niega a afirmar: [`PRODUCT.md`](../../PRODUCT.md).
- El contrato campo por campo de cada JSON: [`docs/datos.md`](../datos.md). El
  validador (`pulso/validador.py`) manda sobre ese documento.
- Lo que pidió el cliente y cuándo: [`docs/PLAN.md`](../PLAN.md), copia
  literal del cliente.
- La receta completa de Microsoft Entra ID: [`docs/acceso.md`](../acceso.md).

Estos documentos complementan los del repositorio, no los sustituyen. La
diferencia es que éstos se escribieron leyendo el código y producción tal como
están hoy, y están ordenados por quién los lee y no por módulo.

---

Pulso N33 · Documentación · verificado el 5 de octubre de 2026 · commit `2e66668`
