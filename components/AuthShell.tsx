"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import LiquidGlass from "@/components/LiquidGlass";
import { DitheredLogo } from "@/components/ui/dithered-logo";
import { HeroGeometricBackground } from "@/components/ui/hero-geometric";

// Sign-in / sign-up stage, mounted once by app/(auth)/layout.tsx: liquid-glass box on the left, dithered tooth mark
// filling the right, over the Hero Geometric dithered gradient in the tooth's teal and the page's mist. Switching
// between /login and /signup swaps only the form; the box resizes to the new form instead of the page remounting.
// liquidGL refracts a snapshot of the page, so the form and the tooth carry data-liquid-ignore: otherwise the lens
// draws a shifted, blurred copy of the form behind the real one. The lens sits on its own decorative layer
// because liquidGL rewrites its target's styles (background transparent, pointer-events none).
export default function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const contentRef = useRef<HTMLDivElement>(null);
  const [boxHeight, setBoxHeight] = useState<number>();

  // The box follows its form's natural height; on desktop it never drops below the viewport, so it fills the left half.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    const measure = () => setBoxHeight(Math.max(content.offsetHeight, desktop.matches ? window.innerHeight - 48 : 0));
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(content);
    window.addEventListener("resize", measure);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col md:flex-row">
      {/* Absolute, not fixed: liquidGL skips fixed elements when it snapshots what to refract. Deep corner is a lighter
          teal of the tooth's hue so the #0d6b72 tooth stays the darkest mark; drifts 8s, then settles. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-background">
        <HeroGeometricBackground color1="#7fb3b7" color2="#f3f5f6" runFor={8000} />
      </div>

      <div
        className="auth-box relative mx-4 my-6 flex items-center md:ml-8 md:w-[calc(50vw-3rem)] md:min-h-[calc(100dvh-3rem)]"
        style={{ height: boxHeight }}
      >
        <div aria-hidden="true" className="glass glass-strong liquid-glass absolute inset-0" />
        {/* Milky veil between lens (z-0) and form (z-10): liquidGL's tint multiplies, so it can't lighten the glass. */}
        <div aria-hidden="true" data-liquid-ignore="" className="glass-veil absolute inset-0 z-[5] rounded-3xl" />
        <div ref={contentRef} data-liquid-ignore="" className="relative z-10 w-full p-7 md:p-14">
          <div key={pathname} className="animate-fade">
            {children}
          </div>
        </div>
      </div>

      {/* Reduced motion: the tooth stays still (its cursor ripple is the only motion it has). */}
      <div data-liquid-ignore="" className="relative z-10 hidden flex-1 items-center justify-center motion-reduce:pointer-events-none md:flex">
        <DitheredLogo
          imageSrc="/brand/tooth.svg"
          invert={false}
          scale={0.96}
          gridSize={180}
          threshold={170}
          dotScale={0.8}
          particleColor="#0d6b72" // --accent; canvas can't read CSS variables, and the component's own text-black wins over a class
          className="h-[min(96dvh,50vw)] w-[min(96dvh,50vw)]"
        />
      </div>

      <LiquidGlass />
    </div>
  );
}
