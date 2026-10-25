"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cacheProfile, getProfile } from "@/lib/profile";
import AppBackground from "@/components/AppBackground";

const PUBLIC_PATHS = ["/", "/login", "/signup"]; // "/" only forwards to the static landing page; auth pages bring their own stage
let triedFor: string | null = null; // don't refetch on every navigation if the profile row is missing

// Static export has no middleware, so gating is client-side. getSession() reads the local cache (no network),
// which keeps the app usable offline after one online login, until the access token expires.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const open = PUBLIC_PATHS.includes(pathname);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (open) return;
    let live = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (uid && getProfile()?.id !== uid && triedFor !== uid) {
        triedFor = uid;
        // First login on this browser (or a different dentist): fetch the profile once. Cap the wait so a dead network can't block the app.
        await Promise.race([cacheProfile(uid), new Promise((r) => setTimeout(r, 4000))]).catch(() => {});
      }
      if (!live) return;
      if (uid) setAuthed(true);
      else router.replace("/login");
    });
    return () => {
      live = false;
    };
  }, [open, pathname, router]);

  if (open) return children;
  // One background for every signed-in screen, mounted once here so it keeps playing across navigation.
  // Each screen enters with the app's short rise + fade (animate-enter; a plain fade under reduced motion).
  return (
    <>
      <AppBackground />
      {authed ? (
        <>
          <AppHeader />
          <div key={pathname} className="animate-enter flex flex-1 flex-col">
            {children}
          </div>
        </>
      ) : (
        <p role="status" className="animate-fade p-6 text-center text-sm text-muted">
          Checking sign-in…
        </p>
      )}
    </>
  );
}

// Wayfinding for signed-in screens: the wordmark always leads home, Settings is one tap away. A sticky glass bar,
// so page content scrolls under the material instead of losing a fixed opaque strip.
function AppHeader() {
  const pathname = usePathname();
  const link = (href: string, label: string) => {
    const current = pathname === href || (href === "/patients" && pathname.startsWith("/patients"));
    return (
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className="btn btn-ghost px-4 text-lg text-muted aria-[current=page]:bg-white/70 aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
      >
        {label}
      </Link>
    );
  };
  return (
    <header className="glass sticky top-3 z-40 mx-3 mt-3 md:top-4 md:mx-6 md:mt-4">
      <nav className="flex w-full items-center justify-between gap-4 px-4 py-2 md:px-8">
        <Link href="/patients" className="btn btn-ghost -ml-3 text-xl font-semibold tracking-tight text-foreground">
          OraTrace
        </Link>
        <div className="flex items-center gap-2">
          {link("/patients", "Patients")}
          {link("/settings", "Settings")}
        </div>
      </nav>
    </header>
  );
}
