import { storage } from "./storage";
import { sendPushNotification } from "./notifications";

let retryWorkerInterval: NodeJS.Timeout | null = null;
const RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 5;

const EXPONENTIAL_BACKOFF_DELAYS = [
  0,           // Attempt 1: Immediate (already tried)
  5 * 60,      // Attempt 2: 5 min delay (in seconds)
  15 * 60,     // Attempt 3: 15 min delay
  30 * 60,     // Attempt 4: 30 min delay
  60 * 60,     // Attempt 5: 60 min delay (final attempt)
];

function shouldRetryNotification(notification: any): boolean {
  const attempts = notification.deliveryAttempts || 0;
  
  if (attempts >= MAX_RETRY_ATTEMPTS) {
    return false;
  }

  if (attempts === 0) {
    return true;
  }

  const delaySeconds = EXPONENTIAL_BACKOFF_DELAYS[attempts] || EXPONENTIAL_BACKOFF_DELAYS[EXPONENTIAL_BACKOFF_DELAYS.length - 1];
  const lastAttempt = notification.lastAttemptAt || notification.createdAt;
  const lastAttemptTime = new Date(lastAttempt).getTime();
  const now = Date.now();
  const timeSinceLastAttempt = Math.floor((now - lastAttemptTime) / 1000);

  return timeSinceLastAttempt >= delaySeconds;
}

async function processRetryQueue(): Promise<void> {
  try {
    const pendingNotifications = await storage.getNotificationsPendingPush(50);
    
    if (pendingNotifications.length === 0) {
      return;
    }

    console.log(`Processing retry queue: ${pendingNotifications.length} notifications pending push`);

    for (const notification of pendingNotifications) {
      if (!shouldRetryNotification(notification)) {
        continue;
      }

      const currentAttempts = notification.deliveryAttempts || 0;
      
      try {
        const subscriptions = await storage.getUserPushSubscriptions(notification.userId);
        
        if (subscriptions.length === 0) {
          console.log(`No active subscriptions for user ${notification.userId}, marking notification ${notification.id} as failed`);
          await storage.updateNotificationDelivery(notification.id, {
            pendingPush: false,
            deliveryAttempts: currentAttempts + 1,
            lastAttemptAt: new Date(),
            pushError: 'No active push subscriptions',
          });
          continue;
        }

        console.log(`Retrying push notification ${notification.id}, attempt ${currentAttempts + 1}/${MAX_RETRY_ATTEMPTS}`);

        const pushPayload = {
          title: notification.title,
          body: notification.message,
          data: {
            url: '/',
            type: notification.type,
            id: notification.id,
            ...(notification.metadata || {}),
          },
        };

        const pushSuccess = await sendPushNotification(notification.userId, pushPayload);

        if (pushSuccess) {
          console.log(`Push notification retry successful for notification ${notification.id}`);
          await storage.updateNotificationDelivery(notification.id, {
            deliveredAt: new Date(),
            deliveryAttempts: currentAttempts + 1,
            lastAttemptAt: new Date(),
            pendingPush: false,
          });
        } else {
          const newAttempts = currentAttempts + 1;
          
          if (newAttempts >= MAX_RETRY_ATTEMPTS) {
            console.error(`Push notification failed permanently for notification ${notification.id} after ${newAttempts} attempts`);
            await storage.updateNotificationDelivery(notification.id, {
              deliveryAttempts: newAttempts,
              lastAttemptAt: new Date(),
              pendingPush: false,
              pushError: 'Max retry attempts reached',
            });
          } else {
            console.log(`Push notification retry failed for notification ${notification.id}, will retry later (attempt ${newAttempts}/${MAX_RETRY_ATTEMPTS})`);
            await storage.updateNotificationDelivery(notification.id, {
              deliveryAttempts: newAttempts,
              lastAttemptAt: new Date(),
              pushError: 'Push delivery failed, will retry',
            });
          }
        }
      } catch (error: any) {
        const newAttempts = currentAttempts + 1;
        const errorMessage = error.message || 'Unknown error during retry';
        
        console.error(`Error processing notification ${notification.id}:`, error);

        if (newAttempts >= MAX_RETRY_ATTEMPTS) {
          console.error(`Push notification failed permanently for notification ${notification.id} after ${newAttempts} attempts`);
          await storage.updateNotificationDelivery(notification.id, {
            deliveryAttempts: newAttempts,
            lastAttemptAt: new Date(),
            pendingPush: false,
            pushError: `Max retries reached: ${errorMessage}`,
          });
        } else {
          await storage.updateNotificationDelivery(notification.id, {
            deliveryAttempts: newAttempts,
            lastAttemptAt: new Date(),
            pushError: errorMessage,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error in retry worker processRetryQueue:', error);
  }
}

export function startRetryWorker(): void {
  if (retryWorkerInterval) {
    console.log('Retry worker is already running');
    return;
  }

  console.log(`Starting push notification retry worker (runs every ${RETRY_INTERVAL_MS / 1000 / 60} minutes)`);
  
  processRetryQueue().catch(err => {
    console.error('Error in initial retry queue process:', err);
  });

  retryWorkerInterval = setInterval(() => {
    processRetryQueue().catch(err => {
      console.error('Error in retry queue process:', err);
    });
  }, RETRY_INTERVAL_MS);
}

export function stopRetryWorker(): void {
  if (retryWorkerInterval) {
    console.log('Stopping push notification retry worker');
    clearInterval(retryWorkerInterval);
    retryWorkerInterval = null;
  }
}
