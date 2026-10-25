"use client";

import { useEffect } from "react";

// liquidGL (MIT, https://github.com/naughtyduk/liquidGL), vendored at public/scripts/liquidGL.js so it works offline.
// It rewrites its target's styles (background transparent, pointer-events none), so only ever point it at a
// decorative layer, never at a form or anything interactive.
type LiquidGL = (options: Record<string, unknown>) => { destroy(): void };
declare global {
  interface Window {
    liquidGL?: LiquidGL;
  }
}

let loading: Promise<LiquidGL> | null = null;
function loadLiquidGL(): Promise<LiquidGL> {
  if (window.liquidGL) return Promise.resolve(window.liquidGL);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module"; // the vendored file ends with an ES export
    script.src = "/scripts/liquidGL.js";
    script.onload = () => (window.liquidGL ? resolve(window.liquidGL) : reject(new Error("liquidGL missing")));
    script.onerror = () => reject(new Error("liquidGL failed to load"));
    document.head.appendChild(script);
  });
  return loading;
}

// Turns the `.liquid-glass` layer of the auth stage into a refracting pane. The stage is mounted once
// (app/(auth)/layout.tsx), so this runs once; liquidGL follows the layer's size as the box resizes.
// Reduced transparency or more contrast: no lens, and globals.css makes the CSS `.glass` fallback solid.
export default function LiquidGlass() {
  useEffect(() => {
    const prefers = (query: string) => window.matchMedia(query).matches;
    if (prefers("(prefers-reduced-transparency: reduce)") || prefers("(prefers-contrast: more)")) return;

    let live = true;
    let lens: { destroy(): void } | undefined;
    loadLiquidGL()
      .then((liquidGL) => {
        if (!live || !document.querySelector(".liquid-glass")) return;
        lens = liquidGL({
          target: ".liquid-glass",
          zIndex: 1, // under the form (z-10), which paints on top and stays clickable
          refraction: 0.02,
          bevelDepth: 0.05,
          bevelWidth: 0.05, // a thin rim; wide bevels warp the box edges visibly on a large pane
          frost: 4,
          shadow: true,
          specular: false, // its highlights loop forever; the pane should be still once the page has settled
          reveal: prefers("(prefers-reduced-motion: reduce)") ? "none" : "fade",
        });
      })
      .catch(() => {});
    return () => {
      live = false;
      lens?.destroy();
    };
  }, []);

  return null;
}
