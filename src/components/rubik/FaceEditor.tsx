"use client";

import { useRef, useState } from "react";
import { FACE_IDS, type FaceId } from "@/lib/cube/types";
import { COLOR_HEX, FACE_COLOR } from "@/lib/cube/colors";
import { fileToSquareDataURL } from "@/lib/cube/imageUtils";
import { faceStickerIds, type FaceTextures } from "./useFaceTextures";

const FACE_LABEL: Record<FaceId, string> = {
  U: "Su",
  D: "Giù",
  L: "Sinistra",
  R: "Destra",
  F: "Fronte",
  B: "Retro",
};

/**
 * Pannello "Personalizza": per ogni faccia si caricano 9 immagini (una per
 * quadratino), se ne vede l'anteprima a griglia 3×3 e con "Applica" si
 * confermano sul cubo 3D. Reset per singola faccia o per tutto il cubo.
 *
 * `staging` è la bozza locale (ciò che vedi in anteprima); `tex.textures` è
 * quanto già applicato al cubo. "Applica" scrive staging -> textures.
 */
export function FaceEditor({ tex }: { tex: FaceTextures }) {
  const [face, setFace] = useState<FaceId>("F");
  const [staging, setStaging] = useState<(string | null)[]>(() => Array(9).fill(null));
  const [confirmAll, setConfirmAll] = useState(false);
  const [dragSlot, setDragSlot] = useState<number | null>(null);
  const [syncedFace, setSyncedFace] = useState<FaceId | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const slotInput = useRef<HTMLInputElement>(null);
  const bulkInput = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef(0);

  const committed = faceStickerIds(face).map((id) => tex.textures[id] ?? null);

  // Al cambio di faccia la bozza riparte da ciò che è già applicato su quella
  // faccia. (Aggiustamento di stato in fase di render: pattern React consigliato
  // per derivare stato da una prop che cambia.)
  if (syncedFace !== face) {
    setSyncedFace(face);
    setStaging(committed);
    setConfirmAll(false);
    setErrors([]);
  }

  const dirty = staging.some((s, i) => s !== committed[i]);
  const stagingEmpty = staging.every((s) => s === null);
  const defaultColor = COLOR_HEX[FACE_COLOR[face]];

  const setSlot = (i: number, url: string | null) =>
    setStaging((prev) => prev.map((s, j) => (j === i ? url : s)));

  const processFiles = async (files: FileList | File[], startSlot: number) => {
    const list = [...files];
    const failures: string[] = [];
    let slot = startSlot; // avanza solo sulle immagini caricate con successo

    for (const file of list) {
      if (slot >= 9) break;
      try {
        const url = await fileToSquareDataURL(file);
        setSlot(slot, url);
        slot += 1;
      } catch (err) {
        failures.push(err instanceof Error ? err.message : String(err));
      }
    }
    setErrors(failures);
  };

  return (
    <div className="space-y-4">
      {/* selettore faccia */}
      <div className="grid grid-cols-3 gap-1.5">
        {FACE_IDS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFace(f)}
            className={`relative rounded-md px-2 py-1.5 text-xs font-medium transition ${
              face === f
                ? "bg-white/15 text-white"
                : "bg-white/5 text-white/60 hover:text-white/90"
            }`}
          >
            {FACE_LABEL[f]}
            {tex.faceHasCustom(f) && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
            )}
          </button>
        ))}
      </div>

      {/* anteprima / editor a griglia 3×3 */}
      <div>
        <p className="mb-1.5 text-[11px] text-white/40">
          Anteprima faccia <span className="text-white/70">{FACE_LABEL[face]}</span> —
          clic su un riquadro per scegliere la foto, o trascinacela sopra.
        </p>
        <div
          className="grid grid-cols-3 gap-1.5 rounded-lg bg-black/40 p-1.5"
          style={{ aspectRatio: "1" }}
        >
          {staging.map((url, i) => (
            <div
              key={i}
              onClick={() => {
                pendingSlot.current = i;
                slotInput.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragSlot(i);
              }}
              onDragLeave={() => setDragSlot((s) => (s === i ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragSlot(null);
                if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files, i);
              }}
              className={`group relative cursor-pointer overflow-hidden rounded ${
                dragSlot === i ? "ring-2 ring-emerald-400" : ""
              }`}
              style={
                url
                  ? { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : { backgroundColor: defaultColor }
              }
            >
              {url && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSlot(i, null);
                  }}
                  className="absolute right-0.5 top-0.5 hidden rounded bg-black/60 px-1 text-[10px] text-white group-hover:block"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* azioni */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => bulkInput.current?.click()}
            className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
          >
            Carica immagini…
          </button>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => tex.applyFace(face, staging)}
            className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition enabled:hover:bg-emerald-500 disabled:opacity-40"
          >
            Applica al cubo
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={stagingEmpty && !tex.faceHasCustom(face)}
            onClick={() => {
              tex.resetFace(face);
              setStaging(Array(9).fill(null));
            }}
            className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white/70 transition enabled:hover:bg-white/10 disabled:opacity-40"
          >
            Reset faccia {FACE_LABEL[face]}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirmAll) {
                setConfirmAll(true);
                return;
              }
              tex.resetAll();
              setStaging(Array(9).fill(null));
              setConfirmAll(false);
            }}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
              confirmAll
                ? "border-red-500/60 bg-red-500/15 text-red-300"
                : "border-white/15 text-white/70 hover:bg-white/10"
            }`}
          >
            {confirmAll ? "Confermi? Reset totale" : "Reset tutto il cubo"}
          </button>
        </div>

        {dirty && (
          <p className="text-[11px] text-amber-400/80">
            Modifiche non applicate — premi «Applica al cubo» per vederle in 3D.
          </p>
        )}

        {errors.length > 0 && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-[11px] text-red-300">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium">
                {errors.length === 1
                  ? "1 immagine non caricata"
                  : `${errors.length} immagini non caricate`}
              </span>
              <button
                type="button"
                onClick={() => setErrors([])}
                className="text-red-300/70 hover:text-red-200"
              >
                ×
              </button>
            </div>
            <ul className="list-disc space-y-0.5 pl-4">
              {errors.slice(0, 4).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            <p className="mt-1 text-red-300/60">
              Suggerimento: usa foto in JPG o PNG (le HEIC dell&apos;iPhone non
              sono leggibili dal browser).
            </p>
          </div>
        )}
      </div>

      {/* input file nascosti */}
      <input
        ref={slotInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          if (e.target.files?.length) processFiles(e.target.files, pendingSlot.current);
          e.target.value = "";
        }}
      />
      <input
        ref={bulkInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) processFiles(e.target.files, 0);
          e.target.value = "";
        }}
      />
    </div>
  );
}
