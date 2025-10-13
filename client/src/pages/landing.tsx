import { useEffect } from "react";
import { useLocation } from "wouter";
import { CosmicBackground } from "@/components/cosmic-background";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { RotatingGlass } from "@/components/rotating-glass";

export default function Landing() {
  const [, setLocation] = useLocation();

  // Auto-redirect to /auth if referral code is present in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref");
    if (refCode) {
      // Redirect to /auth with referral code preserved (replace to avoid back-button loop)
      window.location.replace(`/auth?ref=${refCode}`);
    }
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* background */}
      <CosmicBackground />
      {/* subtle overlay so content pops */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-black/70" />

      {/* theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* hero */}
      <main className="relative z-10 mx-auto max-w-5xl px-4 text-center">
        {/* rotating glass layer (behind hero) */}
        <div className="relative">
          <RotatingGlass speed={60} className="opacity-60" />

          {/* Title + Taglines */}
          <header className="mb-8">
            <h1 className="text-6xl md:text-9xl font-bold tracking-wide font-serif mb-4 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(245,158,11,0.25)]">
              XNRT
            </h1>
            <h2 className="text-xl md:text-2xl text-white/90 font-serif">We Build the NextGen</h2>
            <p className="mt-1 text-sm md:text-base text-white/60">
              A project of NextGen Rise Foundation
            </p>
          </header>
        </div>

        {/* Description */}
        <p className="mx-auto mb-12 max-w-2xl text-lg md:text-xl text-white/70">
          Join the ultimate off-chain gamification earning platform. Earn XNRT tokens through
          staking, mining, referrals, and task completion.
        </p>

        {/* CTA */}
        <div className="flex justify-center">
          <Button
            size="lg"
            className="text-lg px-8 py-6 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-semibold transition-all duration-200 shadow-lg hover:shadow-amber-500/40"
            onClick={() => setLocation("/auth")}
            data-testid="button-get-started"
            aria-label="Get started with XNRT"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Get Started
          </Button>
        </div>

        {/* Feature cards */}
        <section
          aria-label="Platform highlights"
          className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-4"
        >
          {[
            { label: "Staking", value: "Up to 730% APY" },
            { label: "Mining", value: "24hr Sessions" },
            { label: "Referrals", value: "3-Level System" },
            { label: "Tasks", value: "Daily Rewards" },
          ].map((card, i) => (
            <div
              key={card.label}
              className="relative rounded-2xl border border-amber-500/25 bg-white/5 p-6 backdrop-blur-md transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg overflow-hidden"
              style={{ animationDelay: `${150 * i}ms` }}
            >
              {/* optional: subtle rotating sheen per card */}
              <RotatingGlass speed={50} className="opacity-35" />
              <div className="mb-2 text-3xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent leading-tight">
                {card.value}
              </div>
              <div className="text-sm text-white/55">{card.label}</div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
