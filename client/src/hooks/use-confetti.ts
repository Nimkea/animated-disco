import { useCallback } from 'react';
import confetti from 'canvas-confetti';
import { featureFlags } from '@/config/features';

export type CelebrationType = 'achievement' | 'streak' | 'levelup' | 'default';

export function useConfetti() {
  const celebrate = useCallback((type: CelebrationType = 'default') => {
    // Check if animations feature flag is enabled with safe optional chaining
    // If disabled or undefined, gracefully skip confetti without errors
    if (!featureFlags?.ux?.animations) {
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
      
      // Level up: Rainbow confetti with supported shapes only (square, circle)
      levelup: {
        particleCount: 200,
        spread: 120,
        colors: ['#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'],
        shapes: ['square', 'circle'],
      },
      
      // Default: Golden amber confetti
      default: {
        particleCount: 100,
        spread: 70,
        colors: ['#f59e0b', '#fbbf24', '#fcd34d'],
      },
    };

    // Trigger confetti with the selected pattern
    // Wrapped in try/catch to prevent UI crashes from confetti errors
    try {
      const pattern = patterns[type];
      confetti(pattern);
    } catch {
      // Silently fail - confetti should never crash the page
    }
  }, []);

  return { celebrate };
}
