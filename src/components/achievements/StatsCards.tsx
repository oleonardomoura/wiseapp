import { Flame, Clock, Brain, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  streak: number;
  totalUnlocked: number;
  totalBadges: number;
}

export function StatsCards({ streak, totalUnlocked, totalBadges }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Streak Atual</span>
          <Flame className="h-4 w-4 text-orange-500" />
        </div>
        <p className="text-3xl font-bold text-primary">{streak} dias</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Esta Semana</span>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-3xl font-bold text-foreground">—</p>
        <p className="text-xs text-muted-foreground">Tempo de estudo</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Revisões SRS</span>
          <Brain className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-3xl font-bold text-foreground">—</p>
        <p className="text-xs text-muted-foreground">Completadas esta semana</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Badges</span>
          <Award className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-3xl font-bold text-foreground">{totalUnlocked}/{totalBadges}</p>
        <p className="text-xs text-muted-foreground">Desbloqueados</p>
      </div>
    </div>
  );
}
