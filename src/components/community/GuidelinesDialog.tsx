import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Heart, MessageCircle, Ban } from 'lucide-react';

const RULES = [
  { icon: Heart, title: 'Seja respeitoso', desc: 'Trate todos com gentileza. Críticas construtivas são bem-vindas.' },
  { icon: MessageCircle, title: 'Use inglês quando puder', desc: 'A comunidade é um ótimo lugar para praticar. Não se preocupe com erros!' },
  { icon: ShieldCheck, title: 'Proteja sua privacidade', desc: 'Não compartilhe informações pessoais como telefone ou endereço.' },
  { icon: Ban, title: 'Proibido spam', desc: 'Links externos, propagandas e conteúdo repetitivo serão removidos.' },
];

interface GuidelinesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GuidelinesDialog({ open, onOpenChange }: GuidelinesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Diretrizes da Comunidade</DialogTitle>
          <DialogDescription>Mantenha nosso espaço seguro e acolhedor</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {RULES.map(rule => (
            <div key={rule.title} className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <rule.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{rule.title}</p>
                <p className="text-xs text-muted-foreground">{rule.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={() => onOpenChange(false)} className="w-full mt-2">Entendi</Button>
      </DialogContent>
    </Dialog>
  );
}
