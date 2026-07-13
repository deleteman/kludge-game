# Diseño de las primeras 8 crisis de campaña

Documento complementario al GDD ("Systems"). Complementa la sección 8 (Generación de crisis) y se apoya en los 16 casos de validación de la sección 9.

**Asunción de diseño** (a confirmar): cada partida de campaña se juega con **un arquetipo de nave elegido al inicio**, igual que en FTL — no hay 4 campañas separadas con crisis distintas, sino una única secuencia de 8 capítulos que debe funcionar sobre cualquiera de los 4 arquetipos, con soluciones distintas según el equipamiento disponible (7.3-7.6). Si esto no es lo que tenías en mente, es el primer punto a corregir antes de seguir.

**Principio de progresión**: sigue el orden de introducción de mecánicas definido en el GDD (sección 8) — señal simple → combinación de señales → memoria/latch → propiedades de material → material+tiempo — y a partir del capítulo 6 empieza a combinar fallos simultáneos y a hacer referencia a las cicatrices que el jugador haya dejado en capítulos anteriores de la misma partida.

---

## Capítulo 1 — "Primer Aviso"

**Mecánica introducida**: señal simple (un solo `EM`+`ACT`), el core loop de pausa/cola/ejecución sin presión real.

**Disparador**: un actuador de apertura (compuerta o válvula menor) no responde a su sensor asociado; nada crítico todavía, pero bloquea el paso a una sección secundaria.

**Complicación**: temporizador suave, sin amenaza de vidas — es la crisis que enseña el loop, no que lo pone a prueba.

**Solución esperada**: el jugador desmonta el actuador atascado, lo repara o lo sustituye con una pieza atómica equivalente (motor pequeño, 7.2), lo reinstala.

**Consecuencia/cicatriz**: mínima o ninguna; como mucho, una leve pérdida de tiempo si el jugador improvisa mal.

**Duración objetivo**: 10-15 min (más corto que el estándar, es tutorial).

**Casos de validación relacionados**: ninguno específico — es la introducción del loop base (sección 4).

---

## Capítulo 2 — "Ecos en el Pasillo"

**Mecánica introducida**: combinación de señales (AND/OR/NOT).

**Disparador**: dos sensores de movimiento en secciones distintas detectan actividad simultánea; el jugador debe construir un sistema que distinga tripulación propia de una posible amenaza antes de que algo actúe sobre ello.

**Complicación**: temporizador medio; si el jugador no verifica bien, el sistema puede reaccionar contra un tripulante propio en vez de una amenaza real.

**Solución esperada**: nodo combinador + chip de identificación de tripulante (7.1, componente atómico común) como filtro NOT — versión simplificada del caso 5 ("El Cañón que Aprende").

**Consecuencia/cicatriz**: si falla, un tripulante propio sufre daño (no necesariamente letal) — lección temprana sobre el riesgo de automatizar sin verificación.

**Duración objetivo**: 15-20 min.

**Casos de validación relacionados**: 1, 5.

---

## Capítulo 3 — "La Alarma que no Calla"

**Mecánica introducida**: memoria/latch, temporización.

**Disparador**: una fuga menor de refrigerante activa un sensor de presión. La fuga se estabiliza sola al cabo de un rato, pero eso no significa que el daño desaparezca — el jugador debe construir un sistema que **recuerde** que hubo una fuga y fuerce el cierre de puertas estancas aunque la alarma original ya no esté sonando.

**Complicación**: si el jugador no usa memoria (solo reacciona a la señal en vivo), puede dar la crisis por resuelta en cuanto la alarma calla, sin notar que queda daño estructural acumulado.

**Solución esperada**: latch con reset manual, versión simplificada del caso 4 ("El Piano de Emergencia").

**Consecuencia/cicatriz**: la sección afectada queda con resistencia estructural (`RE`) reducida — **cicatriz que reaparece en el capítulo 7**.

**Duración objetivo**: 15-20 min.

**Casos de validación relacionados**: 4.

---

## Capítulo 4 — "Cortocircuito en la Bahía de Carga"

**Mecánica introducida**: propiedades de material (cambio de estado, conductividad variable con temperatura).

**Disparador**: un impacto rompe una tubería de refrigerante, que avanza hacia un panel eléctrico con corriente activa. La válvula de corte de esa tubería está destruida — no hay solución directa disponible.

**Complicación**: temporizador estricto de 90 segundos una vez el refrigerante empieza a avanzar hacia el panel — el ritmo más ajustado hasta este punto de la campaña.

**Solución esperada**: dos rutas válidas, ambas legítimas (ver caso 2 completo) — congelar el refrigerante con una fuente fría disponible para detener su avance, o enfriar un tramo del cable de alimentación hasta que actúe como fusible térmico y corte el circuito por sí solo.

**Consecuencia/cicatriz**: si tiene éxito, la sección queda fría (cicatriz menor, requiere recalentar más adelante). Si falla, cortocircuito abre la puerta al vacío — riesgo real de pérdida de tripulación.

**Duración objetivo**: 15-20 min (con el sub-temporizador de 90s como pico de tensión).

**Casos de validación relacionados**: 2.

---

## Capítulo 5 — "El Reactor al Límite"

**Mecánica introducida**: material + tiempo (sobrecarga, fusibles térmicos), refuerzo del pilar de sacrificio.

**Disparador**: el reservorio de energía principal de la nave se sobrecarga (por desgaste acumulado o daño previo). Sin intervención, se funde y deja sin energía las secciones que dependan de él — incluido, potencialmente, soporte vital.

**Complicación**: temporizador estricto (~5-8 minutos reales) antes del fallo catastrófico. El jugador puede desviar carga sacrificando el suministro de una sección no crítica, o enfriar el reservorio con lo que tenga disponible — la opción exacta varía por arquetipo (nitrógeno líquido en Investigación, refrigerante en Exploración, etc.).

**Solución esperada**: sacrificio deliberado de `RES(E)` de una sección secundaria, o improvisación de refrigeración con un reservorio frío disponible.

**Consecuencia/cicatriz**: la sección sacrificada queda sin energía **el resto de la campaña** — la cicatriz más significativa hasta este punto.

**Duración objetivo**: 20-25 min.

**Casos de validación relacionados**: parámetros térmicos de la Especificación de datos técnicos (sección 1); pilar de diseño 2.

---

## Capítulo 6 — "Ataque y Fuga Simultánea"

**Mecánica introducida**: combinación de 2 fallos simultáneos, dependencias entre colas de distintos tripulantes.

**Disparador**: abordaje enemigo en una sección y fuga de gas en otra, al mismo tiempo — el jugador ya no puede resolver todo con un solo tripulante ni en serie.

**Complicación**: dos temporizadores corriendo en paralelo; una solución exige coordinar tareas dependientes entre tripulantes distintos (ej: el Ingeniero prepara una pieza que el Médico necesita para contener la fuga mientras Seguridad contiene a los intrusos).

**Solución esperada**: torreta improvisada (caso 1) defendiendo la sección abordada, mientras se aísla la ventilación de la sección con fuga (5.5) — colas encadenadas con dependencia explícita (caso 14).

**Consecuencia/cicatriz**: según el resultado, pérdida de tripulante o cicatriz estructural adicional en la sección de la fuga.

**Duración objetivo**: 20-25 min.

**Casos de validación relacionados**: 1, 3, 14.

---

## Capítulo 7 — "Las Cicatrices Vuelven"

**Mecánica introducida**: crisis avanzada con 3-4 fallos encadenados, uno de ellos causado por una cicatriz de un capítulo anterior de la misma partida.

**Disparador**: la sección con `RE` reducida del capítulo 3 (o la sección sin energía del capítulo 5, según qué haya elegido el jugador) falla bajo la tensión de una nueva emergencia — una fuga que combina una sustancia `CORR`+`TOX` a la vez, con riesgo simultáneo de combustión si alcanza un oxidante cercano.

**Complicación**: sin la sección de respaldo ya sacrificada en capítulos anteriores, el jugador tiene menos margen de maniobra que en cualquier crisis previa — el coste de decisiones pasadas se siente literalmente en los recursos disponibles ahora.

**Solución esperada**: resolver aplicando el orden de prioridad entre reglas simultáneas (Especificación de datos técnicos, sección 2); si no hay neutralizante preinstalado, sintetizarlo desde elementos base en la mesa de creación (caso 12).

**Consecuencia/cicatriz**: cicatriz adicional, acumulativa sobre las anteriores.

**Duración objetivo**: 20-25 min.

**Casos de validación relacionados**: 7, 12, 13.

---

## Capítulo 8 — "Punto de No Retorno"

**Mecánica introducida**: clímax — sintetiza casi todas las mecánicas de la campaña a la vez.

**Disparador**: una amenaza externa fuerza una maniobra evasiva inmediata (requiere al Piloto, caso 16) mientras, en paralelo, un fallo en cascada se propaga por las secciones ya dañadas en capítulos anteriores — fuego, pérdida de atmósfera y fallo estructural combinados.

**Complicación**: múltiples temporizadores simultáneos; los recursos disponibles dependen directamente de las cicatrices acumuladas durante toda la partida (secciones sin energía, sin ventilación, con `RE` reducida) y de la tripulación que siga con vida.

**Solución esperada**: no hay una receta — el jugador improvisa con lo que le queda. Es el escenario más probable para necesitar la ruta atómica completa (caso 15, "Reconstrucción desde Cero"), porque es posible que ya no queden compuestos intactos de sobra tras 7 capítulos de improvisación.

**Consecuencia/cicatriz**: cierre de campaña — éxito o fracaso, reflejando el acumulado completo de decisiones de la partida.

**Duración objetivo**: 25-30 min (excepcionalmente más largo, al ser el clímax).

**Casos de validación relacionados**: 15, 16, y en conjunto la mayoría de los anteriores.

---

## Resumen de progresión

| Capítulo | Mecánica nueva | Cicatriz que deja | Duración |
|---|---|---|---|
| 1. Primer Aviso | Loop base, señal simple | Ninguna/mínima | 10-15 min |
| 2. Ecos en el Pasillo | Combinación de señales | Posible daño a tripulante | 15-20 min |
| 3. La Alarma que no Calla | Memoria/latch | `RE` reducida (reaparece en cap. 7) | 15-20 min |
| 4. Cortocircuito en la Bahía de Carga | Material: estado, conductividad | Sección fría | 15-20 min |
| 5. El Reactor al Límite | Material + tiempo, sacrificio | Sección sin energía (permanente) | 20-25 min |
| 6. Ataque y Fuga Simultánea | 2 fallos simultáneos, dependencias de colas | Tripulante o estructura | 20-25 min |
| 7. Las Cicatrices Vuelven | 3-4 fallos encadenados, callback a cicatrices | Acumulativa | 20-25 min |
| 8. Punto de No Retorno | Síntesis de todo, ruta atómica | Fin de campaña | 25-30 min |

## Pendiente de definir

- Confirmar la asunción de campaña-por-arquetipo del inicio de este documento.
- Narrativa/contexto concreto de cada capítulo (qué está pasando en la historia, no solo la mecánica).
- Variantes de disparador específicas por arquetipo para los capítulos que lo requieran (ahora mismo descritos de forma genérica).
- Balanceo exacto de temporizadores tras playtesting.
- Diseño de logros (6.8 del GDD) que puedan desbloquearse específicamente dentro de estos 8 capítulos.
