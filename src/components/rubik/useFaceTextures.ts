"use client";

import { useCallback, useEffect, useState } from "react";
import type { FaceId } from "@/lib/cube/types";

const STORAGE_KEY = "cubo-rubik:face-textures";

/**
 * Foto di default sulle facce, raggruppate per il tono dominante della foto
 * (giallo/dorato su D, verde su F, rosso su R, cielo/blu su B, bianco e nero
 * su U, arancione su L). Sostituibili in qualsiasi momento dall'utente
 * tramite l'editor delle facce (la personalizzazione salvata in localStorage
 * vince su questi default).
 *
 * Le foto originali sono scatti DSLR a piena risoluzione (fino a ~18MB l'una,
 * ~420MB in totale): caricarle così com'è come texture del cubo mandava in
 * crash i browser mobile (decodifica di decine di bitmap enormi in GPU).
 * `DEFAULT_TEXTURES` usa quindi le copie ridotte in `/foto-cube/` (generate
 * con `scripts/resize-cube-textures.mjs`, max 640px, ~3MB totali), mentre
 * `DEFAULT_TEXTURES_FULL` mantiene i percorsi originali per la vista
 * ingrandita della galleria "Esplora".
 */
const FACE_FILES: Record<string, string> = {
  D0: "_D2A3973.jpg",
  D1: "_D2A4024.jpg",
  D2: "_D2A4226.jpg",
  D3: "_D2A4235.jpg",
  D4: "_D2A4266.jpg",
  D5: "_D2A4424.jpg",
  D6: "_D2A4537.jpg",
  D7: "_D2A4544.jpg",
  D8: "_D2A4559.jpg",
  F0: "_D2A4332.jpg",
  F1: "_D2A4782.jpg",
  F2: "_D2A5507.jpg",
  F3: "_D2A5504.jpg",
  F4: "_D2A5518.jpg",
  F5: "_D2A5529.jpg",
  F6: "_D2A5548.jpg",
  F7: "_D2A5547.jpg",
  F8: "_D2A5596.jpg",
  R0: "_D2A5631.jpg",
  R1: "_D2A5636.jpg",
  R2: "_D2A5642.jpg",
  R3: "_D2A5645.jpg",
  R4: "_D2A5658.jpg",
  R5: "_D2A5659.jpg",
  R6: "_D2A5661.jpg",
  R7: "_D2A5663.jpg",
  R8: "_D2A5610.jpg",
  B0: "_D2A3317.jpg",
  B1: "_D2A4343.jpg",
  B2: "_D2A5578.jpg",
  B3: "_D2A5603.jpg",
  B4: "_D2A5646.jpg",
  B5: "_D2A5650.jpg",
  B6: "_D2A8490.jpg",
  B7: "_D2A9236.jpg",
  B8: "_D2A3796.jpg",
  U0: "_D2A4022.jpg",
  U1: "_D2A4245.jpg",
  U2: "_D2A4215.jpg",
  U3: "_D2A4344.jpg",
  U4: "_D2A4494.jpg",
  U5: "_D2A4671.jpg",
  U6: "_D2A4841.jpg",
  U7: "_D2A4845.jpg",
  U8: "_D2A4853.jpg",
  L0: "_D2A4433.jpg",
  L1: "_D2A4902.jpg",
  L2: "_D2A5508.jpg",
  L3: "_D2A5520.jpg",
  L4: "_D2A5530.jpg",
  L5: "_D2A5532.jpg",
  L6: "_D2A5535.jpg",
  L7: "_D2A5540.jpg",
  L8: "_D2A5570.jpg",
};

const DEFAULT_TEXTURES: Record<string, string> = Object.fromEntries(
  Object.entries(FACE_FILES).map(([id, file]) => [id, `/foto-cube/${file}`]),
);

const DEFAULT_TEXTURES_FULL: Record<string, string> = Object.fromEntries(
  Object.entries(FACE_FILES).map(([id, file]) => [id, `/foto/${file}`]),
);

/** Legge le personalizzazioni salvate, sopra i default (vuoto lato server). */
function loadFromStorage(): Record<string, string> {
  if (typeof window === "undefined") return { ...DEFAULT_TEXTURES };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return { ...DEFAULT_TEXTURES, ...saved };
  } catch {
    return { ...DEFAULT_TEXTURES };
  }
}

/**
 * Id degli sticker di una faccia, in ordine di griglia
 * (0..8, sinistra->destra, alto->basso). Coincide con l'id "da risolto"
 * (`${face}${indice}`): è stabile, quindi la texture segue il quadratino
 * durante mescolamento e risoluzione.
 */
export function faceStickerIds(face: FaceId): string[] {
  return Array.from({ length: 9 }, (_, i) => `${face}${i}`);
}

export interface FaceTextures {
  /** map stickerId -> data URL, solo per gli sticker personalizzati */
  textures: Record<string, string>;
  /** scrive le 9 immagini di una faccia (null in una posizione = torna al colore) */
  applyFace: (face: FaceId, images: (string | null)[]) => void;
  /** rimuove le personalizzazioni di una faccia */
  resetFace: (face: FaceId) => void;
  /** rimuove tutte le personalizzazioni */
  resetAll: () => void;
  /** true se almeno uno sticker della faccia è personalizzato */
  faceHasCustom: (face: FaceId) => boolean;
  /**
   * URL a piena risoluzione per uno sticker (per la vista ingrandita della
   * galleria): la foto originale se è un default, altrimenti la stessa
   * personalizzazione usata sul cubo (già di dimensioni contenute).
   */
  getFullUrl: (id: string) => string | undefined;
}

/**
 * Stato delle foto applicate agli sticker, con persistenza in `localStorage`
 * (data URL JPEG, già ridimensionati a monte).
 */
export function useFaceTextures(): FaceTextures {
  // init "lazy": su client legge subito da localStorage, su server parte vuoto
  const [textures, setTextures] = useState<Record<string, string>>(loadFromStorage);

  useEffect(() => {
    try {
      // salva solo le personalizzazioni reali (diverse dal default corrente):
      // se salvassimo l'intera mappa, un aggiornamento futuro dei default
      // (es. nuove foto, percorsi ottimizzati) non raggiungerebbe mai chi ha
      // già visitato il sito, perché troverebbe i vecchi valori "congelati".
      const custom: Record<string, string> = {};
      for (const [id, url] of Object.entries(textures)) {
        if (url !== DEFAULT_TEXTURES[id]) custom[id] = url;
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    } catch {
      // quota superata o storage non disponibile: si prosegue solo in memoria
    }
  }, [textures]);

  const applyFace = useCallback((face: FaceId, images: (string | null)[]) => {
    setTextures((prev) => {
      const next = { ...prev };
      faceStickerIds(face).forEach((id, i) => {
        const img = images[i];
        if (img) next[id] = img;
        else delete next[id];
      });
      return next;
    });
  }, []);

  const resetFace = useCallback((face: FaceId) => {
    setTextures((prev) => {
      const next = { ...prev };
      for (const id of faceStickerIds(face)) delete next[id];
      return next;
    });
  }, []);

  const resetAll = useCallback(() => setTextures({}), []);

  const faceHasCustom = useCallback(
    (face: FaceId) => faceStickerIds(face).some((id) => textures[id]),
    [textures],
  );

  const getFullUrl = useCallback(
    (id: string) => (textures[id] === DEFAULT_TEXTURES[id] ? DEFAULT_TEXTURES_FULL[id] : textures[id]),
    [textures],
  );

  return { textures, applyFace, resetFace, resetAll, faceHasCustom, getFullUrl };
}
