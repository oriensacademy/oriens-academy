"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as d3 from "d3";
import { cn } from "@/lib/utils";
import type { AdmissionRelationship } from "@/components/discovery/globe-types";

export interface UniversityMarker {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  country: string;
  subtitle?: string;
  relationship?: AdmissionRelationship;
  sourceUrl?: string;
}

export interface RotatingEarthProps {
  width?: number;
  height?: number;
  className?: string;
  markers?: UniversityMarker[];
  activeCountries?: string[];
  focusLocation?: {
    latitude: number;
    longitude: number;
  } | null;
  focusTrigger?: string | null;
  onMarkerClick?: (marker: UniversityMarker) => void;
  ariaLabel?: string;
}

interface GeoFeatureProperties {
  name?: string;
  iso_a3?: string;
}

interface GeoFeature {
  type: string;
  id?: string;
  properties?: GeoFeatureProperties;
  geometry: d3.GeoGeometryObjects;
}

interface GeoFeatureCollection {
  type: string;
  features: GeoFeature[];
}

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

export function WireframeDottedGlobe({
  width = 580,
  height = 580,
  className,
  markers = [],
  activeCountries = [],
  focusLocation = null,
  focusTrigger = null,
  onMarkerClick,
  ariaLabel = "Interactive exam and university globe",
}: RotatingEarthProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const [geoData, setGeoData] = useState<GeoFeatureCollection | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<UniversityMarker | null>(null);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(true);

  // Rotation state managed in React state to allow safe render reads
  const [activeRotation, setActiveRotation] = useState<[number, number, number]>([-10, -20, 0]);
  const rotationRef = useRef<[number, number, number]>([-10, -20, 0]);
  const targetRotationRef = useRef<[number, number, number] | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; rot: [number, number, number] }>({
    x: 0,
    y: 0,
    rot: [-10, -20, 0],
  });

  // IntersectionObserver for offscreen pause
  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Fetch local GeoJSON dataset
  useEffect(() => {
    fetch("/data/world-countries-110m.json")
      .then((res) => res.json())
      .then((data: GeoFeatureCollection) => setGeoData(data))
      .catch((err) => console.error("Failed loading local GeoJSON:", err));
  }, []);

  // Handle focusLocation updates
  useEffect(() => {
    if (focusLocation) {
      targetRotationRef.current = [-focusLocation.longitude, -focusLocation.latitude, 0];
    }
  }, [focusLocation, focusTrigger]);

  // Sync state for overlay rendering at a low frequency
  const updateRotationState = (newRot: [number, number, number]) => {
    rotationRef.current = newRot;
    setActiveRotation(newRot);
  };

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let lastStateSync = 0;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const radius = Math.min(width, height) / 2 - 20;
    const projection = d3
      .geoOrthographic()
      .scale(radius)
      .translate([width / 2, height / 2])
      .clipAngle(90);

    const path = d3.geoPath().projection(projection).context(ctx);
    const graticule = d3.geoGraticule10();

    const render = (time: number) => {
      // Smooth programmatic rotation interpolation
      if (targetRotationRef.current && !isDraggingRef.current) {
        const [currL, currP] = rotationRef.current;
        const [targL, targP] = targetRotationRef.current;
        const diffL = (targL - currL) * 0.08;
        const diffP = (targP - currP) * 0.08;

        const nextRot: [number, number, number] = [currL + diffL, currP + diffP, 0];
        rotationRef.current = nextRot;

        if (Math.abs(targL - currL) < 0.1 && Math.abs(targP - currP) < 0.1) {
          targetRotationRef.current = null;
        }
      } else if (!isDraggingRef.current && !reducedMotion && isVisible) {
        // Slow natural auto-rotation
        rotationRef.current = [rotationRef.current[0] + 0.2, rotationRef.current[1], 0];
      }

      // Sync React state periodically for HTML overlays without lagging 60fps canvas
      if (time - lastStateSync > 100) {
        lastStateSync = time;
        setActiveRotation(rotationRef.current);
      }

      projection.rotate(rotationRef.current);
      ctx.clearRect(0, 0, width, height);

      // Globe Outer Glow & Sphere Fill
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(246, 248, 243, 0.95)";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(221, 228, 220, 0.8)";
      ctx.stroke();

      // Graticule Lines
      ctx.beginPath();
      path(graticule);
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = "rgba(129, 149, 134, 0.15)";
      ctx.stroke();

      // Render Country Features
      if (geoData && geoData.features) {
        geoData.features.forEach((feature) => {
          const iso = feature.id || feature.properties?.iso_a3;
          const isActive = iso ? activeCountries.includes(iso) : false;

          ctx.beginPath();
          path(feature as d3.GeoPermissibleObjects);

          if (isActive) {
            ctx.fillStyle = "rgba(129, 149, 134, 0.28)";
            ctx.fill();
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = "rgba(129, 149, 134, 0.8)";
            ctx.stroke();
          } else {
            ctx.fillStyle = "rgba(223, 231, 223, 0.4)";
            ctx.fill();
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = "rgba(190, 201, 191, 0.5)";
            ctx.stroke();
          }
        });
      }

      // Render University Markers (Visible Hemisphere Only)
      const centerLon = -rotationRef.current[0];
      const centerLat = -rotationRef.current[1];

      markers.forEach((marker) => {
        const dist = d3.geoDistance([marker.longitude, marker.latitude], [centerLon, centerLat]);
        if (dist < Math.PI / 2 - 0.1) {
          const pt = projection([marker.longitude, marker.latitude]);
          if (pt) {
            const [x, y] = pt;
            const isHovered = hoveredMarker?.id === marker.id;
            const isSelected = activeMarkerId === marker.id;

            // Halo pulse
            ctx.beginPath();
            ctx.arc(x, y, isSelected ? 10 : isHovered ? 8 : 6, 0, Math.PI * 2);
            ctx.fillStyle = isSelected
              ? "rgba(197, 181, 138, 0.4)"
              : isHovered
              ? "rgba(129, 149, 134, 0.3)"
              : "rgba(16, 39, 27, 0.12)";
            ctx.fill();

            // Core Pin Dot
            ctx.beginPath();
            ctx.arc(x, y, isSelected ? 5 : 3.5, 0, Math.PI * 2);
            ctx.fillStyle = isSelected ? "#C5B58A" : isHovered ? "#819586" : "#10271B";
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = "#FFFFFF";
            ctx.stroke();
          }
        }
      });

      if (isVisible) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [width, height, geoData, activeCountries, markers, hoveredMarker, activeMarkerId, reducedMotion, isVisible]);

  // Pointer Interaction Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      rot: [...rotationRef.current],
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const newRot: [number, number, number] = [
        dragStartRef.current.rot[0] + dx * 0.4,
        Math.max(-80, Math.min(80, dragStartRef.current.rot[1] - dy * 0.4)),
        0,
      ];
      updateRotationState(newRot);
    } else {
      // Check marker hover
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const centerLon = -rotationRef.current[0];
      const centerLat = -rotationRef.current[1];
      const radius = Math.min(width, height) / 2 - 20;

      const projection = d3
        .geoOrthographic()
        .scale(radius)
        .translate([width / 2, height / 2])
        .rotate(rotationRef.current);

      let found: UniversityMarker | null = null;
      for (const marker of markers) {
        const dist = d3.geoDistance([marker.longitude, marker.latitude], [centerLon, centerLat]);
        if (dist < Math.PI / 2 - 0.1) {
          const pt = projection([marker.longitude, marker.latitude]);
          if (pt) {
            const dx = pt[0] - mouseX;
            const dy = pt[1] - mouseY;
            if (dx * dx + dy * dy < 100) {
              found = marker;
              break;
            }
          }
        }
      }
      setHoveredMarker(found);
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const handleCanvasClick = () => {
    if (hoveredMarker) {
      setActiveMarkerId(hoveredMarker.id);
      if (onMarkerClick) onMarkerClick(hoveredMarker);
    }
  };

  // Compute visible markers using activeRotation state (no ref reading in render body)
  const centerLon = -activeRotation[0];
  const centerLat = -activeRotation[1];
  const radius = Math.min(width, height) / 2 - 20;
  const overlayProjection = d3
    .geoOrthographic()
    .scale(radius)
    .translate([width / 2, height / 2])
    .rotate(activeRotation);

  return (
    <div
      ref={containerRef}
      className={cn("relative flex items-center justify-center select-none touch-none", className)}
      style={{ width, height }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        style={{ width, height }}
        className="cursor-grab active:cursor-grabbing rounded-full"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleCanvasClick}
      />

      {/* Floating DOM Overlay Labels for Visible Hemisphere Markers */}
      {markers.map((marker) => {
        const dist = d3.geoDistance([marker.longitude, marker.latitude], [centerLon, centerLat]);
        if (dist >= Math.PI / 2 - 0.1) return null; // Hide rear hemisphere markers!

        const pt = overlayProjection([marker.longitude, marker.latitude]);
        if (!pt) return null;

        const [x, y] = pt;
        const isHovered = hoveredMarker?.id === marker.id;
        const isSelected = activeMarkerId === marker.id;

        if (!isHovered && !isSelected) return null; // Only show tooltip for hovered/selected to prevent label clutter!

        return (
          <div
            key={`label-${marker.id}`}
            style={{
              position: "absolute",
              left: `${x}px`,
              top: `${y - 12}px`,
              transform: "translate(-50%, -100%)",
            }}
            className="pointer-events-none z-30 rounded-lg border border-border bg-surface/95 px-3 py-1.5 shadow-lg backdrop-blur-md text-xs font-ui max-w-[200px]"
          >
            <p className="font-semibold text-ink leading-tight">{marker.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{marker.country}</p>
            {marker.relationship && (
              <span className="mt-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary uppercase">
                {marker.relationship}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default WireframeDottedGlobe;
