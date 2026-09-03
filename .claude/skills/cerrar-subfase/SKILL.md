---
name: cerrar-subfase
description: Ejecuta el cierre completo de una fase o sub-fase (pasos 5 a 9 de CLAUDE.md) en una pasada - marcar cerrada, changelog, mapa del código, pendientes, patrones de playtest, verificación y commit. Úsalo cuando el usuario diga que una subfase está terminada, pida cerrarla, o dé el visto bueno tras un playtest.
---

Objetivo: cerrar la subfase actual sin leer entero ninguno de los archivos grandes del proyecto. Cada paso
tiene un método barato; usar ese método es parte de la tarea, no una optimización opcional.

Antes de empezar, confirmar cuál es la subfase que se cierra si no está explícito. No asumir.

1. **Verificar primero, cerrar después.** Correr `./node_modules/.bin/vitest run`,
   `./node_modules/.bin/tsc -p game/tsconfig.json --noEmit` y `./node_modules/.bin/eslint .`.
   Si algo falla, detenerse y reportarlo: no se cierra una subfase en rojo. Anotar el conteo de tests para
   la entrada del changelog.

2. **Auto-revisión con el checklist de playtest.** Correr los 13 ejes de la memoria
   `feedback-aprender-del-patron-de-playtest` contra lo que se implementó, ANTES de dar por cerrada la
   subfase. Es el paso que evita las rondas de playtest predecibles. Si un eje destapa algo, arreglarlo
   ahora y decirlo en la respuesta.

3. **`ORDEN_DE_TRABAJO.md`**: marcar el título de la subfase con ✅ CERRADA y la fecha. Localizar la línea
   con Grep y editarla puntualmente — no leer el archivo entero. Mover el CUERPO de la subfase a
   `docs/historial/subfases-11-13-cerradas.md` (append por shell) y dejar en el orden solo el título.

4. **Changelog**: append por shell al archivo de la fase, NUNCA con Edit:
   `cat >> docs/changelog/fase-NN.log <<'EOF' … EOF`. La entrada lleva fecha, qué se hizo, la razón, los
   números que salieron de MEDIR (no de elegir) y el conteo de tests del paso 1.

5. **`MAPA_DEL_CODIGO.md`**: por cada módulo tocado, `grep -n` su carpeta para ubicar la sección y
   **actualizar la entrada existente** de ese archivo. Solo crear una entrada nueva si el módulo no estaba.
   Nunca agregar una segunda entrada para el mismo archivo, ni una sección por fase: el mapa dice qué
   existe hoy, la historia está en el changelog.

6. **`PENDIENTES_OBSERVACIONES.md`**: los ítems que esta subfase resolvió se marcan ✅ RESUELTO y se
   MUEVEN a `docs/historial/pendientes-resueltos.md`, en el mismo cambio. Lo que quedó fuera de alcance y
   no tiene fase asignada se registra como ítem nuevo ahí, no solo en la respuesta del chat.

7. **Patrones de playtest**: si el operador dio feedback, agregar el patrón nuevo al final de
   `docs/PATRONES_PLAYTEST.md` y a su índice por eje (append por shell). Tocar la memoria
   `feedback-aprender-del-patron-de-playtest` SOLO si el patrón abre un eje que ninguno de los 13 cubre.

8. **Pasos de prueba manual**: emitir la receta accionable de cómo probar lo implementado en el juego real
   — qué abrir, qué clickear, qué se tiene que ver. Verificar que los pasos sean ejecutables con el estado
   actual del contenido; si hace falta una tecla de dev, decirlo.

9. **Commit**: `git add` de lo tocado y un commit con el mensaje en el estilo del repo (una línea en
   español, en minúscula, describiendo el efecto para el jugador y no el refactor). No pushear salvo que
   lo pidan.

Al terminar, reportar en la respuesta: qué se cerró, el resultado de los tres verificadores con sus
números, los pasos de prueba manual, y qué quedó abierto en pendientes.
