import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ProofImageDialogProps {
  open: boolean;
  proofUrl: string;
  onOpenChange: (open: boolean) => void;
}

export function ProofImageDialog({ open, proofUrl, onOpenChange }: ProofImageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" data-testid="dialog-proof-image">
        <DialogHeader>
          <DialogTitle>Transaction Proof</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center">
          <img src={proofUrl} alt="Transaction proof" className="max-h-[70vh] max-w-full rounded-md object-contain" data-testid="img-proof" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
