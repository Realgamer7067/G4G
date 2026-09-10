// Temporary until the public shell lands in phase 1b.
import { LogoTile } from "@/components/brand/logo-tile";

export default function Home() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="grid justify-items-center gap-6 text-center">
        <LogoTile size="lg" priority />
        <h1 className="font-display text-4xl font-extrabold tracking-tight">GeeksforGeeks Student Chapter</h1>
        <p className="max-w-md text-muted">Our new website is on its way.</p>
      </div>
    </main>
  );
}
