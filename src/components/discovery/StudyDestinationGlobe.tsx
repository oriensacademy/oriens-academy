"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { easeCubicInOut } from "d3-ease";
import { geoCentroid, geoContains, geoDistance, geoGraticule, geoInterpolate, geoOrthographic, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { useReducedMotion } from "motion/react";
import type { Locale } from "@/content/dictionaries";
import type { StudyRegion } from "./globe-types";
import { resolveStudyDestination } from "@/data/study-destinations";

type CountryProperties = { ADMIN?: string; NAME?: string; NAME_TR?: string; NAME_EN?: string; ADM0_A3?: string; CONTINENT?: string };
type CountryFeature = Feature<Geometry, CountryProperties>;
type Rotation = [number, number];

const GLOBE_GRATICULE = geoGraticule().step([20, 20])();

let countryCache: CountryFeature[] | null = null;
let countryRequest: Promise<CountryFeature[]> | null = null;
const countryCentroids = new WeakMap<CountryFeature, [number, number]>();

function loadCountries() {
  if (countryCache) return Promise.resolve(countryCache);
  if (!countryRequest) {
    countryRequest = fetch("/data/world-countries-110m.geojson")
      .then((response) => {
        if (!response.ok) throw new Error(`GeoJSON ${response.status}`);
        return response.json() as Promise<FeatureCollection<Geometry, CountryProperties>>;
      })
      .then((collection) => {
        for (const feature of collection.features) countryCentroids.set(feature, geoCentroid(feature));
        return (countryCache = collection.features);
      });
  }
  return countryRequest;
}

function regionForFeature(feature: CountryFeature, regions: StudyRegion[]): StudyRegion | null {
  const code = (feature.properties?.ADM0_A3 ?? "").toUpperCase();
  if (!code) return null;

  // 1. Direct match among pre-seeded featured regions
  const direct = regions.find((r) => r.countryCode === code || r.id === code.toLowerCase());
  if (direct) return direct;

  // 2. Dynamic country-level resolution for any other clicked country
  const trName = feature.properties?.NAME_TR || feature.properties?.NAME || feature.properties?.ADMIN;
  const enName = feature.properties?.NAME_EN || feature.properties?.NAME || feature.properties?.ADMIN;
  const [lng, lat] = countryCentroids.get(feature) ?? geoCentroid(feature);
  return resolveStudyDestination(code, trName, enName, { lat, lng });
}

export function StudyDestinationGlobe({
  locale,
  region,
  regions,
  compact = false,
  onSelect,
  onHoverRegion,
}: {
  locale: Locale;
  region: StudyRegion | null;
  regions: StudyRegion[];
  compact?: boolean;
  onSelect?: (region: StudyRegion) => void;
  onHoverRegion?: (regionId: StudyRegion["id"] | null) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const featuresRef = useRef<CountryFeature[]>([]);
  const sizeRef = useRef(compact ? 430 : 560);
  const rotationRef = useRef<Rotation>([-18, -12]);
  const regionRef = useRef(region);
  const hoveredFeatureRef = useRef<CountryFeature | null>(null);
  const isPointerOverRef = useRef(false);
  const isDraggingRef = useRef(false);
  const isVisibleRef = useRef(false);
  const resumeAfterRef = useRef(0);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number; originX: number; originY: number; moved: boolean } | null>(null);
  const cameraRef = useRef<{ started: number; duration: number; interpolate: ReturnType<typeof geoInterpolate>; id: string } | null>(null);
  const dirtyRef = useRef(true);
  const hoverFrameRef = useRef(0);
  const hoverTimeRef = useRef(0);
  const frameStatsRef = useRef({ started: 0, frames: 0 });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<StudyRegion["id"] | null>(null);
  const reducedMotion = Boolean(useReducedMotion());
  const isTr = locale === "tr";

  const projection = useCallback(() => {
    const size = sizeRef.current;
    return geoOrthographic()
      .translate([size / 2, size / 2])
      .scale(size * 0.445)
      .clipAngle(90)
      .precision(0.8)
      .rotate(rotationRef.current);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = sizeRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.25 : 1.5);
    const pixelSize = Math.max(1, Math.round(size * dpr));
    if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
      canvas.width = pixelSize;
      canvas.height = pixelSize;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size, size);

    const currentProjection = projection();
    const path = geoPath(currentProjection, context);
    context.beginPath();
    context.arc(size / 2, size / 2, size * 0.445, 0, Math.PI * 2);
    context.fillStyle = "#EEF2EC";
    context.fill();
    context.strokeStyle = "#B7C3B8";
    context.lineWidth = 1.5;
    context.stroke();

    context.beginPath();
    path(GLOBE_GRATICULE);
    context.strokeStyle = "rgba(201,211,201,.58)";
    context.lineWidth = 0.55;
    context.stroke();

    const normalFeatures: CountryFeature[] = [];
    const selectedFeatures: CountryFeature[] = [];
    const hoveredFeatures: CountryFeature[] = [];
    const visibleCenter = currentProjection.invert?.([size / 2, size / 2]) ?? [0, 0];

    const currentTargetCode = regionRef.current?.countryCode || (regionRef.current?.id ? regionRef.current.id.toUpperCase() : "");

    for (const feature of featuresRef.current) {
      const centroid = countryCentroids.get(feature) ?? geoCentroid(feature);
      if (geoDistance(centroid, visibleCenter) > Math.PI / 2 + 0.32) continue;
      const code = (feature.properties?.ADM0_A3 ?? "").toUpperCase();
      
      if (feature === hoveredFeatureRef.current) {
        hoveredFeatures.push(feature);
      } else if (currentTargetCode && (code === currentTargetCode || code === regionRef.current?.id?.toUpperCase())) {
        selectedFeatures.push(feature);
      } else {
        normalFeatures.push(feature);
      }
    }

    const drawCountryGroup = (features: CountryFeature[], fill: string, width = 0.55) => {
      if (features.length === 0) return;
      context.beginPath();
      path({ type: "FeatureCollection", features });
      context.fillStyle = fill;
      context.fill();
      context.strokeStyle = "#AAB8AC";
      context.lineWidth = width;
      context.stroke();
    };

    drawCountryGroup(normalFeatures, "#D8E1D7");
    drawCountryGroup(selectedFeatures, "#607867", 1.1);
    drawCountryGroup(hoveredFeatures, "#819586", 1.1);

    // Draw pinned destination markers for featured countries
    const hoveredRegion = hoveredFeatureRef.current ? regionForFeature(hoveredFeatureRef.current, regions) : null;
    for (const candidate of regions) {
      const point = currentProjection([candidate.focus.lng, candidate.focus.lat]);
      const onFront = geoDistance([candidate.focus.lng, candidate.focus.lat], visibleCenter) <= Math.PI / 2;
      if (!point || !onFront) {
        continue;
      }
      const active = candidate.id === regionRef.current?.id || candidate.countryCode === regionRef.current?.countryCode;
      const hovered = candidate.id === hoveredRegion?.id || candidate.countryCode === hoveredRegion?.countryCode;
      if (active || hovered) {
        context.beginPath();
        context.arc(point[0], point[1], active ? 8.5 : 7, 0, Math.PI * 2);
        context.fillStyle = active ? "rgba(16,39,27,.16)" : "rgba(129,149,134,.18)";
        context.fill();
      }
      context.beginPath();
      context.arc(point[0], point[1], active ? 5 : hovered ? 4.2 : 3.5, 0, Math.PI * 2);
      context.fillStyle = active ? "#10271B" : hovered ? "#819586" : "#FFFFFF";
      context.fill();
      context.strokeStyle = active ? "#FFFFFF" : "#819586";
      context.lineWidth = 2;
      context.stroke();
    }

    const root = rootRef.current;
    if (root) {
      root.dataset.rotation = `${rotationRef.current[0].toFixed(2)},${rotationRef.current[1].toFixed(2)}`;
      root.dataset.dpr = dpr.toFixed(2);
    }
    dirtyRef.current = false;
  }, [projection, regions]);

  useEffect(() => {
    let cancelled = false;
    loadCountries()
      .then((features) => {
        if (cancelled) return;
        featuresRef.current = features;
        dirtyRef.current = true;
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    regionRef.current = region;
    dirtyRef.current = true;
    if (!region) return;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    const from: [number, number] = [-rotationRef.current[0], -rotationRef.current[1]];
    cameraRef.current = {
      started: performance.now(),
      duration: reducedMotion ? 1 : 900,
      interpolate: geoInterpolate(from, [region.focus.lng, region.focus.lat]),
      id: region.id,
    };
    rootRef.current?.setAttribute("data-focus-target", region.id);
  }, [reducedMotion, region]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      isVisibleRef.current = entry.isIntersecting;
      if (entry.isIntersecting) {
        resumeAfterRef.current = performance.now() + 600;
        dirtyRef.current = true;
      }
    }, { threshold: 0.2 });
    if (rootRef.current) observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    let paused = false;
    const tick = (time: number) => {
      if (document.hidden) {
        paused = true;
        return;
      }
      const delta = Math.min(40, time - previous);
      previous = time;
      let changed = false;
      const camera = cameraRef.current;
      if (camera) {
        const progress = Math.min(1, (time - camera.started) / camera.duration);
        const [lng, lat] = camera.interpolate(easeCubicInOut(progress));
        rotationRef.current = [-lng, -lat];
        changed = true;
        if (progress >= 1) {
          cameraRef.current = null;
          resumeAfterRef.current = time + 2000;
          rootRef.current?.setAttribute("data-focus-complete", camera.id);
        }
      } else if (
        isVisibleRef.current &&
        !document.hidden &&
        !reducedMotion &&
        !isPointerOverRef.current &&
        !isDraggingRef.current &&
        time >= resumeAfterRef.current
      ) {
        rotationRef.current = [rotationRef.current[0] + delta * 0.0038, rotationRef.current[1]];
        changed = true;
      }
      if (changed || dirtyRef.current) draw();
      if (changed) frameStatsRef.current.frames += 1;
      if (time - frameStatsRef.current.started >= 1000) {
        const elapsed = time - frameStatsRef.current.started;
        const fps = Math.round((frameStatsRef.current.frames * 1000) / elapsed);
        if (rootRef.current) rootRef.current.dataset.fps = String(fps);
        frameStatsRef.current = { started: time, frames: 0 };
      }
      frame = requestAnimationFrame(tick);
    };
    const handleVisibilityChange = () => {
      if (!document.hidden && paused) {
        paused = false;
        previous = performance.now();
        dirtyRef.current = true;
        frame = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [draw, reducedMotion]);

  useEffect(() => () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    if (hoverFrameRef.current) cancelAnimationFrame(hoverFrameRef.current);
  }, []);

  function canvasCoordinate(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return [(event.clientX - rect.left) * (sizeRef.current / rect.width), (event.clientY - rect.top) * (sizeRef.current / rect.height)] as [number, number];
  }

  function featureAt(point: [number, number]) {
    const coordinates = projection().invert?.(point);
    if (!coordinates) return null;
    return featuresRef.current.find((feature) => geoContains(feature, coordinates)) ?? null;
  }

  function scheduleResume() {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    if (isDraggingRef.current) return;
    resumeAfterRef.current = Number.POSITIVE_INFINITY;
    resumeTimerRef.current = setTimeout(() => {
      if (!isPointerOverRef.current && !isDraggingRef.current) resumeAfterRef.current = performance.now();
    }, 2000);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    cameraRef.current = null;
    isDraggingRef.current = true;
    const { clientX: x, clientY: y, pointerId: id } = event;
    dragRef.current = { id, x, y, originX: x, originY: y, moved: false };
    event.currentTarget.setPointerCapture?.(id);
    event.currentTarget.style.cursor = "grabbing";
    dirtyRef.current = true;
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (drag && drag.id === event.pointerId) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.moved ||= Math.abs(event.clientX - drag.originX) + Math.abs(event.clientY - drag.originY) > 4;
      rotationRef.current = [rotationRef.current[0] + dx * 0.28, Math.max(-70, Math.min(70, rotationRef.current[1] - dy * 0.2))];
      drag.x = event.clientX;
      drag.y = event.clientY;
      dirtyRef.current = true;
      return;
    }
    if (event.timeStamp - hoverTimeRef.current < 65 || hoverFrameRef.current) return;
    const point = canvasCoordinate(event);
    const canvas = event.currentTarget;
    hoverFrameRef.current = requestAnimationFrame(() => {
      hoverFrameRef.current = 0;
      hoverTimeRef.current = performance.now();
      const feature = featureAt(point);
      if (feature !== hoveredFeatureRef.current) {
        hoveredFeatureRef.current = feature;
        const displayName = isTr
          ? feature?.properties?.NAME_TR || feature?.properties?.ADMIN || feature?.properties?.NAME
          : feature?.properties?.NAME_EN || feature?.properties?.ADMIN || feature?.properties?.NAME;
        setHoveredName(displayName ?? null);
        const interactiveRegion = feature ? regionForFeature(feature, regions) : null;
        setHoveredRegionId(interactiveRegion?.id ?? null);
        onHoverRegion?.(interactiveRegion?.id ?? null);
        canvas.style.cursor = interactiveRegion ? "pointer" : "grab";
        dirtyRef.current = true;
      }
    });
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    const completedDrag = dragRef.current;
    try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    isDraggingRef.current = false;
    dragRef.current = null;
    if (completedDrag && !completedDrag.moved) {
      const feature = featureAt(canvasCoordinate(event));
      const selected = feature ? regionForFeature(feature, regions) : null;
      if (selected) onSelect?.(selected);
    }
    event.currentTarget.style.cursor = hoveredRegionId ? "pointer" : "grab";
    if (!isPointerOverRef.current) scheduleResume();
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLCanvasElement>) {
    try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    isDraggingRef.current = false;
    dragRef.current = null;
    event.currentTarget.style.cursor = hoveredRegionId ? "pointer" : "grab";
    if (!isPointerOverRef.current) scheduleResume();
  }

  if (loadError) return <div className="flex aspect-square items-center justify-center rounded-full border border-[#B7C3B8] bg-[#EEF2EC] p-10 text-center text-sm text-[#68756C]">{isTr ? "Harita yüklenemedi. Ülke düğmelerini kullanabilirsiniz." : "The map could not load. Use the country controls instead."}</div>;

  return (
    <div
      ref={rootRef}
      data-study-globe
      data-globe-ready={loaded}
      data-render-engine="canvas"
      data-react-frame-updates="false"
      data-selected-region={region?.id ?? "none"}
      data-hovered-region={hoveredRegionId ?? "none"}
      className="relative mx-auto aspect-square w-full max-w-[620px]"
      onPointerEnter={() => {
        isPointerOverRef.current = true;
        resumeAfterRef.current = Number.POSITIVE_INFINITY;
        if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      }}
      onPointerLeave={() => {
        isPointerOverRef.current = false;
        hoveredFeatureRef.current = null;
        setHoveredName(null);
        setHoveredRegionId(null);
        onHoverRegion?.(null);
        dirtyRef.current = true;
        scheduleResume();
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={isTr ? "Sürüklenebilir dünya haritası ve eğitim destinasyonları" : "Draggable world map and study destinations"}
        className="relative z-0 size-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />
      <p className="pointer-events-none absolute bottom-4 left-1/2 min-h-7 -translate-x-1/2 rounded-full border border-[#DDE4DC] bg-white/90 px-3 py-1 text-center text-[11px] font-semibold text-[#405249] opacity-0 shadow-sm transition-opacity data-[visible=true]:opacity-100" data-visible={Boolean(hoveredName)} aria-live="polite">
        {hoveredName ?? ""}
      </p>
    </div>
  );
}
