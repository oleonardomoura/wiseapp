import { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { ActivityEntry } from '@/hooks/useAchievements';
import { format, isToday, isYesterday, subDays, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const actionEmojis: Record<string, string> = {
  flashcard_review: '🃏',
  lesson_complete: '📘',
  text_read: '📚',
  community_post: '💬',
  oral_practice: '🎙️',
  streak_maintained: '🔥',
  badge_unlocked: '🏆',
  live_attended: '📺',
};

interface Props {
  history: ActivityEntry[];
}

export function HistoryList({ history }: Props) {
  const [period, setPeriod] = useState('week');

  const filtered = useMemo(() => {
    const cutoff = period === 'day' ? subDays(new Date(), 1) : period === 'week' ? subDays(new Date(), 7) : subDays(new Date(), 30);
    return history.filter(h => isAfter(new Date(h.created_at), cutoff));
  }, [history, period]);

  // Group by date label
  const grouped = useMemo(() => {
    const groups: { label: string; items: ActivityEntry[] }[] = [];
    const map = new Map<string, ActivityEntry[]>();
    filtered.forEach(h => {
      const d = new Date(h.created_at);
      const label = isToday(d) ? 'Hoje' : isYesterday(d) ? 'Ontem' : format(d, "d 'de' MMMM", { locale: ptBR });
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(h);
    });
    map.forEach((items, label) => groups.push({ label, items }));
    return groups;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{filtered.length} atividades</p>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Hoje</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {grouped.length === 0 && (
        <p className="text-center text-muted-foreground py-8">Nenhuma atividade neste período</p>
      )}

      {grouped.map(g => (
        <div key={g.label} className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-primary mb-2">{g.label}</p>
          <div className="space-y-1.5">
            {g.items.map(item => (
              <div key={item.id} className="flex items-center justify-between">
                <p className="text-sm text-foreground">
                  {actionEmojis[item.action] || '⭐'}{' '}
                  {typeof (item.metadata as Record<string, unknown> | undefined)?.description === 'string'
                    ? (item.metadata as { description: string }).description
                    : item.action}
                </p>
                {item.xp_earned > 0 && <Badge variant="secondary" className="text-xs">+{item.xp_earned} XP</Badge>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
