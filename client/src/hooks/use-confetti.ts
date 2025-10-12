import { useCallback } from 'react';
import confetti from 'canvas-confetti';
import { featureFlags } from '@/config/features';

export type CelebrationType = 'achievement' | 'streak' | 'levelup' | 'default';

export function useConfetti() {
  const celebrate = useCallback((type: CelebrationType = 'default') => {
    // Check if animations feature flag is enabled
    // If disabled, gracefully skip confetti without errors
    if (!featureFlags.ux.animations) {
      return;
    }

    // Define confetti patterns for different celebration types
    const patterns: Record<CelebrationType, confetti.Options> = {
      // Achievement unlock: Golden confetti burst from center
      achievement: {
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#fbbf24', '#fcd34d'],
      },
      
      // Streak milestone: Flame-colored confetti (orange/red/yellow)
      streak: {
        particleCount: 150,
        spread: 90,
        colors: ['#f97316', '#fb923c', '#fdba74'],
        shapes: ['circle'],
      },
      
      // Level up: Rainbow confetti with stars
      levelup: {
        particleCount: 200,
        spread: 120,
        colors: ['#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'],
        shapes: ['star', 'circle'],
      },
      
      // Default: Golden amber confetti
      default: {
        particleCount: 100,
        spread: 70,
        colors: ['#f59e0b', '#fbbf24', '#fcd34d'],
      },
    };

    // Trigger confetti with the selected pattern
    const pattern = patterns[type];
    confetti(pattern);
  }, []);

  return { celebrate };
}
