// Shared persona helpers
import { Persona, DEFAULT_PERSONAS } from "./personas";

export const STORAGE_KEY = "custom_personas_v1";
export const LAST_PERSONA_ID_KEY = "last_persona_id";
export const LAST_PERSONA_KEY = "last_persona_json";

export function loadCustomPersonas(): Persona[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as Persona[];
        return (parsed ?? []).filter(p => p?.id && p?.name);
    } catch {
        return [];
    }
}

export function getAllPersonas(): Persona[] {
    const custom = loadCustomPersonas();
    const customIds = new Set(custom.map(p => p.id));
    const defaults = DEFAULT_PERSONAS.filter(p => !customIds.has(p.id));
    return [...custom, ...defaults];
}

export function resolvePersonaById(id: string | null | undefined): Persona | null {
    if (!id) return null;
    return getAllPersonas().find(p => p.id === id) ?? null;
}
