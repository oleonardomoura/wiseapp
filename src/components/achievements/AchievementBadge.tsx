import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import type { AchievementDef, UserAchievement } from '@/hooks/useAchievements';

const tierColors: Record<string, string> = {
  bronze: 'border-amber-600/40 bg-amber-600/10',
  silver: 'border-slate-400/40 bg-slate-400/10',
  gold: 'border-yellow-500/40 bg-yellow-500/10',
  diamond: 'border-cyan-400/40 bg-cyan-400/10',
};

interface Props {
  achievement: AchievementDef;
  userAch?: UserAchievement;
  index: number;
  onClick: () => void;
}

export function AchievementBadge({ achievement, userAch, index, onClick }: Props) {
  const unlocked = !!userAch;
  const tier = userAch?.tier || 'bronze';
  const tierLabel = achievement.tiers.find(t => t.tier === tier)?.label;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className={`rounded-xl border p-5 text-center transition-all hover:shadow-md cursor-pointer ${
        unlocked ? tierColors[tier] || 'border-primary/30 bg-primary/5' : 'border-border bg-card opacity-40 grayscale'
      }`}
    >
      <span className="text-4xl block">{achievement.emoji}</span>
      <h3 className="mt-3 font-semibold text-foreground text-sm">{achievement.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{achievement.desc}</p>
      {unlocked && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <Badge variant="default" className="text-xs">{tierLabel || 'Desbloqueado'}</Badge>
        </div>
      )}
    </motion.button>
  );
}
