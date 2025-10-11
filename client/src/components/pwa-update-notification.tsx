import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function PWAUpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateFn, setUpdateFn] = useState<(() => void) | null>(null);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ update: () => void }>;
      setUpdateFn(() => customEvent.detail.update);
      setShowUpdate(true);
    };

    window.addEventListener('sw-update-available', handleUpdate as EventListener);

    return () => {
      window.removeEventListener('sw-update-available', handleUpdate as EventListener);
    };
  }, []);

  const handleUpdate = () => {
    if (updateFn) {
      updateFn();
      setShowUpdate(false);
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96"
        data-testid="pwa-update-notification"
      >
        <div className="bg-gradient-to-r from-primary to-secondary p-[2px] rounded-lg shadow-2xl">
          <div className="bg-background rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  <p className="font-semibold text-sm">Update Available</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  A new version of XNRT is ready. Update now for the latest features and improvements.
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={handleUpdate}
                    className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 h-8 text-xs"
                    data-testid="button-update-pwa"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Update Now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDismiss}
                    className="h-8 text-xs"
                    data-testid="button-dismiss-update"
                  >
                    Later
                  </Button>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-2 -mt-1"
                onClick={handleDismiss}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
