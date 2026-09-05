"use client";

import { useCallback, useEffect, useState } from "react";
import type { FaceId } from "@/lib/cube/types";

const STORAGE_KEY = "cubo-rubik:face-textures";

/** Legge le personalizzazioni salvate (vuoto su server o se lo storage non è leggibile). */
function loadFromStorage(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
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
