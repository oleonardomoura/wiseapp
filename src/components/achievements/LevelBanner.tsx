import { Trophy } from 'lucide-react';

interface Props {
  level: number;
  name: string;
  totalXp: number;
  xpInLevel: number;
  xpForNext: number;
  percent: number;
  nextName?: string;
}

export function LevelBanner({ level, name, totalXp, xpInLevel, xpForNext, percent, nextName }: Props) {
  return (
    <div className="rounded-xl p-5 gradient-primary text-primary-foreground relative overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Nível {level} — {name}</h2>
          <p className="text-sm opacity-90">{totalXp.toLocaleString()} XP total</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm font-medium">{percent}%</span>
            <div className="w-64 h-2.5 rounded-full bg-primary-foreground/20">
              <div className="h-full rounded-full bg-primary-foreground/80 transition-all duration-700" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </div>
        <div className="text-right space-y-1">
          {nextName && <p className="text-xs opacity-80">Próximo: {nextName}</p>}
          <p className="text-lg font-bold">{xpInLevel}/{xpForNext} XP</p>
          <Trophy className="h-8 w-8 opacity-60 ml-auto" />
        </div>
      </div>
    </div>
  );
}
