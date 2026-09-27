"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Picture } from "@/components/media/picture";
import type { GalleryImageDTO } from "@/lib/data/gallery";
import { wrapIndex } from "@/lib/gallery/lightbox";

export function Lightbox({ images, albumTitle }: { images: GalleryImageDTO[]; albumTitle: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Direction of the last step, so the incoming photo slides in from the side it came from.
  const [direction, setDirection] = useState<1 | -1>(1);
  const reduce = useReducedMotion();
  const dialog = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  function open(index: number, trigger: HTMLElement) {
    triggerRef.current = trigger;
    setOpenIndex(index);
    dialog.current?.showModal();
  }

  function close() {
    dialog.current?.close();
    setOpenIndex(null);
    triggerRef.current?.focus();
  }

  function go(delta: 1 | -1) {
    setDirection(delta);
    setOpenIndex((i) => (i === null ? i : wrapIndex(i, images.length, delta)));
  }

  const isOpen = openIndex !== null;
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 1 : -1;
      setDirection(delta);
      setOpenIndex((i) => (i === null ? i : wrapIndex(i, images.length, delta)));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, images.length]);

  const current = openIndex !== null ? images[openIndex] : null;

  return (
    <>
      <div className="mt-12 columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={(e) => open(i, e.currentTarget)}
            aria-label={img.caption || img.image.alt || `Photo ${i + 1} of ${images.length}, from ${albumTitle}`}
            className="reveal group block w-full overflow-hidden rounded-[20px] border border-line bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
          >
            <Picture
              image={img.image}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              alt={img.caption || img.image.alt}
              imgClassName="w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transform-none"
            />
          </button>
        ))}
      </div>

      <dialog
        ref={dialog}
        aria-label={current ? current.caption || current.image.alt || albumTitle : albumTitle}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClose={() => setOpenIndex(null)}
        className="m-auto w-[min(1100px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] rounded-[24px] border border-line bg-night p-0 text-frost backdrop:bg-night/90 motion-safe:transition-opacity motion-reduce:transition-none"
      >
        {current && (
          <div className="grid gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {(openIndex ?? 0) + 1} / {images.length}
              </p>
              <button type="button" onClick={close} aria-label="Close" className="rounded-full p-2 text-muted hover:bg-raised hover:text-frost">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="relative grid place-items-center">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous photo"
                className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-night/70 p-2 text-frost hover:bg-night/90"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <div className="grid w-full overflow-hidden">
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                  <motion.div
                    key={current.id}
                    custom={direction}
                    className="col-start-1 row-start-1 touch-pan-y"
                    variants={{
                      enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 60 }),
                      shown: { opacity: 1, x: 0 },
                      exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * -60 }),
                    }}
                    initial="enter"
                    animate="shown"
                    exit="exit"
                    transition={{ duration: reduce ? 0.12 : 0.32, ease: [0.22, 1, 0.36, 1] }}
                    drag={images.length > 1 ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.35}
                    onDragEnd={(_, info) => {
                      // Swipe: a short fast flick or a long drag moves to the neighbouring photo.
                      if (info.offset.x < -60 || info.velocity.x < -400) go(1);
                      else if (info.offset.x > 60 || info.velocity.x > 400) go(-1);
                    }}
                  >
                    <Picture
                      image={current.image}
                      sizes="1100px"
                      alt={current.caption || current.image.alt}
                      priority
                      className="pointer-events-none block max-h-[70vh] w-full select-none"
                      imgClassName="mx-auto max-h-[70vh] w-auto object-contain"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next photo"
                className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-night/70 p-2 text-frost hover:bg-night/90"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </div>
            {current.caption && <p className="text-center text-sm text-muted">{current.caption}</p>}
          </div>
        )}
      </dialog>
    </>
  );
}
