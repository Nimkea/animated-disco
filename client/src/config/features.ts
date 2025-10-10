// Feature flags for phased rollout and testing
export interface FeatureFlags {
  pwa: {
    offline: boolean;
    push: boolean;
    realtime: boolean;
  };
  ux: {
    animations: boolean;
    haptics: boolean;
    sounds: boolean;
  };
  admin: {
    analytics: boolean;
    advancedFeatures: boolean;
  };
}

// Default feature flags configuration
const defaultFlags: FeatureFlags = {
  pwa: {
    offline: true,  // PWA offline support enabled
    push: false,    // Push notifications not yet implemented
    realtime: false, // WebSocket realtime not yet implemented
  },
  ux: {
    animations: true,  // Framer Motion animations enabled
    haptics: false,    // Haptic feedback not yet implemented
    sounds: false,     // Sound effects not yet implemented
  },
  admin: {
    analytics: true,   // Admin analytics enabled
    advancedFeatures: false, // Advanced admin features not yet implemented
  },
};

// Load feature flags from environment or use defaults
function loadFeatureFlags(): FeatureFlags {
  const envFlags = import.meta.env.VITE_FEATURE_FLAGS;
  
  if (envFlags) {
    try {
      const parsed = JSON.parse(envFlags);
      return { ...defaultFlags, ...parsed };
    } catch (error) {
      console.warn('Failed to parse VITE_FEATURE_FLAGS, using defaults', error);
    }
  }
  
  return defaultFlags;
}

export const featureFlags = loadFeatureFlags();

// Helper functions to check feature flags
export function isFeatureEnabled(category: keyof FeatureFlags, feature: string): boolean {
  const categoryFlags = featureFlags[category];
  return categoryFlags ? (categoryFlags as any)[feature] === true : false;
}

// Export individual feature checks for convenience
export const isPWAOfflineEnabled = () => isFeatureEnabled('pwa', 'offline');
export const isPushNotificationsEnabled = () => isFeatureEnabled('pwa', 'push');
export const isRealtimeEnabled = () => isFeatureEnabled('pwa', 'realtime');
export const areAnimationsEnabled = () => isFeatureEnabled('ux', 'animations');
export const areHapticsEnabled = () => isFeatureEnabled('ux', 'haptics');
export const areSoundsEnabled = () => isFeatureEnabled('ux', 'sounds');
