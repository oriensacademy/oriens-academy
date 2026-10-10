"use client";

import { useRef } from "react";
import "./generated/reference-about.css";
import { ABOUT_FOOTER_HTML, ABOUT_MAIN_HTML } from "./generated/markup";
import {
  NavbarSpacer,
  ReferenceFonts,
  ReferenceHtml,
  fillContact,
  useInternalLinkNavigation,
  useReferenceContact,
} from "./reference-shared";

export function ReferenceAboutPage() {
  const scopeRef = useRef<HTMLDivElement>(null);
  useInternalLinkNavigation(scopeRef);
  const contact = useReferenceContact();

  return (
    <>
    <NavbarSpacer />
    <div ref={scopeRef} className="reference-about-page">
      <ReferenceFonts />
      <div style={{ fontFamily: "Inter, system-ui, sans-serif", color: "#10271B", background: "#F6F8F3", width: "100%", fontSize: 16, lineHeight: 1.65 }}>
        <main id="main-content" style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: fillContact(ABOUT_MAIN_HTML, contact) }} />
        <ReferenceHtml html={fillContact(ABOUT_FOOTER_HTML, contact)} />
      </div>
    </div>
    </>
  );
}
