import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export function SWUpdatePrompt() {
  const { toast } = useToast();

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ update: () => void }>;
      const { update } = customEvent.detail;

      toast({
        title: 'Update Available',
        description: 'A new version of XNRT is available. Refresh the page to update.',
        duration: 10000,
      });
      
      setTimeout(() => update(), 10000);
    };

    const handleOfflineReady = () => {
      toast({
        title: 'Ready for Offline',
        description: 'XNRT is now available offline!',
        duration: 3000,
      });
    };

    window.addEventListener('sw-update-available', handleUpdate);
    window.addEventListener('sw-offline-ready', handleOfflineReady);

    return () => {
      window.removeEventListener('sw-update-available', handleUpdate);
      window.removeEventListener('sw-offline-ready', handleOfflineReady);
    };
  }, [toast]);

  return null;
}
