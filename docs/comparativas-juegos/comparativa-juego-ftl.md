Aquí tienes el **análisis detallado de *FTL: Faster Than Light***, el maestro indiscutible en ritmo de crisis, triaje extremo y toma de decisiones tácticas bajo la ilusión de tiempo real.

---

## 1. El Bucle de Pausa Táctica: Control en Medio del Caos

*FTL* no es un juego de agilidad mental ni de hacer 200 clics por minuto. Su núcleo de diseño se apoya en un principio fundamental: **la tensión no nace de la prisa, sino de la gravedad de tus elecciones**.

### ¿Cómo funciona en FTL?

* En el momento en que suena una alarma o cae un proyectil, el jugador presiona la barra espaciadora. El tiempo se congela por completo.
* Durante la pausa, la UI permite inspeccionar cada sala, evaluar el nivel de oxígeno, ver los incendios activos, seleccionar tripulantes y asignar rutas de energía antes de quitar la pausa para ver la ejecución.

### La traducción directa para *Kludge*

* **El ritmo del "First 5 Minutes":** En *Kludge*, la alarma klaxon y la viñeta roja inyectan pánico visual, pero la **pausa táctica o modo de inspección** le da al jugador el espacio mental para leer los tags (`[ACT]`, `[COND]`, `[EM]`) con calma.
* **El diseño no debe castigar el pensamiento:** Al darle al jugador la capacidad de congelar o ralentizar el tiempo para planificar qué objeto canibalizar, transformas la crisis de un "test de reflejos frustrante" a un **puzle de ingeniería táctica de alta presión**.

---

## 2. Triaje Extremo: El Arte de Sacrificar lo Secundario

En *FTL*, la energía de la nave es un juego de suma cero. Si necesitas subir la potencia de los escudos para sobrevivir a una ráfaga, **tienes que apagar conscientemente el Soporte Vital o la Enfermería**.

### El patrón de conducta del jugador:

* El jugador aprende a convivir con el daño. Acepta que la sala de sensores esté destruida o en llamas mientras la nave siga volando.
* "Triaje" significa responder a la pregunta: *¿Qué es lo mínimo que necesito para no morir en los próximos 30 segundos?*

### Por qué esto valida el flujo de Canibalización en *Kludge*:

* En *Kludge*, el triaje deja de ser mover barras de energía en un menú abstracto para convertirse en una **decisión física y destructiva**.
* Para reparar el Soporte Vital con un `Motor pequeño`, el jugador debe desarmar el extractor del pasillo o la luz de un camarote. **Estás sacrificando la calidad ambiental de un sector no crítico para mantener con vida el núcleo de la nave.** Es la versión deconstruida de apagar la Enfermería en *FTL*.

---

## 3. Múltiples Frentes y Priorización de Incendios

El combate en *FTL* rara vez es un problema aislado. Generalmente enfrentas tres fallas en simultáneo: un fuego en la sala de motores, una brecha de casco en la sala de armas y un abordaje enemigo en el pasillo.

### Cómo gestiona FTL la sobrecarga cognitiva:

1. **Prioridad 1 (Amenaza Fatal):** La brecha de casco vacía el oxígeno (muerte en 10 segundos). Se atiende primero.
2. **Prioridad 2 (Amenaza Escalable):** El fuego se propaga lentamente si no se ahoga cortando el aire.
3. **Prioridad 3 (Incomodidad):** La pérdida de sensores no mata a nadie de inmediato; se ignora.

### Aplicación directa al "Crisis Engine" de *Kludge*:

* **Jerarquía de tags:** Cuando la nave entra en cascada, los tooltips deben dejar clara la gravedad mediante el color y el código de tag.
* Tag Rojo (`[COND]` Fuga de Oxígeno): Morirás en 15 segundos $\rightarrow$ Requiere bypass o reemplazo inmediato.
* Tag Ámbar (`[ACT]` Filtro Saturo): La eficiencia cae, pero hay tiempo $\rightarrow$ Canibalizar en la segunda fase.


* Esto entrena al jugador a no entrar en pánico intentando arreglar todo a la vez, sino a seguir una **lista de triaje militar**.

---

## 4. UI de Diagnóstico Inmediato: Comunicación Visual Clara

*FTL* utiliza una vista superior limpia en 2D donde los iconos de estado son universales e instantáneos. Un icono de llama roja es fuego, una habitación con tinte rosado es falta de O2, y una barra amarilla parpadeante es un sistema dañado.

### Implementación para la Fase 12 de *Kludge*:

| Elemento en *FTL* | Equivalente en *Kludge* (Fase 12) | Función de Experiencia |
| --- | --- | --- |
| **Habitación rosada (Sin O2)** | Viñeta roja pulsante + Tag `[COND]` en rojo | Señala visualmente el sector de la nave bajo crisis crítica. |
| **Barra de energía / Sistema caído** | Tag `[ACT]` parpadeante en el tooltip | Identifica el componente físico dañado que falta en el circuito. |
| **Pausa con Espacio** | Modo de Cableado / Inspección | Permite trazar líneas `[EM]` $\rightarrow$ `[REC]` sin estrés de tiempo real. |
| **Sonido de Alarma de Sistema** | Alarma Klaxon Diegética | Inyecta la urgencia auditiva que rompe la calma del jugador. |

---
