# Especificación de datos técnicos — complementario al GDD

Este documento es contenido de referencia/datos, no de diseño. Está pensado para ser consumido directamente al implementar `/engine`, no para lectura lineal. Complementa al GDD principal ("Systems"), en particular las secciones 5.3-5.6 (propiedades químicas, sustancias, atmósfera, reglas de interacción).

## 1. Parámetros numéricos de las reglas de reacción química

Valores de referencia para playtesting inicial — todos ajustables sin cambiar el modelo de reglas.

| Regla | Parámetro | Valor de referencia |
|---|---|---|
| Ácido + base (neutralización) | Calor liberado | Eleva la temperatura local +15°C durante 3 segundos de simulación |
| Ácido + base (neutralización) | Tiempo de reacción | Instantáneo al contacto (sin delay) |
| Oxidante + combustible + ignición | Radio de explosión/combustión | 1 sección completa si concentración de O2 es alta; media sección si es normal; sin efecto si O2 < 5% |
| Oxidante + combustible + ignición | Daño a tripulante en radio | Alto (puede ser letal) en atmósfera enriquecida; medio en atmósfera normal; nulo en baja/vacío |
| Tóxico + espacio sellado | Umbral de incapacitación | Concentración > 30% del volumen de la sección durante > 5 segundos → incapacitación; > 60% → letal |
| Tóxico + espacio sellado | Tasa de acumulación | Depende del caudal del reservorio/fuga; referencia: tanque estándar satura una sección media en ~20 segundos a caudal completo |
| Corrosivo + conductor/estructura | Tasa de degradación de RE | Reduce un nivel de resistencia estructural (A→M→B→fallo) cada ~15 segundos de exposición continua a corrosivo nivel medio; el doble de rápido a nivel alto |
| Corrosivo + tripulante | Daño progresivo | Daño continuo mientras dura el contacto; letal tras ~10 segundos de exposición directa sin protección (traje EVA aísla completamente) |
| Volátil + regulador térmico sobrecargado | Probabilidad de ignición espontánea | Baja mientras el regulador está en rango normal; aumenta linealmente al superar su umbral de sobrecarga, hasta certeza si el regulador falla por completo |

## 2. Reglas de prioridad y stacking entre tags simultáneos

Cuando una sustancia o el resultado de una mezcla tiene más de un tag activo a la vez:

- **Tags de categorías distintas se aplican de forma independiente y simultánea** (no compiten): una sustancia `CORR`+`TOX` aplica daño por corrosión y riesgo de incapacitación por toxicidad al mismo tiempo, son fenómenos físicos distintos.
- **Tags de la misma categoría no deberían coexistir por diseño**: una sustancia no es `ACID` y `BASE` a la vez (ver 5.4.1, ningún elemento base tiene ambos). Si una mezcla los combina, se resuelve por la regla de neutralización (sección 1 de este documento), no por stacking.
- **Cuando dos reglas de reacción podrían dispararse a la vez** (ej: una mezcla que es simultáneamente candidata a "neutralización" y a "combustión" porque involucra 3+ sustancias con tags cruzados), se resuelve por orden de aparición en la lista de reglas del GDD (5.3): neutralización > combustión > incapacitación tóxica > degradación estructural > daño a tripulante > ignición espontánea. La regla de mayor prioridad consume las sustancias involucradas; las reglas de menor prioridad se re-evalúan sobre el resultado, no sobre los reactivos originales.

## 3. Mapeo de sustancias pre-mezcladas (5.4.3) a recetas de elementos base (5.4.1)

Para que estas sustancias sean sintetizables desde cero en modo creativo, no solo obtenibles del equipamiento inicial de la nave.

| Sustancia pre-mezclada | Receta de elementos |
|---|---|
| Oxígeno | Oxígeno (elemento puro, no requiere síntesis) |
| Nitrógeno | Nitrógeno (elemento puro) |
| Dióxido de carbono | Carbono + Oxígeno ×2 |
| Agua | Hidrógeno ×2 + Oxígeno |
| Nitrógeno líquido | Nitrógeno (elemento puro, licuado por presión/temperatura vía equipamiento, no por receta química) |
| Refrigerante sintético | Carbono + Flúor (análogo simplificado a un refrigerante halogenado) |
| Combustible de motor | Carbono + Hidrógeno (hidrocarburo simplificado) |
| Ácido de batería | Hidrógeno + Azufre + Oxígeno ×4 (análogo simplificado a ácido sulfúrico) |
| Ácido de laboratorio | Hidrógeno + Cloro (ácido clorhídrico, ver 5.4.2) |
| Base de laboratorio | Sodio + Oxígeno + Hidrógeno (análogo simplificado a hidróxido de sodio) |
| Disolvente volátil | Carbono + Hidrógeno + Oxígeno (análogo simplificado a un disolvente orgánico ligero) |
| Anestésico médico | Nitrógeno + Oxígeno (análogo simplificado a óxido nitroso) |
| Desinfectante | Yodo + Agua (yodo diluido) |
| Propelente/oxidante de munición | Potasio + Nitrógeno + Oxígeno ×3 (análogo simplificado a un oxidante nitrado) |

Estas recetas son simplificaciones de gameplay, no fórmulas químicas reales exactas — mantienen la coherencia interna del sistema de tags sin pretender precisión científica (consistente con el pilar de diseño 3 del GDD).

## 4. Parámetros de difusión atmosférica

Complementa GDD 5.5 (sistema de atmósfera).

| Parámetro | Valor de referencia |
|---|---|
| Velocidad de equilibrado entre dos secciones conectadas (válvula 100% abierta) | Diferencia de concentración se reduce ~10% por segundo hasta equilibrarse |
| Velocidad de equilibrado (válvula parcialmente abierta) | Proporcional al % de apertura (ej: 50% abierta → ~5% por segundo) |
| Válvula cerrada / puerta sellada | 0% — sin difusión, secciones completamente aisladas |
| Efecto del tamaño de sección | Secciones más grandes tardan proporcionalmente más en cambiar su concentración total ante el mismo caudal (el % de equilibrado se calcula sobre el volumen total de la sección, no un valor fijo) |
| Regeneración pasiva de O2 | Ninguna por defecto — una sección privada de oxígeno permanece así hasta reconexión activa de ventilación limpia, salvo equipamiento específico (ej: invernadero hidropónico de Exploración, generador de oxígeno de Médica) que la regenera activamente a tasa lenta |

## 5. Pendiente de expansión

- Ampliar la tabla de sección 3 conforme se definan más sustancias en el desarrollo del contenido de crisis.
- Validar los valores de referencia de secciones 1 y 4 contra playtesting real; son puntos de partida, no valores finales.
- Definir si el "Platino" (catalizador, 5.4.1 del GDD) necesita una regla de interacción propia en este documento (acelera una reacción sin consumirse) — actualmente no tiene parámetro numérico definido.
