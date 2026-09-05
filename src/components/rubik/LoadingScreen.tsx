interface LoadingScreenProps {
  /** avanzamento del caricamento, da 0 a 1 */
  progress: number;
}

/**
 * Schermata di caricamento a tutto schermo: copre il cubo mentre le foto
 * delle facce (grandi, decine di MB in totale) vengono scaricate. Sparisce
 * solo quando il caricamento è completo, così il cubo è già pronto e fluido
 * quando appare.
 */
export function LoadingScreen({ progress }: LoadingScreenProps) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#f1ede2] text-[#141414]">
      <h1 className="text-3xl font-bold leading-[0.95] tracking-tight sm:text-5xl">
        Cubo <span className="align-middle text-[0.55em]">✦</span> Fotografico
      </h1>

      <div className="mt-10 h-1.5 w-56 overflow-hidden rounded-full bg-black/10 sm:w-72">
        <div
          className="h-full rounded-full bg-[#141414] transition-[width] duration-150 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-3 text-xs font-medium tabular-nums text-[#141414]/50 sm:text-sm">
        {pct}%
      </p>

      <p className="mt-10 text-lg font-semibold text-[#141414]/80 sm:text-xl">
        Riccardo Battipede
      </p>
    </div>
  );
}
