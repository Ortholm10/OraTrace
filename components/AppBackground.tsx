// Background for every signed-in screen (mounted once in AuthGate, so it plays continuously across navigation).
// public/bg/hero.mp4 is the supplied clip re-encoded as a seamless loop (its last 1.5s crossfade into its first),
// so there is no jump every 10s; the poster is its first frame, so the swap from poster to video is invisible.
// Served locally so it works offline. Reduced motion: the video is hidden and the still poster stays (globals.css).
export default function AppBackground() {
  return (
    <div aria-hidden="true" className="app-video fixed inset-0 -z-10">
      <video src="/bg/hero.mp4" poster="/bg/hero-poster.jpg" autoPlay muted loop playsInline preload="auto" />
    </div>
  );
}
