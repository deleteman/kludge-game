# Rework Capítulo 1 — flujo "sin stock → inspeccionar → desarmar → reutilizar"

## Contexto

Hoy el capítulo 1 ("Primer Aviso") se resuelve instalando directamente `valvula-simple`
o `motor-pequeno` desde un selector que lista **todo** el catálogo atómico como
disponible sin límite — no existe ningún concepto de inventario/stock en el motor
ni en el juego. El nuevo flujo pedido requiere que el jugador descubra que no hay
stock, inspeccione un objeto compuesto no crítico en la nave, vea qué piezas
atómicas contiene, desarme ese objeto para obtener la pieza que sí resuelve la
crisis (`motor-pequeno`, tag `ACT`), y la instale.

Exploración confirmó que esto no es un ajuste de UI menor: faltan piezas enteras
del motor (inventario, reversión de receta al desarmar, resolución de crisis por
tag funcional en vez de lista de IDs) y de la UI (desglose de composición,
pestañas del selector, resaltado de requisito). Decisiones ya confirmadas con el
operador:

- El sistema de stock es un mecanismo **global** del juego a partir de este
  cambio (no una excepción solo del capítulo 1).
- Se siembran **varios** objetos compuestos desarmables en la nave: algunos que
  NO resuelven la crisis (para mostrar que el desarmado es un mecanismo general,
  no una pista de un solo uso) y uno que sí la resuelve.
- La resolución de crisis del capítulo 1 se **generaliza a matching por tag
  funcional** (`ACT`), reemplazando la lista fija de `acceptableComponentDefinitionIds`
  — corrige además el incumplimiento del principio 1 de `CLAUDE.md`.
- La pestaña "Catálogo / Requiere Síntesis" del selector de instalación es
  **solo informativa** en esta iteración (no dispara fabricación).
- Los objetos semilla compuestos **se autoran en Tiled**, no como literales de
  `GridPosition` hardcodeados en TypeScript — se construye un estándar general
  reutilizable para cualquier capítulo futuro (pedido explícito del operador),
  ver sección dedicada más abajo.

## Piezas seleccionadas para los objetos semilla (catálogo `EXPLORACION_CATALOG`)

Todas ya existen en `engine/src/components/catalog/composite/exploracion.ts`, cero
trabajo de datos nuevo en el catálogo compuesto (salvo el campo `footprint` que se
añade en la sección de estándar Tiled, necesario para poder instanciarlas):

- **Solución**: `herramientas-reparacion-externa` (tag `ACT`; receta incluye
  `motor-pequeno` x1 — es la pieza que resuelve el capítulo 1).
- **Señuelos** (no contienen `motor-pequeno` ni tag `ACT` en su propia receta):
  `radio-largo-alcance` (chip-circuito-generico, cable-cobre, bateria-celda-simple)
  y `reservorio-agua-reciclada` (tubo-flexible, valvula-simple, junta-hermetica).

Las posiciones concretas se colocan en Tiled (capa `semillas`, ver estándar más
abajo) sobre `nave-exploracion.json`, cerca de la sección bloqueada por el
capítulo 1 pero fuera de `anchorPosition` (que sigue siendo el sitio del
actuador). Es una tarea de autoría en Tiled que hace el operador una vez que el
parser/wiring esté implementado — no de código.

## Cambios en el motor (`/engine`)

### 1. Sistema de inventario/stock (nuevo dominio `engine/src/inventory/`)

- `inventory.types.ts`: stock de piezas atómicas como `Partial<Record<ComponentId, number>>`
  (clave ausente = 0, sin semántica mágica de "ilimitado").
- Funciones puras: `hasStock`, `consumeStock` (falla si insuficiente), `creditStock`.
- `CampaignSaveState` (`save/campaign-save.types.ts`) gana un campo nuevo
  `atomicStock: AtomicPartsStock` — se persiste igual que `shipState`/`crew`
  (actualizar `campaign-save-serializer.ts` y `campaign-save-integrity.ts`).

### 2. Stock inicial por capítulo, sin romper el resto del juego

- `campaign-save-factory.ts` construye el stock inicial por defecto como
  "generoso" para **todo** el catálogo atómico (preserva el comportamiento actual
  de "todo disponible siempre" para capítulos que no piden escasez).
- Capítulo 1 exporta `CHAPTER_01_INITIAL_ATOMIC_STOCK = {}` (vacío → stock cero
  en todo lo que el jugador pudiera necesitar) y ese valor **reemplaza** el
  default cuando el capítulo activo lo define — mismo patrón data-driven que
  `CHAPTER_SEED_BY_ID` en `chapter-progression.ts`.
- `chapter-progression.ts::advanceChapterProgress` y `campaign-save-factory.ts`
  aplican el stock inicial del capítulo igual que ya aplican `ChapterSeed`.

### 3. `dismantleInstance` reconoce compuestos y acredita stock

En `engine/src/mission/ship-task-effect.ts`: cuando la instancia desarmada
resuelve (vía `componentRegistry`) a una definición con `recipe.ingredients`
(compuesto), cada ingrediente `{ ref, quantity }` se acredita al `atomicStock`
de la misión antes de borrar la instancia. Una pieza atómica desarmada no
acredita nada (no tiene receta). Requiere que `createShipTaskEffect` reciba
también el stock mutable (mismo patrón que `MutableShipState`).

### 4. `installInstance` consume stock de piezas atómicas

Antes de instalar, si `componentDefinitionId` resuelve a una definición
**atómica** (sin receta), se exige `hasStock(...) >= 1` y se consume 1 unidad;
si no hay stock, la tarea falla (mismo mecanismo que ya usa el efecto para
errores — a definir el canal exacto de error al implementar). Las creaciones
custom del jugador (`installableCreations`) NO se ven afectadas — siguen su
mecanismo actual, sin cambios.

### 5. Nueva resolución de crisis por tag funcional

- `crisis-definition.types.ts`: nuevo `FunctionalTagInstalledResolutionSpec`
  (`kind: "functional-tag-installed"`, `anchorPosition`, `requiredTag`,
  `objectiveKey?`) añadido a la unión `CrisisResolutionSpec`.
- Nueva regla `engine/src/crisis/rules/functional-tag-installed.ts`
  (`FunctionalTagInstalledRule`), mismo patrón que
  `ReplacementInstalledConnectedRule` pero comprobando que la definición
  resuelta en `anchorPosition` tenga `data.functional` con una entrada
  `tag === requiredTag`. Requiere acceso al `componentRegistry` en
  `CrisisEvalContext` (verificar/extender su forma actual).
- Registrar en `createDefaultCrisisResolutionRegistry`
  (`crisis/rules/crisis-rule-registry.ts`).
- **No se borra** `replacement-installed-connected` (otros tests/capítulos lo
  usan) — solo se migra el capítulo 1 a la nueva regla.
- `chapter-01-primer-aviso.ts`: la resolución `replacement-installed-connected`
  se reemplaza por `functional-tag-installed` con `requiredTag: "ACT"`.

### 6. Estándar nuevo: objetos semilla COMPUESTOS autorados en Tiled

Hoy `initial-ship-state.ts` devuelve `[]` siempre (comentario propio: "por si un
capítulo futuro necesita sembrar componentes reales... desde modo dev") y
`floorplan-parser.ts` ya parsea una capa de objetos (`anclajes`) a posiciones de
grid, pero **nada consume esas posiciones para instanciar componentes** — es
puramente un artefacto de referencia/documentación hoy (confirmado explorando
`valvula-simple-1`: su posición en Tiled fue leída una vez a mano y
transcripta a `CHAPTER_01_PARAMS_BY_ARCHETYPE`). Este punto cierra ese hueco
con un mecanismo genérico, reutilizable por cualquier capítulo futuro — **solo
para compuestos**, por definición del GDD (7.1-7.2: las piezas atómicas son
building blocks, no se "encuentran" sueltas dando vueltas por la nave con
identidad propia; lo que se descubre y desarma son ensamblajes).

**Prerrequisito de datos (antes de tocar Tiled)**: `CompositeComponentSpec.data`
(`components/catalog/composite/*.ts`) no tiene campo `footprint` — los
compuestos custom del jugador sí lo llevan (se define en la mesa de creación),
pero los del catálogo autorado no, porque hasta ahora ningún compuesto de
catálogo se instanciaba directo en el plano. Sin `footprint` no se puede armar
un `PlacedComponentInstance` real. Se añade `footprint?: Footprint` opcional a
`CompositeComponentSpec.data` y se completa (valor sensato según su forma
física real) al menos en los 3 elegidos para este capítulo
(`herramientas-reparacion-externa`, `radio-largo-alcance`,
`reservorio-agua-reciclada`); el resto del catálogo puede completarse
gradualmente, no bloquea este cambio.

**Nueva capa Tiled `semillas`** (mismo patrón que `anclajes`/`conductos`:
`objectgroup`, objetos tipo punto), en `nave-exploracion.json` y disponible
para cualquier mapa futuro. Propiedades custom por objeto (Tiled `properties`,
igual convención que ya usa `anclajes`):

| Propiedad | Tipo | Requerida | Significado |
|---|---|---|---|
| `componentId` | string | sí | Debe resolver a un `ComponentId` **compuesto** (con `.recipe`) del `componentRegistry`; error de parseo/validación si resuelve a un atómico o a nada. |
| `condition` | string | no (default `"ok"`) | Mismo dominio que `PlacedComponentInstance.condition` (`ok`/`jammed`/`destroyed`). |
| `instanceId` | string | no | Si se omite, se deriva determinísticamente del `id`/`name` propio del objeto Tiled (estable entre parseos/saves). |
| `chapterId` | string | no | Si está presente, la semilla solo se instancia cuando ese capítulo pasa a ser el activo (mismo momento que `CHAPTER_SEED_BY_ID`). Si se omite, se instancia siempre, como parte del kit inicial de la nave (attrezzo ambiental disponible desde el arranque de la partida). |

Los 3 objetos de este capítulo van **sin `chapterId`** (attrezzo de nave
presente desde el inicio, no algo que aparece mágicamente al activarse el
capítulo 1 — más creíble narrativamente: la nave ya tenía esas piezas tiradas).

**Cambios de código para soportar el estándar:**

- `floorplan.types.ts`: nuevo tipo `ComponentSeedPoint { id; sectionId;
  position; componentId; condition?; instanceId?; chapterId? }` y campo
  `componentSeeds: readonly ComponentSeedPoint[]` en `ShipFloorplan`.
- `floorplan-parser.ts`: nueva `parseComponentSeeds`, mismo patrón que
  `parseAnchors` (valida que la celda caiga dentro de una sección). A
  diferencia de `secciones`/`conductos`/`anclajes`, la capa `semillas` es
  **opcional** (mapas existentes sin ella siguen parseando con
  `componentSeeds: []`) para no romper los 3 arquetipos que todavía no la
  tengan autorada.
- `floorplan-integrity.ts`: valida unicidad de `id`/`instanceId` de semillas
  (mismo criterio que ya aplica a anclajes). No valida "es compuesto" aquí —
  el parser no tiene acceso al `componentRegistry` (se mantiene puro, igual
  que hoy); esa validación se hace en el paso de instanciación.
- Nuevo módulo `floorplan/instantiate-component-seeds.ts`: función
  `instantiateComponentSeeds(seeds, registry): PlacedComponentInstance[]` —
  resuelve cada `componentId` contra el `componentRegistry`, exige que la
  definición tenga `.recipe` (compuesto) o lanza error explícito nombrando el
  id atómico inválido, arma el `PlacedComponentInstance` usando el
  `footprint` de la definición resuelta.
- Consumo: `campaign-save-factory.ts` instancia las semillas SIN `chapterId`
  como parte del kit inicial (junto a `INITIAL_SHIP_STATE_BY_ARCHETYPE`);
  `chapter-progression.ts::CHAPTER_SEED_BY_ID` instancia además las semillas
  CON `chapterId` igual al capítulo correspondiente, mezclándolas con el
  `ChapterSeed.components` ya hand-authored (sensor/panel/válvula siguen en
  TS — son infraestructura de trigger/señal, no "objetos para desarmar",
  fuera del alcance de este estándar).

**Resolución de sprite**: gratis — ya existe la convención
`game/assets/sprites/components/<componentId>.png` +
`component-sprite-registry.ts` (`import.meta.glob` sobre la carpeta, sin
registro manual). Mientras el `componentId` de la semilla coincida con un
`ComponentId` real del catálogo, el sprite se resuelve solo; si falta el PNG,
cae al placeholder por código ya existente (no bloquea desarrollo, mismo
criterio que `CLAUDE.md` exige para cualquier asset faltante).

**Stock inicial cero** (punto 2 de este plan) sigue siendo un export TS del
capítulo (`CHAPTER_01_INITIAL_ATOMIC_STOCK = {}`), no algo autorable en
Tiled — no es una posición en el mapa, es un parámetro de balance/mission-config.

### 7. Tests (obligatorios por `CLAUDE.md`, mismo cambio)

- Unitarios: ledger de stock (`hasStock`/`consumeStock`/`creditStock`),
  `dismantleInstance` acredita ingredientes de un compuesto,
  `installInstance` consume/rechaza por falta de stock,
  `FunctionalTagInstalledRule`.
- Integración: actualizar `chapter-01-primer-aviso.test.ts` (y
  `crisis-machine.test.ts`/`crisis-rules.test.ts` si referencian la resolución
  vieja del capítulo 1) para el flujo completo: stock cero → instalar
  `motor-pequeno` directo falla → desarmar `herramientas-reparacion-externa` →
  stock de `motor-pequeno` = 1 → instalar en `anchorPosition` → resolución
  `functional-tag-installed` pasa.
- Estándar Tiled: `floorplan-parser.test.ts` (capa `semillas` ausente →
  `componentSeeds: []`; capa presente → parseo correcto de `componentId`/
  `condition`/`instanceId`/`chapterId`), `floorplan-integrity.test.ts` (ids
  de semilla duplicados fallan), `instantiate-component-seeds.test.ts`
  (rechaza `componentId` atómico o inexistente, aplica defaults de
  `condition`/`instanceId`, usa el `footprint` de la definición resuelta).

## Cambios en el juego (`/game`)

### 8. `mission-runtime.ts` / `mission-interaction-controller.ts`

- Exponer el `atomicStock` actual de la misión (lectura) y una forma de
  consultar "¿esta pieza atómica tiene stock > 0?" para la UI.
- `buildInstallOptions()` deja de listar TODO `ATOMIC_COMPONENT_CATALOG` como
  disponible sin distinción: separa en dos listas — **inventario**
  (atómicos con stock > 0 + `installableCreations`) y **catálogo** (el resto
  del catálogo atómico + compuestos conocidos, informativo).
- Feedback visual al desarmar un compuesto que acredita stock (principio 6,
  "legibilidad visual total" — todo estado relevante del motor necesita
  representación): reusar el patrón de eventos de dominio → suscripción en
  `game` → efecto (mismo mecanismo que ya dispara `fabrication-effect.ts`) para
  mostrar qué piezas se obtuvieron al desarmar.

### 9. `mission-action-panel.ts` — desglose de composición

- Extender `ActionPanelContent` (caso `instance`) con la receta resuelta
  (`definition.recipe.ingredients`) cuando el componente inspeccionado es un
  compuesto — hoy el panel ignora `recipe` por completo aunque el motor ya lo
  expone.
- Nueva sección "Composición" listando cada ingrediente por nombre; si la
  crisis activa tiene una resolución `functional-tag-installed` y el
  ingrediente en cuestión tiene ese tag, se dibuja con borde ámbar
  (reusar `WIRE_HIGHLIGHT_COLOR = 0xffc24d` de `render/palette.ts`, mismo
  color ya usado para resaltados interactivos) + badge
  "★ Contiene función requerida: ACT".
- El tag requerido de la crisis activa debe plumbearse desde
  `MissionInteractionController`/`mission-runtime` hasta el panel (no existe
  ese dato en el panel hoy).

### 10. `install-picker-modal.ts` — pestañas

- Segmented control de dos pestañas ("Disponibles en Inventario" /
  "Catálogo — Requiere Síntesis"), reusando `createKenneyButton` +
  `setButtonHighlighted` (patrón ya usado en `archetype-select-scene.ts` /
  `crew-select-scene.ts` para selección exclusiva) — no existe un widget de
  tabs genérico, se construye ad-hoc con ese patrón.
- Pestaña "Catálogo": filas deshabilitadas (no seleccionables para instalar en
  esta iteración), mostrando qué ingredientes requeriría fabricar cada una.
- Reusar el mismo desglose de composición del punto 9 en la ficha del ítem
  seleccionado (`renderSelectedComponentSheet`).

## Verificación

- `npm test` en `/engine` — casos de validación relevantes (capítulo 1) más los
  tests unitarios nuevos, no solo que compile (`CLAUDE.md`, sección
  "Verificación de cambios").
- Tras implementar el parser/wiring del estándar Tiled, autorar en
  `nave-exploracion.json` (capa `semillas`) los 3 objetos elegidos con sus
  propiedades (`componentId` + posición), y correr `floorplan-parser.test.ts`/
  `canonical-ships.test.ts` para confirmar que el mapa sigue siendo válido.
- Correr `/game` en modo dev (skill `run`) y jugar el capítulo 1 completo en el
  arquetipo Exploración de punta a punta: crisis dispara → intentar instalar
  sin stock falla visiblemente → inspeccionar los 3 objetos sembrados (ya
  presentes en el plano gracias a la capa `semillas`) y ver la composición con
  el resaltado ámbar solo en `herramientas-reparacion-externa` → desarmar →
  pestaña "Inventario" del picker ahora muestra `motor-pequeno` → instalar →
  cablear sensor↔panel → crisis resuelve.
