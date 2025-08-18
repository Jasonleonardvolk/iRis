// Lightweight show-mode orchestrator
export type ShowMode = 'particles'|'portal'|'anamorph'|'glyphs'|'penrose';
export type ShowAPI = { start(canvas: HTMLCanvasElement): void; stop(): void; onResize?(): void; onBoost?(on:boolean):void; };

const registry = new Map<ShowMode, () => Promise<ShowAPI>>();
export function register(mode: ShowMode, loader: () => Promise<ShowAPI>) { registry.set(mode, loader); }

export async function load(mode: ShowMode) {
  const f = registry.get(mode); if (!f) throw new Error(`Unknown mode ${mode}`);
  return await f();
}
export function pickFromQuery(u: URL): ShowMode|null {
  const q = (u.searchParams.get('mode') ?? u.searchParams.get('m') ?? '').toLowerCase();
  if (['particles','portal','anamorph','glyphs','penrose'].includes(q)) return q as ShowMode;
  return null;
}
