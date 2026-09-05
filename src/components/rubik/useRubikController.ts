"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSolvedCube, isSolved, toFacelets } from "@/lib/cube/state";
import { applyMove } from "@/lib/cube/moves";
import { randomScramble } from "@/lib/cube/scramble";
import { createCubeSolver, type CubeSolver } from "@/lib/cube/solver";
import type { CubeState, Move } from "@/lib/cube/types";

export interface RubikController {
  /** Stato logico corrente (aggiornato al termine di ogni animazione). */
  cube: CubeState;
  /** Mossa attualmente in animazione (testa della coda), o null. */
  animatingMove: Move | null;
  /** Cambia a ogni nuova mossa / reset: fa scattare l'effetto di animazione. */
  turnId: number;
  /** Storia delle mosse effettivamente completate. */
  history: Move[];
  /** Mosse in coda dietro a quella in animazione. */
  pending: number;
  /** True se non c'è nulla in corso (coda vuota e nessun calcolo di risoluzione). */
  idle: boolean;
  /** True se è in corso il calcolo della soluzione (worker). */
  solving: boolean;
  /** True se il cubo è risolto. */
  solved: boolean;
  /** Accoda una o più mosse da animare in sequenza. */
  enqueue: (moves: Move | Move[]) => void;
  /** Da chiamare dalla scena quando l'animazione della mossa `move` è finita. */
  completeMove: (move: Move) => void;
  /** Svuota coda, ferma animazioni e riporta il cubo a risolto. */
  reset: () => void;
  /** Accoda una mescolata casuale. */
  scramble: () => void;
  /** Calcola la soluzione (Kociemba) e la accoda mossa per mossa. */
  solve: () => Promise<void>;
}

/**
 * Coordina stato logico del cubo, coda delle mosse, animazione e risoluzione.
 *
 * La coda È la sorgente di verità dell'animazione: `queue[0]` è la mossa in
 * corso. La scena la anima e a fine animazione chiama `completeMove`, che
 * applica quella mossa al modello logico, la rimuove dalla coda e incrementa
 * `turnId`. Nessun effetto/cascata: tutto parte da callback.
 */
export function useRubikController(): RubikController {
  const [cube, setCube] = useState<CubeState>(createSolvedCube);
  const [history, setHistory] = useState<Move[]>([]);
  const [queue, setQueue] = useState<Move[]>([]);
  const [turnId, setTurnId] = useState(0);
  const [solving, setSolving] = useState(false);

  // specchio dello stato per i callback asincroni (il solver è una Promise)
  const cubeRef = useRef(cube);
  useEffect(() => {
    cubeRef.current = cube;
  });

  // solver in un Web Worker, creato una volta sola lato client
  const solverRef = useRef<CubeSolver | null>(null);
  useEffect(() => {
    solverRef.current = createCubeSolver();
    return () => {
      solverRef.current?.dispose();
      solverRef.current = null;
    };
  }, []);

  const completeMove = useCallback((move: Move) => {
    // setState separati con updater puri (idempotenti / StrictMode-safe).
    setQueue((q) => (q[0] === move ? q.slice(1) : q));
    setCube((c) => applyMove(c, move));
    setHistory((h) => [...h, move]);
    setTurnId((n) => n + 1);
  }, []);

  const enqueue = useCallback((moves: Move | Move[]) => {
    setQueue((q) => [...q, ...(Array.isArray(moves) ? moves : [moves])]);
  }, []);

  const reset = useCallback(() => {
    setQueue([]);
    setCube(createSolvedCube());
    setHistory([]);
    setTurnId((n) => n + 1);
  }, []);

  const scramble = useCallback(() => {
    enqueue(randomScramble(20));
  }, [enqueue]);

  const solve = useCallback(async () => {
    const solver = solverRef.current;
    if (!solver) return;
    setSolving(true);
    try {
      const moves = await solver.solve(toFacelets(cubeRef.current));
      enqueue(moves);
    } catch (err) {
      console.error("Risoluzione fallita:", err);
    } finally {
      setSolving(false);
    }
  }, [enqueue]);

  const solved = useMemo(() => isSolved(cube), [cube]);

  return {
    cube,
    animatingMove: queue[0] ?? null,
    turnId,
    history,
    pending: Math.max(0, queue.length - 1),
    idle: queue.length === 0 && !solving,
    solving,
    solved,
    enqueue,
    completeMove,
    reset,
    scramble,
    solve,
  };
}
