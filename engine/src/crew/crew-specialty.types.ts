/**
 * Especialidad de un tripulante (GDD 6.1, 6.6). No es un bloqueo duro — GDD
 * 6.6: "cualquier tripulante puede intentar cualquier tarea", la especialidad
 * solo determina en qué acciones recibe el bonus de afinidad (`crew-affinity.ts`).
 */
export type CrewSpecialty = "ingeniero" | "medico" | "piloto" | "seguridad";
