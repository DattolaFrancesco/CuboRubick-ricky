"use client";

import { ALL_FACES } from "@/lib/cube/moves";
import type { FaceId, Move } from "@/lib/cube/types";

const FACE_LABEL: Record<FaceId, string> = {
  U: "Su (U)",
  D: "Giù (D)",
  L: "Sinistra (L)",
  R: "Destra (R)",
  F: "Fronte (F)",
  B: "Retro (B)",
};

interface ControlsProps {
  onMove: (move: Move) => void;
  disabled?: boolean;
}

/**
 * Pulsanti di rotazione degli strati: per ogni faccia orario (X), antiorario
 * (X') e doppio (X2). Le mosse vengono accodate nel controller e animate.
 */
export function Controls({ onMove, disabled }: ControlsProps) {
  const btn =
    "flex-1 px-2 py-2 text-sm font-medium text-white/85 transition enabled:hover:bg-white/10 disabled:opacity-40";

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white/80">Ruota uno strato</h3>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ALL_FACES.map((face) => (
          <div key={face} className="rounded-lg border border-white/10">
            <div className="border-b border-white/10 px-2 py-1 text-[11px] text-white/40">
              {FACE_LABEL[face]}
            </div>
            <div className="flex divide-x divide-white/10">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onMove({ face, dir: 1 })}
                className={btn}
              >
                {face}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onMove({ face, dir: -1 })}
                className={btn}
              >
                {face}&apos;
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onMove({ face, dir: 1, double: true })}
                className={btn}
              >
                {face}2
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-white/40">
        Da tastiera: <kbd className="rounded bg-white/10 px-1">U D L R F B</kbd> per
        la mossa oraria, con <kbd className="rounded bg-white/10 px-1">Shift</kbd>{" "}
        per l&apos;antioraria. Oppure{" "}
        <kbd className="rounded bg-white/10 px-1">Shift</kbd> + trascina una faccia
        del cubo.
      </p>
    </div>
  );
}
