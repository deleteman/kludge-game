# Reporte de evaluación — Comparativas de género vs. Kludge

> Documento de análisis generado a partir de los 4 estudios de `docs/comparativas-juegos/`
> (Barotrauma, Duskers, FTL, Shipbreaker) cruzados contra el GDD (`docs/GDD_nave_sistemas.md`),
> el roadmap (`nuevo-orden.md`) y la deuda registrada en `PENDIENTES_OBSERVACIONES.md`.
> Fecha: 2026-07-29.

## Metodología

Se extrajeron los 4 ejes de diseño que destaca cada documento (16 en total) y se cruzaron contra
el estado real de diseño e implementación de Kludge, clasificándolos en 4 categorías:
1. lo que hacemos bien, 2. lo que hay que mejorar, 3. lo pendiente pero ya en roadmap,
4. lo que ni siquiera está definido en ningún documento.

| Juego | Ejes analizados |
|---|---|
| **Barotrauma** | Grafo de nodos dual (energía+señal) · Cascada de fallas emergente · Cultura del *bypass* · Diagnóstico diegético |
| **Duskers** | UI-CRT unificada + estática de error · Pánico por audio/telemetría · Navegación esquemática · Hardware frágil/degradado |
| **FTL** | Pausa táctica · Triaje de recurso *zero-sum* · Múltiples frentes/priorización · UI de diagnóstico inmediato |
| **Shipbreaker** | Satisfacción de deconstrucción · Fantasía *blue-collar* · Riesgo sistémico al canibalizar · Conocimiento anatómico |

---

## 1. Lo que ya tenemos y hacemos bien

Ejes donde el diseño y/o la implementación de Kludge ya están a la altura del referente:

- **Pausa táctica (FTL F1)** — El core loop planificación/ejecución con máquina de estados explícita
  y colas por tripulante con grafo de dependencias (GDD §4) es exactamente el "puzle de ingeniería a
  alta presión" de FTL, no un test de reflejos. Implementado y probado (`CrisisRuntime`,
  `coreLoop.mode`). Incluso el detalle de FTL de "la pausa no castiga pensar" está cubierto.

- **Cultura del bypass / MacGyverismo (Barotrauma B3, FTL F2)** — Es literalmente el Pilar 1 del GDD
  y toda la premisa del Cap.1 (pañol con 0 repuestos → canibalizar el extractor del pasillo).
  Barotrauma y FTL *validan* nuestra apuesta central; no hay que copiar nada, ya es el núcleo.

- **Grafo de nodos / dominios ortogonales (Barotrauma B1)** — El sistema de tags
  `EM`/`REC`/`ACT`/`COND`/`RES` sobre un grafo de señal, con conductos tipados por recurso
  (`electrico`/`fluido`/`ventilacion`/`senal`), es la versión simplificada y elegante de los pines de
  Barotrauma. El propio documento de comparativa lo dice así.

- **Navegación esquemática por capas (Duskers D3, GDD §10)** — Plano 2D esquemático seleccionable con
  capas activables (eléctrica/fluidos/estructural/señales) ya cableado al HUD real en Fase 11f. El
  jugador ya "lee sistemas, no escenarios".

- **Satisfacción de deconstrucción — base (Shipbreaker S1)** — El efecto de desmontaje con partículas
  (`dismantleEffect`) ya vende la "cirugía industrial", no un borrado de sprite. La base está; el
  pulido está en roadmap (ver §2 y §3).

- **Legibilidad diegética por partículas (Barotrauma B4 / Duskers D2, parcial)** — GDD §11.1 exige que
  dos fenómenos nunca se vean igual, y ya está entregado para flujo, sobrecarga, atmósfera, y estado en
  reposo de señal (LED/LCD, Fase 11h). El *canal visual* del diagnóstico diegético está resuelto.

- **Conocimiento anatómico de la nave (Shipbreaker S4)** — Emerge gratis de tags + tooltips + el
  principio de emergencia sobre recetas. No requiere sistema nuevo: es una consecuencia de diseño que
  ya está bien planteada.

---

## 2. Lo que ya tenemos pero necesita mejorar (y cómo)

Ejes presentes en el diseño/código pero con implementación a medias o con un defecto concreto:

- **Cascada de fallas — hoy es autorada, no emergente (Barotrauma B2)** — Es *el mayor logro* de
  Barotrauma (agua→cortocircuito→sobrecarga→asfixia) y donde más lejos estamos. El GDD §8 describe
  crisis encadenadas, pero son **secuencias scripteadas en la definición de crisis**, no propagación
  emergente entre sistemas.
  - *Cómo mejorar:* cerrar la deuda **#16** (`ReactionResolver`/combustión sin llamador de producción
    en `MissionRuntime`) y la deuda **#3** (emisores siempre disparados, ningún sensor evalúa el mundo).
    Sin esas dos piezas, `OverloadRule` corre pero no puede *encadenarse* con química ni con sensores
    reales. La cascada emergente es un objetivo de sistema, no de contenido — conviene nombrarla
    explícitamente como meta en el roadmap.

- **Diagnóstico diegético — falta el canal auditivo y la semántica de color (Barotrauma B4, Duskers D2)**
  — El canal de partículas está (§1), pero:
  - El **audio** (siseo de fuga, zumbido de sobrecarga) no existe → está en roadmap (§3, Fase 12b). Sin
    él, la "arquitectura del pánico" de Duskers está a mitad.
  - **Semántica de color rota:** PENDIENTES **#15** ya detectó que el LED de alarma se encendía en verde
    (el mismo verde de "todo bien"). Se parcheó a ámbar, pero *no hay un lenguaje de color coherente
    definido* (rojo=fatal, ámbar=escalable, cian/blanco=seguro — justamente la tabla de FTL F3/F4).
    *Cómo mejorar:* definir esa paleta semántica como contrato único y auditarla contra `palette.ts`.

- **Deconstrucción — el pulido táctil está incompleto (Shipbreaker S1)** — La mesa aún dibuja
  placeholders en algunos caminos (deuda **#8**, creación compuesta como rectángulo) y falta la
  "recolección visible de elementos" (12c) que es justo lo que hace *adictivo* el desguace en
  Shipbreaker (cada tuerca cuenta). *Cómo mejorar:* priorizar el ítem de 12c "Recolección Visible de
  Elementos Atómicos" y cerrar deuda #8.

- **Grafo dual con un hueco estructural (Barotrauma B1)** — Prerequisito de 11c ya identificado:
  `installInstance` no genera `SignalNode` para piezas instaladas en misión, así que una pieza recién
  canibalizada/sintetizada **no se puede cablear**. El "grafo de nodos" de Barotrauma asume que *todo*
  es cableable; nosotros tenemos ese agujero. Ya está en roadmap (11c) pero es un defecto de un sistema
  que decimos tener, no una feature nueva.

---

## 3. Lo que falta implementar pero ya está en el roadmap

Ejes bien cubiertos por `nuevo-orden.md`/PENDIENTES, solo pendientes de ejecución:

- **Audio diegético / arquitectura del pánico (Duskers D2, Barotrauma B4)** → **Fase 12b** (dominio
  `game/src/audio/`, SFX por reglas vía `effect-registry`, barks de voz). Es lo que Duskers llama "el
  alma de la angustia industrial".

- **UI-CRT unificada, estática y aberración cromática (Duskers D1)** → **Fase 12c** (shader CRT sobre
  `hudCamera`, viñeta roja pulsante sincronizada con el timer, filtros ColorMatrix en retratos). El "la
  consola se desintegra junto con la nave" de Duskers.

- **Múltiples frentes / priorización de incendios (FTL F3)** → **Fase 11d** (dominio `threat/`, enemigos
  con `hop-movement`) + **Fase 18** (doble emergencia paralela). Hoy no hay actor hostil real; es el
  mayor bloque de contenido sistémico pendiente.

- **Alerta de pantalla completa / iluminación de crisis (Duskers D2, FTL F4)** → **12a** (entregado:
  `dynamic-light.ts`, `redrawScreenAlertOverlay`) + **12d** (sombras dinámicas, con ciclo de preguntas
  propio pendiente).

- **Iluminación dinámica y estados de daño de fondo (Shipbreaker S2, ambiente industrial)** → **12a**
  entregado; extensión de LED graduado diferida a 12a/deuda #15.

- **Estado agregado de nave / bases de energía (FTL F2, parcial)** → **Fase 11g** (agregación
  atmósfera/soporte-vital/estructura a nivel nave, entregado; "bases mínimas de un sistema de energía"
  reconocido como pendiente).

---

## 4. Lo que falta incluso definir (no aparece en ningún documento)

Estos son los verdaderos huecos: ejes que los referentes explotan y que **no están en el GDD, ni en el
roadmap, ni en PENDIENTES**. Ordenados por impacto:

- **① Estado "degradado pero funcional" de una pieza canibalizada (Duskers D4)** — Duskers insiste en
  que *todo el hardware está al borde del colapso*: un repuesto canibalizado funciona al 80%, tiene un
  tag `[DEGRADADO]`. Nuestro GDD modela **pérdida de material al desmontar** (recuperás 60/80/90% de los
  átomos, §6.5) y `RE`, pero **no un estado de eficiencia reducida de una pieza que sí funciona**. Un
  `Motor pequeño` sacado del extractor entra al Soporte Vital como si fuera de fábrica. Esto es central a
  la fantasía "kludge" (parche de emergencia, no repuesto limpio) y hoy no existe como concepto.
  *Requiere:* definir si una instancia lleva un factor de desgaste/eficiencia, cómo se origina
  (desmontaje, corrosión, sobrecarga previa), y cómo se lee en la UI.
  **Es el gap más alineado con el nombre y la fantasía del juego.**

- **② Riesgo sistémico en el ACTO de desmontar (Shipbreaker S3)** — En Shipbreaker, cortar una tubería
  sin purgar el combustible = explosión; abrir sin igualar presión = descompresión. El GDD dice que
  desmontar "no es gratis" pero solo en términos de *tiempo y material*. **No modela que el acto de
  desmontar dispare un hazard según el estado vivo de la pieza**: canibalizar un conductor con corriente
  → chispazo/corte de luz; vaciar un reservorio presurizado sin cerrar válvula → fuga. Es distinto de la
  cascada emergente (§2): es un riesgo *puntual en la interacción de desmontaje*. Refuerza el pilar 5
  ("todas las partes están vivas y conectadas") y no está en ningún lado. *Requiere:* una regla
  "pre-condición de desmontaje seguro" por tipo de recurso vivo en la pieza.

- **③ Energía como presupuesto escaso reasignable, no binario por sección (FTL F2)** — El triaje de FTL
  es *continuo*: tenés N barras de energía y decidís, en vivo, adónde van. Nuestro triaje es físico
  (canibalizar) — decisión de diseño legítima y probablemente *mejor* — pero significa que **no existe
  la tensión de "reasignar un recurso escaso en curso"**: la energía en Kludge es binaria por sección
  (`unpoweredSectionIds`). 11g admite "sentar bases mínimas de energía" pero no hay una definición de si
  la energía es un presupuesto que el jugador balancea. *Requiere una decisión de diseño explícita:*
  ¿queremos esa capa de triaje continuo de FTL, o la reemplazamos conscientemente por canibalización y
  lo dejamos documentado como omisión deliberada? Hoy está en un limbo no decidido.

- **④ Estática/pérdida de señal diegética localizada por zona (Duskers D1/D2)** — Más allá del shader
  CRT global de 12c, Duskers usa **estática localizada en la zona del esquema que falló** como feedback
  de error (la cámara pierde señal, ese nodo se llena de ruido de fósforo). Nuestro roadmap tiene
  overlays *globales* (viñeta, alerta de pantalla), pero no "esta sección concreta del plano se
  desintegra visualmente porque perdió energía/señal". *Requiere:* definir un efecto de degradación
  visual por-sección atado a `unpoweredSectionIds`/pérdida de señal. Menor, pero es puro "alma Duskers".

- **⑤ Interferencia / corrupción de señal como fenómeno del motor (Duskers D2)** — En Duskers la señal
  se pierde por interferencia magnética. Nuestro grafo de señal es binario y perfecto (llega o no
  llega). No hay concepto de *señal ruidosa/degradada*. Es el más opcional de los cinco; anotado por
  completitud.

---

## Recomendación de acción

Los ítems **①** y **②** de la categoría 4 son los de mayor retorno: baratos de definir, refuerzan
directamente el pilar "consecuencias permanentes" y la fantasía *kludge*, y no requieren arte nuevo. El
**③** no es un gap a "llenar" sino **una decisión de diseño pendiente** que conviene cerrar formalmente
antes de tocar el sistema de energía de 11g/17.

Siguiente paso sugerido: registrar los 5 gaps de la categoría 4 en `PENDIENTES_OBSERVACIONES.md` con el
formato de "qué falta / de dónde sale / qué costaría", y abrir un ciclo de preguntas de diseño sobre
①/②/③ antes de comprometer implementación.
