import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { AchievementDef, UserAchievement } from '@/hooks/useAchievements';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const tierEmoji: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇', diamond: '💎' };

interface Props {
  achievement: AchievementDef | null;
  userAch?: UserAchievement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AchievementModal({ achievement, userAch, open, onOpenChange }: Props) {
  if (!achievement) return null;
  const unlocked = !!userAch;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-4xl">{achievement.emoji}</span>
            <span>{achievement.title}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground">{achievement.desc}</p>

          {unlocked && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-sm font-medium text-primary">✅ Desbloqueado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Em {format(new Date(userAch!.unlocked_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              {userAch!.xp_earned > 0 && (
                <p className="text-xs text-muted-foreground">+{userAch!.xp_earned} XP ganhos</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Níveis</p>
            {achievement.tiers.map((t, i) => {
              const isUnlocked = unlocked && achievement.tiers.findIndex(x => x.tier === userAch!.tier) >= i;
              return (
                <div key={t.tier} className={`flex items-center gap-3 rounded-lg p-2 ${isUnlocked ? 'bg-accent/50' : 'opacity-50'}`}>
                  <span>{tierEmoji[t.tier] || '🏅'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{t.label}</p>
                    <p className="text-xs text-muted-foreground">Requisito: {t.requirement}</p>
                  </div>
                  {isUnlocked && <Badge variant="default" className="text-xs">Concluído</Badge>}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
