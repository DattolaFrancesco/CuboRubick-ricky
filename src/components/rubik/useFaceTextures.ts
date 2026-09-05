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
 */
const DEFAULT_TEXTURES: Record<string, string> = {
  D0: "/foto/_D2A3973.jpg",
  D1: "/foto/_D2A4024.jpg",
  D2: "/foto/_D2A4226.jpg",
  D3: "/foto/_D2A4235.jpg",
  D4: "/foto/_D2A4266.jpg",
  D5: "/foto/_D2A4424.jpg",
  D6: "/foto/_D2A4537.jpg",
  D7: "/foto/_D2A4544.jpg",
  D8: "/foto/_D2A4559.jpg",
  F0: "/foto/_D2A4332.jpg",
  F1: "/foto/_D2A4782.jpg",
  F2: "/foto/_D2A5507.jpg",
  F3: "/foto/_D2A5504.jpg",
  F4: "/foto/_D2A5518.jpg",
  F5: "/foto/_D2A5529.jpg",
  F6: "/foto/_D2A5548.jpg",
  F7: "/foto/_D2A5547.jpg",
  F8: "/foto/_D2A5596.jpg",
  R0: "/foto/_D2A5631.jpg",
  R1: "/foto/_D2A5636.jpg",
  R2: "/foto/_D2A5642.jpg",
  R3: "/foto/_D2A5645.jpg",
  R4: "/foto/_D2A5658.jpg",
  R5: "/foto/_D2A5659.jpg",
  R6: "/foto/_D2A5661.jpg",
  R7: "/foto/_D2A5663.jpg",
  R8: "/foto/_D2A5610.jpg",
  B0: "/foto/_D2A3317.jpg",
  B1: "/foto/_D2A4343.jpg",
  B2: "/foto/_D2A5578.jpg",
  B3: "/foto/_D2A5603.jpg",
  B4: "/foto/_D2A5646.jpg",
  B5: "/foto/_D2A5650.jpg",
  B6: "/foto/_D2A8490.jpg",
  B7: "/foto/_D2A9236.jpg",
  B8: "/foto/_D2A3796.jpg",
  U0: "/foto/_D2A4022.jpg",
  U1: "/foto/_D2A4245.jpg",
  U2: "/foto/_D2A4215.jpg",
  U3: "/foto/_D2A4344.jpg",
  U4: "/foto/_D2A4494.jpg",
  U5: "/foto/_D2A4671.jpg",
  U6: "/foto/_D2A4841.jpg",
  U7: "/foto/_D2A4845.jpg",
  U8: "/foto/_D2A4853.jpg",
  L0: "/foto/_D2A4433.jpg",
  L1: "/foto/_D2A4902.jpg",
  L2: "/foto/_D2A5508.jpg",
  L3: "/foto/_D2A5520.jpg",
  L4: "/foto/_D2A5530.jpg",
  L5: "/foto/_D2A5532.jpg",
  L6: "/foto/_D2A5535.jpg",
  L7: "/foto/_D2A5540.jpg",
  L8: "/foto/_D2A5570.jpg",
};

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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(textures));
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

  return { textures, applyFace, resetFace, resetAll, faceHasCustom };
}
