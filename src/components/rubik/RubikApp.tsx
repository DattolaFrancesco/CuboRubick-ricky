"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { moveToString } from "@/lib/cube/moves";
import type { FaceId } from "@/lib/cube/types";
import { Controls } from "./Controls";
import { FaceEditor } from "./FaceEditor";
import { Toolbar } from "./Toolbar";
import { useFaceTextures } from "./useFaceTextures";
import { useRubikController } from "./useRubikController";

// Il canvas Three.js non deve essere renderizzato lato server (usa WebGL / window).
const Cube3D = dynamic(() => import("./Cube3D").then((m) => m.Cube3D), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-white/40">
      Caricamento scena 3D…
    </div>
  ),
});

type Tab = "mosse" | "personalizza";

const KEY_TO_FACE: Record<string, FaceId> = {
  u: "U",
  d: "D",
  l: "L",
  r: "R",
  f: "F",
  b: "B",
};

/**
 * Componente radice: possiede il controller del cubo (stato logico + coda +
 * animazione) e compone il layout. La scena 3D riceve lo stato e notifica
 * indietro sia il termine di un'animazione sia le mosse nate da trascinamento.
 */
export function RubikApp() {
  const rubik = useRubikController();
  const faceTex = useFaceTextures();
  const { enqueue } = rubik;
  const [tab, setTab] = useState<Tab>("mosse");
  const historyRef = useRef<HTMLOListElement>(null);

  // il cubo è "occupato" quando anima/ha una coda oppure sta calcolando la soluzione
  const busy = !rubik.idle;
  const solvingRef = useRef(rubik.solving);
  useEffect(() => {
    solvingRef.current = rubik.solving;
  });

  // scorciatoie da tastiera: U D L R F B (+ Shift = antiorario)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (solvingRef.current) return; // niente input manuale durante il calcolo
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      const face = KEY_TO_FACE[e.key.toLowerCase()];
      if (!face) return;
      e.preventDefault();
      enqueue({ face, dir: e.shiftKey ? -1 : 1 });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enqueue]);

  // tiene la cronologia scrollata in fondo
  useEffect(() => {
    const el = historyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rubik.history.length]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 p-4 lg:p-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-white sm:text-xl">Cubo di Rubik 3D</h1>
        <span className="text-xs text-white/40">step 4 · foto sulle facce</span>
      </header>

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_360px]">
        {/* Scena 3D */}
        <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f17] lg:min-h-0">
          <Cube3D
            cube={rubik.cube}
            animatingMove={rubik.animatingMove}
            turnId={rubik.turnId}
            textures={faceTex.textures}
            onMoveComplete={rubik.completeMove}
            onDragMove={(m) => rubik.enqueue(m)}
            dragEnabled={rubik.animatingMove === null}
          />
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/40 px-2 py-1 text-[11px] text-white/50">
            Trascina per orbitare ·{" "}
            <kbd className="rounded bg-white/15 px-1">Shift</kbd> + trascina una
            faccia per ruotare lo strato
          </div>
        </div>

        {/* Pannello laterale */}
        <aside className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <Toolbar
            onScramble={rubik.scramble}
            onSolve={rubik.solve}
            onReset={rubik.reset}
            busy={busy}
            solving={rubik.solving}
            solved={rubik.solved}
          />

          <div className="grid grid-cols-2 gap-2 text-center text-sm">
            <div className="rounded-lg bg-white/5 p-2">
              <div className="text-xl font-semibold text-white">{rubik.history.length}</div>
              <div className="text-[11px] text-white/40">
                mosse
                {rubik.solving
                  ? " · calcolo…"
                  : rubik.pending > 0
                    ? ` (+${rubik.pending} in coda)`
                    : ""}
              </div>
            </div>
            <div className="rounded-lg bg-white/5 p-2">
              <div
                className={`text-xl font-semibold ${
                  rubik.solved ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {rubik.solved ? "risolto" : "mescolato"}
              </div>
              <div className="text-[11px] text-white/40">stato</div>
            </div>
          </div>

          <div className="flex gap-1 rounded-lg bg-black/30 p-1">
            {(["mosse", "personalizza"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                  tab === t ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "mosse" ? (
              <Controls onMove={(m) => rubik.enqueue(m)} disabled={rubik.solving} />
            ) : (
              <FaceEditor tex={faceTex} />
            )}
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-white/80">Cronologia</h3>
              {rubik.history.length > 0 && (
                <button
                  type="button"
                  onClick={rubik.reset}
                  className="text-[11px] text-white/40 underline-offset-2 hover:underline"
                >
                  azzera
                </button>
              )}
            </div>
            {rubik.history.length === 0 ? (
              <p className="text-xs text-white/30">Nessuna mossa ancora.</p>
            ) : (
              <ol
                ref={historyRef}
                className="flex max-h-24 flex-wrap gap-1 overflow-y-auto text-xs"
              >
                {rubik.history.map((m, i) => (
                  <li
                    key={i}
                    className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/80"
                  >
                    {moveToString(m)}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
