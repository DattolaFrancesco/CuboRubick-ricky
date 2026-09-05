import { parseSequence } from "./moves";
import type { Move } from "./types";

/**
 * Client del Web Worker di risoluzione. Espone `solve()` che ritorna la
 * sequenza di mosse (già parsata) per risolvere lo stato dato.
 */
export interface CubeSolver {
  solve(facelets: string): Promise<Move[]>;
  dispose(): void;
}

interface WorkerReply {
  id: number;
  solution?: string;
  error?: string;
}

export function createCubeSolver(): CubeSolver {
  const worker = new Worker(new URL("./solver.worker.ts", import.meta.url), {
    type: "module",
  });

  const pending = new Map<
    number,
    { resolve: (m: Move[]) => void; reject: (e: Error) => void }
  >();
  let nextId = 1;

  worker.onmessage = (e: MessageEvent<WorkerReply>) => {
    const entry = pending.get(e.data.id);
    if (!entry) return;
    pending.delete(e.data.id);
    if (e.data.error) entry.reject(new Error(e.data.error));
    else entry.resolve(parseSequence(e.data.solution ?? ""));
  };

  worker.onerror = (e) => {
    for (const { reject } of pending.values()) reject(new Error(e.message));
    pending.clear();
  };

  // pre-riscaldamento: fa costruire subito le tabelle di pruning (id 0 = nessun
  // listener) così la prima risoluzione vera parte senza attesa.
  worker.postMessage({
    id: 0,
    facelets: "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB",
  });

  return {
    solve(facelets) {
      return new Promise<Move[]>((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, facelets });
      });
    },
    dispose() {
      worker.terminate();
      pending.clear();
    },
  };
}
