"use client";

interface ToolbarProps {
  onScramble: () => void;
  onSolve: () => void;
  onReset: () => void;
  /** true mentre animazioni/coda sono in corso o si sta calcolando la soluzione */
  busy: boolean;
  /** true durante il calcolo della soluzione (worker) */
  solving: boolean;
  /** true se il cubo è già risolto */
  solved: boolean;
}

/**
 * Azioni globali: Mescola (sequenza casuale), Risolvi (soluzione Kociemba
 * animata passo-passo), Reset (torna a risolto).
 */
export function Toolbar({
  onScramble,
  onSolve,
  onReset,
  busy,
  solving,
  solved,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onScramble}
        disabled={busy}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-indigo-500 disabled:opacity-40"
      >
        Mescola
      </button>
      <button
        type="button"
        onClick={onSolve}
        disabled={busy || solved}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-emerald-500 disabled:opacity-40"
      >
        {solving ? "Calcolo…" : "Risolvi"}
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={solving}
        className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition enabled:hover:bg-white/10 disabled:opacity-40"
      >
        Reset cubo
      </button>
    </div>
  );
}
