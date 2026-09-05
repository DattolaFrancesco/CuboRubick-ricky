"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export interface GalleryTile {
  id: string;
  url: string;
}

interface GalleryProps {
  tiles: GalleryTile[];
  onClose: () => void;
}

const ENTER_MS = 340;
const ENTER_STAGGER_MS = 8;
const EXIT_MS = 200;
const EXIT_STAGGER_MS = 4;

/**
 * Galleria a tutto schermo delle foto del cubo. Ogni riquadro entra (e esce)
 * con un fade + scale scaglionato, gestito da un'animazione CSS con
 * `animation-delay` per indice: niente "volo" dal cubo, che con 54 foto tutte
 * in partenza dallo stesso punto produceva un groviglio sovrapposto durante la
 * transizione (peggiorato online dalle foto ancora in caricamento).
 */
export function Gallery({ tiles, onClose }: GalleryProps) {
  const [closing, setClosing] = useState(false);
  const [lightbox, setLightbox] = useState<GalleryTile | null>(null);

  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    setLightbox(null);
    window.setTimeout(onClose, EXIT_MS + tiles.length * EXIT_STAGGER_MS + 60);
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[#f1ede2]">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-[#f1ede2]/90 px-6 py-4 backdrop-blur-sm sm:px-10">
        <p className="text-sm font-semibold text-[#141414]/70">{tiles.length} foto</p>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-xl bg-[#141414] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
        >
          Chiudi
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 p-6 sm:grid-cols-4 sm:gap-4 sm:p-10 md:grid-cols-5 lg:grid-cols-6">
        {tiles.map((tile, i) => (
          <div
            key={tile.id}
            style={{
              animation: closing
                ? `gallery-tile-out ${EXIT_MS}ms ease ${i * EXIT_STAGGER_MS}ms both`
                : `gallery-tile-in ${ENTER_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${i * ENTER_STAGGER_MS}ms both`,
            }}
            className="relative aspect-square cursor-zoom-in overflow-hidden rounded-lg bg-black/5"
            onClick={() => !closing && setLightbox(tile)}
          >
            <Image
              src={tile.url}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
              className="pointer-events-none select-none object-cover"
            />
          </div>
        ))}
      </div>

      {lightbox && <Lightbox tile={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function Lightbox({ tile, onClose }: { tile: GalleryTile; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  const [hiResLoaded, setHiResLoaded] = useState(false);
  const hiResRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // se la versione piena è già in cache, `onLoad` può non scattare
    if (hiResRef.current?.complete && hiResRef.current.naturalWidth > 0) {
      setHiResLoaded(true);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className={`relative h-[82vh] w-[92vw] max-w-4xl transition-transform duration-200 ${
          visible ? "scale-100" : "scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* anteprima sfocata: variante minuscola, si carica quasi subito e dà
            un'idea della foto mentre scarica quella a piena risoluzione */}
        <Image
          src={tile.url}
          alt=""
          fill
          sizes="64px"
          priority
          aria-hidden
          className={`scale-110 object-contain blur-2xl transition-opacity duration-500 ${
            hiResLoaded ? "opacity-0" : "opacity-100"
          }`}
        />
        {/* immagine piena: compare in dissolvenza quando è pronta */}
        <Image
          ref={hiResRef}
          src={tile.url}
          alt=""
          fill
          sizes="92vw"
          priority
          onLoad={() => setHiResLoaded(true)}
          onError={() => setHiResLoaded(true)}
          className={`object-contain transition-opacity duration-500 ${
            hiResLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* indicatore di caricamento finché la versione piena non è pronta */}
        {!hiResLoaded && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Chiudi"
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg text-white transition hover:bg-white/20"
      >
        ✕
      </button>
    </div>
  );
}
