import { cn } from "@/lib/utils";

export type AcademicIconType =
  | "assessment"
  | "critical-reasoning"
  | "reading"
  | "writing"
  | "physics"
  | "chemistry"
  | "biology"
  | "history"
  | "geography"
  | "university"
  | "planning"
  | "time-management"
  | "target"
  | "feedback"
  | "analysis"
  | "global-study";

type AcademicIconProps = {
  type: AcademicIconType;
  size?: number | string;
  className?: string;
  title?: string;
};

function IconDrawing({ type }: { type: AcademicIconType }) {
  switch (type) {
    case "assessment":
      return <><path d="M18 10h22l8 8v36H18z" /><path d="M40 10v10h8M26 31l4 4 8-9M26 44h14" /></>;
    case "critical-reasoning":
      return <><circle cx="16" cy="32" r="5" /><circle cx="45" cy="17" r="5" /><circle cx="48" cy="46" r="5" /><path d="M21 30l19-10M21 35l22 9M32 25v14" /></>;
    case "reading":
      return <><path d="M8 16c9-3 17-1 24 5v32c-7-6-15-8-24-5zM56 16c-9-3-17-1-24 5v32c7-6 15-8 24-5z" /><path d="M32 21v32" /></>;
    case "writing":
      return <><path d="M13 48h24M17 12h26v18" /><path d="M25 43l4-11 20-20 7 7-20 20zM45 16l7 7" /></>;
    case "physics":
      return <><circle cx="32" cy="32" r="4" /><ellipse cx="32" cy="32" rx="24" ry="9" /><ellipse cx="32" cy="32" rx="24" ry="9" transform="rotate(60 32 32)" /><ellipse cx="32" cy="32" rx="24" ry="9" transform="rotate(120 32 32)" /></>;
    case "chemistry":
      return <><path d="M24 9h16M27 9v17L14 49c-2 4 1 7 5 7h26c4 0 7-3 5-7L37 26V9" /><path d="M20 43h24M25 36h14" /></>;
    case "biology":
      return <><path d="M51 12C30 13 16 24 14 47c18 3 35-8 37-35Z" /><path d="M17 49c8-11 17-19 29-27M30 36l-1-12M37 30l10 1" /></>;
    case "history":
      return <><path d="M10 18h44M14 46h36M17 18v28M47 18v28" /><circle cx="24" cy="31" r="3" /><path d="M27 31h12M32 27v8" /></>;
    case "geography":
      return <><circle cx="32" cy="32" r="23" /><path d="M9 32h46M32 9c8 7 12 15 12 23S40 48 32 55c-8-7-12-15-12-23S24 16 32 9Z" /></>;
    case "university":
      return <><path d="M8 25 32 11l24 14M13 27h38M16 48h32M12 54h40M20 27v21M32 27v21M44 27v21" /></>;
    case "planning":
      return <><rect x="10" y="15" width="44" height="39" rx="4" /><path d="M10 25h44M21 9v12M43 9v12M20 38l7 7 16-16" /></>;
    case "time-management":
      return <><circle cx="32" cy="34" r="22" /><path d="M32 21v14l10 6M24 8h16" /></>;
    case "target":
      return <><circle cx="29" cy="35" r="21" /><circle cx="29" cy="35" r="12" /><circle cx="29" cy="35" r="3" /><path d="m34 30 18-18M43 12h9v9" /></>;
    case "feedback":
      return <><path d="M10 14h44v31H29L18 54v-9h-8z" /><path d="m22 30 6 6 14-14" /></>;
    case "analysis":
      return <><rect x="10" y="12" width="30" height="34" rx="3" /><path d="M18 22h14M18 30h14M18 38h8" /><circle cx="44" cy="43" r="10" /><path d="m51 50 6 6" /></>;
    case "global-study":
      return <><circle cx="25" cy="31" r="18" /><path d="M7 31h36M25 13c6 5 9 11 9 18s-3 13-9 18c-6-5-9-11-9-18s3-13 9-18Z" /><path d="m39 43 8 3 8-3-8-4zM42 45v7c3 2 7 2 10 0v-7" /></>;
  }
}

export function AcademicIcon({ type, size = 72, className, title }: AcademicIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("max-w-full shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      <IconDrawing type={type} />
    </svg>
  );
}
