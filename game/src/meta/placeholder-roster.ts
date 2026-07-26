import type { CrewActor, CrewActorId, CrewRoster } from "engine";

/**
 * PROVISIONAL: no existe todavía ningún generador de roster real de campaña
 * (tripulantes nombrados/progresión son Fase 11, GDD 6.8). Sin esto la
 * pantalla de selección de tripulación (Fase 9.5, punto 3) no tendría nada
 * que listar. 6 tripulantes genéricos cubriendo las 4 especialidades.
 */
export function buildPlaceholderRoster(): CrewRoster {
  const available: CrewActor[] = [
    { id: "crew-1" as CrewActorId, name: "Ríos", specialty: "ingeniero", tier: "veterano", trait: "estoico", hp: 100, maxHp: 100, status: "idle" },
    { id: "crew-2" as CrewActorId, name: "Vance", specialty: "medico", tier: "novato", trait: "ansioso", hp: 100, maxHp: 100, status: "idle" },
    { id: "crew-3" as CrewActorId, name: "Osei", specialty: "piloto", tier: "experto", trait: "disciplinado", hp: 100, maxHp: 100, status: "idle" },
    { id: "crew-4" as CrewActorId, name: "Kade", specialty: "seguridad", tier: "veterano", trait: "temerario", hp: 100, maxHp: 100, status: "idle" },
    { id: "crew-5" as CrewActorId, name: "Solis", specialty: "ingeniero", tier: "novato", trait: "sarcastico", hp: 100, maxHp: 100, status: "idle" },
    { id: "crew-6" as CrewActorId, name: "Petra", specialty: "medico", tier: "veterano", trait: "estoico", hp: 100, maxHp: 100, status: "idle" },
  ];
  return { available };
}
