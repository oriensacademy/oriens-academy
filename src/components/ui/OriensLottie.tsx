"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DotLottieReact, type DotLottie } from "@lottiefiles/dotlottie-react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type OriensLottieProps = {
  src: string;
  className?: string;
  autoplay?: boolean;
  loop?: boolean;
  speed?: number;
  ariaLabel?: string;
  aspectRatio?: "square" | "learning";
};

export function OriensLottie({ src, className, autoplay = true, loop = true, speed = 1, ariaLabel, aspectRatio = "square" }: OriensLottieProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<DotLottie | null>(null);
  const inViewRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [player, setPlayer] = useState<DotLottie | null>(null);
  const reducedMotion = !!useReducedMotion();

  const syncPlayback = useCallback(() => {
    const instance = playerRef.current;
    if (!instance) return;
    if (reducedMotion) {
      instance.pause();
      instance.setFrame(0);
      return;
    }
    if (autoplay && inViewRef.current && !document.hidden) {
      instance.unfreeze();
      instance.play();
    } else {
      instance.pause();
      instance.freeze();
    }
  }, [autoplay, reducedMotion]);

  const receivePlayer = useCallback((instance: DotLottie | null) => {
    playerRef.current = instance;
    setPlayer(instance);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      inViewRef.current = entry.isIntersecting;
      syncPlayback();
    }, { rootMargin: "120px 0px", threshold: 0.05 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [syncPlayback]);

  useEffect(() => {
    if (!player) return;
    const handleReady = () => {
      player.setSpeed(speed);
      if (reducedMotion) player.setFrame(0);
      setLoaded(true);
      syncPlayback();
    };
    player.addEventListener("load", handleReady);
    player.addEventListener("ready", handleReady);
    if (player.isLoaded) handleReady();
    return () => {
      player.removeEventListener("load", handleReady);
      player.removeEventListener("ready", handleReady);
    };
  }, [player, reducedMotion, speed, syncPlayback]);

  useEffect(() => {
    const handleVisibility = () => syncPlayback();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [syncPlayback]);

  return (
    <div ref={containerRef} className={cn("relative isolate w-full overflow-hidden", aspectRatio === "learning" ? "aspect-[3/2]" : "aspect-square", className)} role={ariaLabel ? "img" : undefined} aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true}>
      <DotLottieReact src={src} autoplay={false} loop={reducedMotion ? false : loop} speed={speed} dotLottieRefCallback={receivePlayer} tabIndex={-1} className={cn("absolute inset-0 size-full transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")} />
      <div aria-hidden="true" className={cn("absolute inset-0 -z-10 rounded-[inherit] bg-[radial-gradient(circle_at_center,rgba(129,149,134,0.10),transparent_68%)] transition-opacity duration-300", loaded ? "opacity-0" : "opacity-100")} />
    </div>
  );
}

export default OriensLottie;
