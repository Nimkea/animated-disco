import { useEffect, useRef } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function useMissionTracker(eventKey: string, enabled = true) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled || firedRef.current || !eventKey) return;
    firedRef.current = true;

    void apiRequest("POST", "/api/tasks/track", { eventKey, amount: 1 })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/tasks/user"] });
        queryClient.invalidateQueries({ queryKey: ["/api/engagement/summary"] });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("401")) {
          console.warn("Mission tracker failed:", message);
        }
      });
  }, [enabled, eventKey]);
}
