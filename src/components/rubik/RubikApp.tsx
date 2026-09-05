"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { FaceId } from "@/lib/cube/types";
import type { CubeView } from "./CubeView";
import { Gallery, type GalleryTile } from "./Gallery";
import { LoadingScreen } from "./LoadingScreen";
import { useFaceTextures } from "./useFaceTextures";
import { useRubikController } from "./useRubikController";

// Il canvas Three.js non deve essere renderizzato lato server (usa WebGL / window).
const Cube3D = dynamic(() => import("./Cube3D").then((m) => m.Cube3D), {
  ssr: false,
});

const KEY_TO_FACE: Record<string, FaceId> = {
  u: "U",
  d: "D",
  l: "L",
  r: "R",
  f: "F",
  b: "B",
};

const ACTION_BTN_CLASS =
  "rounded-lg bg-[#141414] px-3 py-2 text-xs font-semibold text-white transition enabled:hover:bg-black disabled:opacity-30 sm:rounded-xl sm:px-6 sm:py-3 sm:text-sm";
const LOCK_BTN_ACTIVE_CLASS =
  "rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#141414] ring-2 ring-[#141414] transition sm:rounded-xl sm:px-6 sm:py-3 sm:text-sm";

/**
 * Componente radice: possiede il controller del cubo (stato logico + coda +
 * animazione) e compone l'impaginato "poster". La logica di mosse/drag/orbita
 * vive interamente in `CubeView` / `useRubikController`: qui solo layout.
 */
export function RubikApp() {
  const rubik = useRubikController();
  const faceTex = useFaceTextures();
  const { enqueue } = rubik;
  const busy = !rubik.idle;
  // avanzamento reale: quante foto sono già decodificate e applicate sul cubo
  // (non solo scaricate). Arriva a 1 esattamente quando il cubo è pronto.
  const [textureProgress, setTextureProgress] = useState({ loaded: 0, total: 0 });
  const ready =
    textureProgress.total > 0 && textureProgress.loaded >= textureProgress.total;

  const cubeViewRef = useRef<CubeView | null>(null);
  const [gallery, setGallery] = useState<GalleryTile[] | null>(null);

  // "Esplora": apre la galleria a tutto schermo con tutte le foto delle facce.
  // Mette in pausa il loop di rendering del cubo: è coperto dalla galleria,
  // tanto vale non sprecare GPU per disegnarlo.
  const openGallery = () => {
    const view = cubeViewRef.current;
    if (!view || busy || gallery) return;
    const tiles: GalleryTile[] = [];
    for (const [id, url] of Object.entries(faceTex.textures)) {
      const full = faceTex.getFullUrl(id) ?? url;
      if (full) tiles.push({ id, url: full });
    }
    if (tiles.length === 0) return;
    view.setPaused(true);
    setGallery(tiles);
  };

  const closeGallery = () => {
    setGallery(null);
    cubeViewRef.current?.setPaused(false);
  };

  // Blocco "Shift" da bottone: su touch non c'è un tasto Shift fisico, quindi
  // finché è attivo il trascinamento ruota sempre uno strato (stessa funzione
  // dello Shift tenuto premuto su desktop) invece di orbitare la vista.
  const [layerLock, setLayerLock] = useState(false);
  const toggleLayerLock = () => {
    setLayerLock((prev) => {
      const next = !prev;
      cubeViewRef.current?.setShiftLock(next);
      return next;
    });
  };

  // scorciatoie da tastiera: U D L R F B (+ Shift = antiorario)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
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

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#f1ede2] text-[#141414]">
      {/* Scena 3D a tutto schermo (sfondo trasparente, orbita con il trascinamento) */}
      <div className="absolute inset-0">
        <Cube3D
          cube={rubik.cube}
          animatingMove={rubik.animatingMove}
          turnId={rubik.turnId}
          textures={faceTex.textures}
          onMoveComplete={rubik.completeMove}
          onDragMove={(m) => rubik.enqueue(m)}
          dragEnabled={rubik.animatingMove === null}
          onTextureProgress={(loaded, total) => setTextureProgress({ loaded, total })}
          onReady={(view) => {
            cubeViewRef.current = view;
          }}
        />
      </div>

      {/* Testata — titolo a sinistra, marchi a destra (più piccola su mobile) */}
      <header className="pointer-events-none absolute inset-x-4 top-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-4 sm:inset-x-10 sm:top-10 sm:gap-x-8 sm:gap-y-6">
        <div>
          <h1 className="text-3xl font-bold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            Cubo <span className="align-middle text-[0.55em]">✦</span>
            <br />
            Fotografico
          </h1>
          <p className="mt-1 text-base font-semibold text-[#141414]/80 sm:mt-2 sm:text-4xl">
            Riccardo Battipede
          </p>
        </div>

        <div className="flex items-center gap-3 sm:gap-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/laba.svg"
            alt="LABA — Libera Accademia Belle Arti"
            className="h-6 w-auto sm:h-12"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fotografia.svg" alt="Fotografia" className="h-9 w-auto sm:h-20" />
        </div>
      </header>

      {/* Azioni — tutti e 4 i tasti sulla stessa riga, centrati in basso su
          mobile, in basso a destra da tablet in su. */}
      <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 px-3 sm:inset-x-auto sm:right-10 sm:bottom-10 sm:justify-end sm:gap-3 sm:px-0">
        <button
          type="button"
          onClick={rubik.solve}
          disabled={busy || rubik.solved}
          className={ACTION_BTN_CLASS}
        >
          {rubik.solving ? "Calcolo…" : "Risolvi"}
        </button>
        <button
          type="button"
          onClick={toggleLayerLock}
          aria-pressed={layerLock}
          title="Blocca l'orbita per ruotare gli strati col dito, come Shift su desktop"
          className={layerLock ? LOCK_BTN_ACTIVE_CLASS : ACTION_BTN_CLASS}
        >
          {layerLock ? "Sblocca" : "Blocca"}
        </button>
        <button
          type="button"
          onClick={rubik.scramble}
          disabled={busy}
          className={ACTION_BTN_CLASS}
        >
          Mescola
        </button>
        <button type="button" onClick={openGallery} disabled={busy} className={ACTION_BTN_CLASS}>
          Esplora
        </button>
      </div>

      {!ready && (
        <LoadingScreen
          progress={
            textureProgress.total > 0 ? textureProgress.loaded / textureProgress.total : 0
          }
        />
      )}

      {gallery && <Gallery tiles={gallery} onClose={closeGallery} />}
    </div>
  );
}
