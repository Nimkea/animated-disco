import { useEffect } from "react";
import { useLocation } from "wouter";
import { CosmicBackground } from "@/components/cosmic-background";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default function Landing() {
  const [, setLocation] = useLocation();

  // Auto-redirect to /auth if referral code is present in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    if (refCode) {
      // Redirect to /auth with referral code preserved (replace to avoid back-button loop)
      window.location.replace(`/auth?ref=${refCode}`);
    }
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <CosmicBackground />
      
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <div className="mb-8 animate-in fade-in duration-1000">
          <h1 className="text-7xl md:text-9xl font-bold font-serif mb-4 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400 bg-clip-text text-transparent animate-pulse">
            XNRT
          </h1>
          <p className="text-xl md:text-2xl text-white/90 font-serif mb-2">
            We Build the NextGen
          </p>
          <p className="text-sm md:text-base text-white/60">
            A project of NextGen Rise Foundation
          </p>
        </div>

        <p className="text-lg md:text-xl text-white/70 mb-12 max-w-2xl mx-auto animate-in slide-in-from-bottom duration-1000 delay-300">
          Join the ultimate off-chain gamification earning platform. 
          Earn XNRT tokens through staking, mining, referrals, and task completion.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in slide-in-from-bottom duration-1000 delay-500">
          <Button
            size="lg"
            className="text-lg px-8 py-6 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-semibold transition-all duration-300 shadow-lg hover:shadow-amber-500/50"
            onClick={() => setLocation("/auth")}
            data-testid="button-get-started"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Get Started
          </Button>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
          {[
            { label: "Staking", value: "Up to 730% APY" },
            { label: "Mining", value: "24hr Sessions" },
            { label: "Referrals", value: "3-Level System" },
            { label: "Tasks", value: "Daily Rewards" },
          ].map((stat, i) => (
            <div 
              key={stat.label} 
              className="backdrop-blur-md bg-white/5 border border-amber-500/30 rounded-md p-6 hover-elevate"
              style={{ animationDelay: `${700 + i * 100}ms` }}
            >
              <div className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent mb-2">{stat.value}</div>
              <div className="text-sm text-white/50">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
