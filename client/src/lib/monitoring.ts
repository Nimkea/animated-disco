import * as Sentry from '@sentry/react';
import { onCLS, onINP, onFCP, onLCP, onTTFB, Metric } from 'web-vitals';

// Initialize Sentry (optional - only if DSN is provided)
export function initMonitoring() {
  const sentryDSN = import.meta.env.VITE_SENTRY_DSN;
  
  if (sentryDSN) {
    Sentry.init({
      dsn: sentryDSN,
      environment: import.meta.env.MODE,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
    
    console.log('Sentry initialized for error tracking');
  }
  
  initWebVitals();
}

// Web Vitals monitoring
function initWebVitals() {
  function sendToAnalytics(metric: Metric) {
    const sentryDSN = import.meta.env.VITE_SENTRY_DSN;
    
    if (sentryDSN) {
      Sentry.setMeasurement(metric.name, metric.value, metric.rating);
    }
    
    console.log(`[Web Vitals] ${metric.name}:`, {
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
    });
  }

  onCLS(sendToAnalytics);
  onINP(sendToAnalytics);
  onFCP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}

export { Sentry };
