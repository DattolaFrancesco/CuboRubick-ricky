"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export interface GalleryTile {
  id: string;
  url: string;
  /** posizione/dimensione (px, viewport) dello sticker sul cubo al momento dell'apertura */
  from: { x: number; y: number; width: number; height: number };
}

interface GalleryProps {
  tiles: GalleryTile[];
  onClose: () => void;
}

const ENTER_MS = 650;
const EXIT_MS = 420;
const STAGGER_MS = 9;

/**
 * Galleria a tutto schermo delle foto del cubo, con animazione FLIP:
 * ogni riquadro nasce già nella sua posizione di griglia (flusso normale),
 * gli si applica subito una `transform` che lo riporta visivamente al punto
 * in cui si trovava sul cubo (`from`), poi la si toglie per farlo "volare"
 * verso il proprio posto. Anima solo `transform`/`opacity` (compositor),
 * mai `width`/`height`/`left`/`top`: fluido anche con ~50 elementi.
 */
export function Gallery({ tiles, onClose }: GalleryProps) {
  const [closing, setClosing] = useState(false);
  const [lightbox, setLightbox] = useState<GalleryTile | null>(null);
  const tileRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    const els = tileRefs.current;
    for (const tile of tiles) {
      const el = els.get(tile.id);
      if (!el) continue;
      const target = el.getBoundingClientRect();
      const dx = tile.from.x + tile.from.width / 2 - (target.x + target.width / 2);
      const dy = tile.from.y + tile.from.height / 2 - (target.y + target.height / 2);
      const scale = Math.max(0.08, tile.from.width / target.width);
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    }

    // doppio rAF: lascia dipingere lo stato di partenza prima di far scattare
    // la transizione, altrimenti il browser la salta (nessun cambiamento da animare)
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        let i = 0;
        for (const tile of tiles) {
          const el = els.get(tile.id);
          if (!el) continue;
          el.style.transition = `transform ${ENTER_MS}ms cubic-bezier(.22,1,.36,1) ${i * STAGGER_MS}ms`;
          el.style.transform = "";
          i += 1;
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    setLightbox(null);
    for (const tile of tiles) {
      const el = tileRefs.current.get(tile.id);
      if (!el) continue;
      const current = el.getBoundingClientRect();
      const dx = tile.from.x + tile.from.width / 2 - (current.x + current.width / 2);
      const dy = tile.from.y + tile.from.height / 2 - (current.y + current.height / 2);
      const scale = Math.max(0.08, tile.from.width / current.width);
      el.style.transition = `transform ${EXIT_MS}ms cubic-bezier(.4,0,.7,.4), opacity ${EXIT_MS}ms ease`;
      el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      el.style.opacity = "0";
    }
    window.setTimeout(onClose, EXIT_MS + 30);
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
        {tiles.map((tile) => (
          <div
            key={tile.id}
            ref={(el) => {
              if (el) tileRefs.current.set(tile.id, el);
              else tileRefs.current.delete(tile.id);
            }}
            className="relative aspect-square cursor-zoom-in overflow-hidden rounded-lg bg-black/5 [will-change:transform]"
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

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
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
        <Image src={tile.url} alt="" fill sizes="92vw" className="object-contain" priority />
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
