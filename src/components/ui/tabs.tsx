"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs: Tab[];
  activeTab?: string;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, tabs, activeTab, ...props }, ref) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [activeIndex, setActiveIndex] = useState(() =>
      Math.max(0, tabs.findIndex((tab) => tab.id === activeTab)),
    );
    const [hoverStyle, setHoverStyle] = useState<React.CSSProperties>({});
    const [activeStyle, setActiveStyle] = useState({ left: "0px", width: "0px" });
    const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);

    useEffect(() => {
      if (hoveredIndex !== null) {
        const hoveredElement = tabRefs.current[hoveredIndex];
        if (hoveredElement) {
          const { offsetLeft, offsetWidth } = hoveredElement;
          setHoverStyle({ left: `${offsetLeft}px`, width: `${offsetWidth}px` });
        }
      }
    }, [hoveredIndex]);

    useEffect(() => {
      const nextIndex = tabs.findIndex((tab) => tab.id === activeTab);
      if (nextIndex >= 0) setActiveIndex(nextIndex);
    }, [activeTab, tabs]);

    useEffect(() => {
      const updateIndicator = () => {
        const activeElement = tabRefs.current[activeIndex];
        if (activeElement) {
          const { offsetLeft, offsetWidth } = activeElement;
          setActiveStyle({ left: `${offsetLeft}px`, width: `${offsetWidth}px` });
        }
      };
      const frame = requestAnimationFrame(updateIndicator);
      window.addEventListener("resize", updateIndicator);
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", updateIndicator);
      };
    }, [activeIndex, tabs]);

    return (
      <div ref={ref} className={cn("relative", className)} {...props}>
        <div className="relative">
          <div
            data-tabs-hover-indicator
            className="absolute h-[30px] rounded-[6px] bg-sage-soft transition-all duration-300 ease-out"
            style={{ ...hoverStyle, opacity: hoveredIndex !== null ? 1 : 0 }}
          />

          <div
            data-tabs-active-indicator
            className="absolute bottom-[-6px] h-[2px] bg-primary transition-all duration-300 ease-out"
            style={activeStyle}
          />

          <div className="relative flex items-center space-x-[10px]" role="tablist">
            {tabs.map((tab, index) => (
              <Link
                key={tab.id}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                href={tab.id}
                role="tab"
                aria-selected={index === activeIndex}
                className={cn(
                  "flex h-[30px] cursor-pointer items-center justify-center whitespace-nowrap rounded-[6px] px-3 py-2 font-ui text-sm font-medium leading-5 transition-colors duration-300",
                  index === activeIndex ? "text-foreground" : "text-muted-foreground",
                )}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onFocus={() => setHoveredIndex(index)}
                onBlur={() => setHoveredIndex(null)}
                onClick={() => setActiveIndex(index)}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  },
);

Tabs.displayName = "Tabs";

export { Tabs };
