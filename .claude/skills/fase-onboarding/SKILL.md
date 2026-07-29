---
name: fase-onboarding
description: Genera o actualiza un mapa conciso de la arquitectura del código relevante antes de empezar una fase o sub-fase nueva. Úsalo cuando el usuario diga que va a empezar una fase/sub-fase, pida "entender el estado actual del código", o antes de planificar cambios que dependen de código ya existente.
context: fork
agent: Explore
---
 
Objetivo: producir un mapa de arquitectura ACTUALIZADO y CONCISO, no una relectura completa del repositorio. El resultado debe poder leerse en menos de un minuto.
 
1. Si existe `MAPA_DEL_CODIGO.md` en la raíz del proyecto, léelo primero. Es la fuente de verdad de lo que ya se sabe del código — no lo redescubras desde cero.
2. Lee `ORDEN_DE_TRABAJO.md` (solo la sección de fase activa, no el historial de fases cerradas) para saber qué sigue y qué dominios del GDD toca.
3. Compara: ¿qué módulos relevantes a la fase que sigue NO están cubiertos en `MAPA_DEL_CODIGO.md`, o pueden haber cambiado desde la última actualización del mapa? Explora SOLO esos, no el repo entero.
4. Para cada módulo a explorar: usa Glob para ubicarlo, Grep para encontrar sus exportaciones públicas principales (clases/funciones/tipos), y lee completo solo el archivo que resulte claramente central para la fase que sigue. Evita leer archivos completos "por si acaso".
5. Corre la suite de tests y reporta el estado base (qué pasa, qué falla) antes de tocar nada.
6. Entrega un resumen estructurado: módulo → responsabilidad en una línea → archivos clave → funciones/tipos relevantes para la fase que sigue.
7. Si el mapa quedó desactualizado o incompleto respecto a lo que encontraste, dilo explícitamente al final — actualizarlo es una tarea de cierre de fase, no de este skill, pero el hueco debe quedar señalado, no en silencio.
Si la fase que sigue es ambigua o `ORDEN_DE_TRABAJO.md` no deja claro qué dominios toca, preguntar antes de explorar a ciegas — no asumir alcance.
 