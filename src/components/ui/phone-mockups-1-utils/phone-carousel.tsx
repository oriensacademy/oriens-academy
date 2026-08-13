"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ImageItem {
  src?: string;
  alt: string;
  eyebrow?: string;
  title?: string;
  detail?: string;
  tone?: "sage" | "ivory" | "forest" | "gold";
}

interface PhoneCarouselProps {
  images?: ImageItem[];
  autoPlayInterval?: number;
  className?: string;
}

export function PhoneCarousel({
  images = [
    { alt: "Oriens temporary screen", eyebrow: "ORIENS", title: "Academic Route", tone: "sage" },
  ],
  autoPlayInterval = 4000,
  className,
}: PhoneCarouselProps) {
  const slideCount = images.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const currentImage = images[currentIndex];

  useEffect(() => {
    if (slideCount < 2) return;

    const timer = window.setTimeout(() => {
      setCurrentIndex((previousIndex) => (previousIndex + 1) % slideCount);
    }, autoPlayInterval);

    return () => window.clearTimeout(timer);
  }, [autoPlayInterval, currentIndex, slideCount]);

  const handleManualNext = () => {
    setCurrentIndex((previousIndex) => (previousIndex + 1) % slideCount);
  };

  const handleManualPrev = () => {
    setCurrentIndex((previousIndex) => (previousIndex - 1 + slideCount) % slideCount);
  };

  return (
    <div
      data-phone-carousel
      data-slide-count={slideCount}
      data-active-slide={currentIndex + 1}
      data-autoplay-interval={autoPlayInterval}
      className={cn(
        "mx-auto flex w-full max-w-4xl select-none flex-col items-center gap-5 py-4",
        className,
      )}
    >
      <div className="relative flex w-full items-center justify-center px-4">
        <motion.div
          className="relative h-[520px] w-[270px] touch-pan-y rounded-[48px] border-4 border-[#0D2A1C] bg-[#10271B] p-3 shadow-[0_24px_60px_rgba(16,39,27,0.16)] ring-1 ring-[#819586]/30 transition-all duration-300 sm:h-[577px] sm:w-[300px] lg:h-[674px] lg:w-[350px] xl:h-[712px] xl:w-[370px]"
          drag={slideCount > 1 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          onDragEnd={(_, info) => {
            if (info.offset.x < -45) handleManualNext();
            if (info.offset.x > 45) handleManualPrev();
          }}
        >
          <div className="absolute top-5 left-1/2 z-20 flex h-5 w-28 -translate-x-1/2 items-center justify-center rounded-full bg-[#0D2A1C]">
            <div className="mr-2 size-3 rounded-full border border-[#819586]/40 bg-[#10271B]" />
            <div className="size-2 rounded-full bg-[#25382D]" />
          </div>

          <div className="relative h-full w-full overflow-hidden rounded-[38px] bg-[#E7EBE3] shadow-inner">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 bg-[#E7EBE3]"
              >
                {currentImage.src && failedImages[currentImage.src] ? (
                  <div
                    className="flex h-full w-full items-center justify-center bg-[#E7EBE3]"
                    role="img"
                    aria-label={`${currentImage.alt} unavailable`}
                  >
                    <div className="size-12 rounded-2xl border border-[#819586]/25 bg-[#F6F8F3]" />
                  </div>
                ) : currentImage.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentImage.src}
                    alt={currentImage.alt}
                    className="h-full w-full object-cover"
                    draggable={false}
                    onError={() =>
                      setFailedImages((failed) => ({
                        ...failed,
                        [currentImage.src!]: true,
                      }))
                    }
                  />
                ) : (
                  <div className={cn(
                    "flex h-full flex-col justify-between p-7 pt-16 sm:p-9 sm:pt-20",
                    currentImage.tone === "forest" && "bg-[#10271B] text-white",
                    currentImage.tone === "ivory" && "bg-[#F7F1E2] text-[#10271B]",
                    currentImage.tone === "gold" && "bg-[#D6B56D] text-[#10271B]",
                    (!currentImage.tone || currentImage.tone === "sage") && "bg-[#DCE6DC] text-[#10271B]",
                  )} role="img" aria-label={currentImage.alt}>
                    <div>
                      <p className="text-[10px] font-bold tracking-[0.2em] opacity-65">{currentImage.eyebrow}</p>
                      <h3 className="mt-5 font-heading text-4xl leading-[1.02]">{currentImage.title}</h3>
                      <p className="mt-4 text-sm leading-6 opacity-70">{currentImage.detail}</p>
                    </div>
                    <div className="space-y-3" aria-hidden="true">
                      <div className="h-24 rounded-3xl border border-current/15 bg-white/20" />
                      <div className="grid grid-cols-2 gap-3"><div className="h-20 rounded-2xl border border-current/15 bg-white/15" /><div className="h-20 rounded-2xl border border-current/15 bg-white/15" /></div>
                    </div>
                    <p className="text-[9px] font-semibold tracking-[0.16em] opacity-55">TEMPORARY OWNER PLACEHOLDER</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="absolute top-2 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-[#25382D]" />
        </motion.div>

        <div className="pointer-events-none absolute -z-10 h-[85%] w-[110%] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="flex items-center gap-4 rounded-full border border-border bg-card px-4 py-2 shadow-xs">
        <button
          type="button"
          onClick={handleManualPrev}
          className="cursor-pointer rounded-full p-1.5 text-foreground transition-colors hover:bg-muted focus:ring-2 focus:ring-primary/30 focus:outline-hidden"
          aria-label="Previous slide"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div
          className="flex items-center gap-2 px-1"
          role="tablist"
          aria-label="Phone screens pagination"
        >
          {images.map((image, index) => {
            const isActive = currentIndex === index;

            return (
              <button
                key={`${image.alt}-${index}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Slide ${index + 1}`}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "cursor-pointer rounded-full transition-all duration-300 focus:outline-hidden",
                  isActive
                    ? "h-[7px] w-[22px] bg-primary shadow-xs"
                    : "size-[7px] bg-muted-foreground/30 hover:bg-muted-foreground/60",
                )}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleManualNext}
          className="cursor-pointer rounded-full p-1.5 text-foreground transition-colors hover:bg-muted focus:ring-2 focus:ring-primary/30 focus:outline-hidden"
          aria-label="Next slide"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

export default PhoneCarousel;
