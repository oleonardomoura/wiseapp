import { Target, CheckCircle2, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { Profile } from '@/hooks/useAuth';

interface Milestone {
  title: string;
  desc: string;
  xp: number;
  check: (p: Profile | null) => boolean;
  progress: (p: Profile | null) => number;
  total: number;
}

const milestones: Milestone[] = [
  { title: 'Primeiro Login', desc: 'Criou sua conta', xp: 50, check: () => true, progress: () => 1, total: 1 },
  { title: 'Primeira Semana', desc: '7 dias na plataforma', xp: 100, check: (p) => (p?.streak ?? 0) >= 7, progress: (p) => Math.min(p?.streak ?? 0, 7), total: 7 },
  { title: '100 XP Acumulados', desc: 'Alcance 100 XP total', xp: 50, check: (p) => (p?.xp ?? 0) >= 100, progress: (p) => Math.min(p?.xp ?? 0, 100), total: 100 },
  { title: 'Streak de 7 dias', desc: 'Estude 7 dias seguidos', xp: 200, check: (p) => (p?.streak ?? 0) >= 7, progress: (p) => Math.min(p?.streak ?? 0, 7), total: 7 },
  { title: '500 XP Acumulados', desc: 'Alcance 500 XP total', xp: 150, check: (p) => (p?.xp ?? 0) >= 500, progress: (p) => Math.min(p?.xp ?? 0, 500), total: 500 },
  { title: 'Nível A2 Alcançado', desc: 'Evolua para o nível A2', xp: 300, check: (p) => ['A2','B1','B2','C1','C2'].includes(p?.cefr_level ?? ''), progress: (p) => ['A2','B1','B2','C1','C2'].includes(p?.cefr_level ?? '') ? 1 : 0, total: 1 },
  { title: '2000 XP Acumulados', desc: 'Alcance 2000 XP total', xp: 500, check: (p) => (p?.xp ?? 0) >= 2000, progress: (p) => Math.min(p?.xp ?? 0, 2000), total: 2000 },
];

function daysSince(date?: string | null) {
  if (!date) return 0;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

interface Props {
  profile: Profile | null;
}

export function MilestoneTimeline({ profile }: Props) {
  // Find first incomplete milestone as "next"
  const nextIdx = milestones.findIndex(m => !m.check(profile));

  return (
    <div className="space-y-1">
      {milestones.map((m, i) => {
        const done = m.check(profile);
        const prog = m.progress(profile);
        const pct = Math.round((prog / m.total) * 100);
        const isNext = i === nextIdx;

        return (
          <div key={m.title} className="flex gap-4">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              ) : isNext ? (
                <Target className="h-5 w-5 text-warning shrink-0 animate-pulse" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/30 shrink-0" />
              )}
              {i < milestones.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-[2rem] ${done ? 'bg-primary/40' : 'bg-border'}`} />
              )}
            </div>
            {/* Content */}
            <div className={`pb-4 flex-1 ${!done && !isNext ? 'opacity-40' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm text-foreground">{m.title}</p>
                <Badge variant={done ? 'default' : 'secondary'} className="text-xs">
                  {done ? 'Completo' : `+${m.xp} XP`}
                </Badge>
                {isNext && <Badge variant="outline" className="text-xs border-warning text-warning">Próximo</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{m.desc}</p>
              {!done && (
                <div className="flex items-center gap-2 mt-1.5">
                  <Progress value={pct} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground">{pct}%</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
