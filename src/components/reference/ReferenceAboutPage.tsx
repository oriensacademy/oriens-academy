"use client";

import { useRef } from "react";
import "./generated/reference-about.css";
import { ABOUT_FOOTER_HTML, ABOUT_HEADER_HTML, ABOUT_MAIN_HTML } from "./generated/markup";
import {
  ReferenceFonts,
  ReferenceHtml,
  fillContact,
  useInternalLinkNavigation,
  useReferenceContact,
  useReferenceHeader,
} from "./reference-shared";

export function ReferenceAboutPage() {
  const scopeRef = useRef<HTMLDivElement>(null);
  useReferenceHeader(scopeRef);
  useInternalLinkNavigation(scopeRef);
  const contact = useReferenceContact();

  return (
    <div ref={scopeRef} className="reference-about-page">
      <ReferenceFonts />
      <div style={{ fontFamily: "Inter, system-ui, sans-serif", color: "#10271B", background: "#F6F8F3", width: "100%", fontSize: 16, lineHeight: 1.65 }}>
        <ReferenceHtml html={ABOUT_HEADER_HTML} />
        <main id="main-content" style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: fillContact(ABOUT_MAIN_HTML, contact) }} />
        <ReferenceHtml html={fillContact(ABOUT_FOOTER_HTML, contact)} />
      </div>
    </div>
  );
}
