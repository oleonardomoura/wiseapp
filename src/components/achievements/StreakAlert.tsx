import { Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface Props {
  streak: number;
}

export function StreakAlert({ streak }: Props) {
  if (streak <= 0) return null;

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <Flame className="h-5 w-5 text-warning" />
        <div>
          <p className="font-semibold text-foreground">Seu streak de {streak} dias está ativo! 🔥</p>
          <p className="text-sm text-muted-foreground">Mantenha sua sequência com uma atividade rápida</p>
        </div>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to="/flashcards">Fazer 10 Flashcards (3 min)</Link>
      </Button>
    </div>
  );
}
