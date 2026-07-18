import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'offensive', label: 'Linguagem Ofensiva' },
  { value: 'harassment', label: 'Assédio' },
  { value: 'other', label: 'Outro' },
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: 'post' | 'comment';
}

export default function ReportDialog({ open, onOpenChange, targetType }: ReportDialogProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!reason) { toast.error('Selecione um motivo.'); return; }
    toast.success('Denúncia enviada. Nossa equipe irá analisar.');
    setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Denunciar {targetType === 'post' ? 'Post' : 'Comentário'}</DialogTitle>
          <DialogDescription>Selecione o motivo da denúncia</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {REASONS.map(r => (
            <button
              key={r.value}
              onClick={() => setReason(r.value)}
              className={cn(
                'text-left rounded-lg border px-4 py-3 text-sm transition-colors',
                reason === r.value
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!reason}>Enviar Denúncia</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
