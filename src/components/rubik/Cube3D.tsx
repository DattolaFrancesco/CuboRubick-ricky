"use client";

import { useEffect, useRef } from "react";
import type { CubeState, Move } from "@/lib/cube/types";
import { CubeView } from "./CubeView";

interface Cube3DProps {
  cube: CubeState;
  animatingMove: Move | null;
  /** cambia a ogni nuova mossa / reset: fa scattare l'effetto di animazione */
  turnId: number;
  /** foto personalizzate: id sticker -> data URL */
  textures: Record<string, string>;
  onMoveComplete: (move: Move) => void;
  onDragMove: (move: Move) => void;
  dragEnabled: boolean;
  /** avanzamento reale del caricamento foto (quante pronte sul cubo, su quante totali) */
  onTextureProgress?: (loaded: number, total: number) => void;
}

/**
 * Ponte React <-> Three.js.
 *
 * La scena vera e propria è gestita in modo imperativo da `CubeView` (Three.js
 * puro). Questo componente:
 *  - crea/distrugge la vista al mount/unmount;
 *  - tiene aggiornati dei "ref specchio" con props e callback, così la vista li
 *    legge sempre freschi senza essere ricreata;
 *  - a ogni cambio di `animatingMove`/`turnId` chiede alla vista di animare la
 *    mossa (o di risincronizzarsi con lo stato, es. dopo un reset).
 */
export function Cube3D({
  cube,
  animatingMove,
  turnId,
  textures,
  onMoveComplete,
  onDragMove,
  dragEnabled,
  onTextureProgress,
}: Cube3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<CubeView | null>(null);

  const cubeRef = useRef(cube);
  const texturesRef = useRef(textures);
  const onDragMoveRef = useRef(onDragMove);
  const dragEnabledRef = useRef(dragEnabled);
  const onMoveCompleteRef = useRef(onMoveComplete);
  const onTextureProgressRef = useRef(onTextureProgress);

  // mantiene i ref specchio allineati a ogni render (senza scriverli in render)
  useEffect(() => {
    cubeRef.current = cube;
    texturesRef.current = textures;
    onDragMoveRef.current = onDragMove;
    dragEnabledRef.current = dragEnabled;
    onMoveCompleteRef.current = onMoveComplete;
    onTextureProgressRef.current = onTextureProgress;
  });

  // crea la vista Three.js una volta sola
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const view = new CubeView(mount, {
      onDragMove: (m) => onDragMoveRef.current(m),
      getCube: () => cubeRef.current,
      isDragEnabled: () => dragEnabledRef.current,
      onTextureProgress: (loaded, total) => onTextureProgressRef.current?.(loaded, total),
    });
    view.syncTo(cubeRef.current);
    view.applyTextures(texturesRef.current);
    viewRef.current = view;

    return () => {
      view.dispose();
      viewRef.current = null;
    };
  }, []);

  // applica le foto personalizzate quando cambiano
  useEffect(() => {
    viewRef.current?.applyTextures(textures);
  }, [textures]);

  // reagisce a ogni nuova mossa / reset
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (animatingMove) {
      view.animateMove(animatingMove, cubeRef.current, () =>
        onMoveCompleteRef.current(animatingMove),
      );
    } else {
      view.syncTo(cubeRef.current);
    }
  }, [animatingMove, turnId]);

  return <div ref={mountRef} className="h-full w-full" />;
}
