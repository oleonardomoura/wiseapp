import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export interface AchievementDef {
  key: string;
  emoji: string;
  title: string;
  desc: string;
  category: 'study' | 'srs' | 'oral' | 'community';
  tiers: { tier: string; label: string; requirement: number }[];
}

export interface UserAchievement {
  achievement_key: string;
  unlocked_at: string;
  tier: string;
  xp_earned: number;
}

export interface ActivityEntry {
  id: string;
  action: string;
  xp_earned: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Master list of all possible achievements
export const ACHIEVEMENTS: AchievementDef[] = [
  { key: 'first_login', emoji: '🎉', title: 'Primeiro Login', desc: 'Criou sua conta na plataforma', category: 'study', tiers: [{ tier: 'bronze', label: 'Bronze', requirement: 1 }] },
  { key: 'streak_7', emoji: '🔥', title: 'Ofensiva de 7 dias', desc: '7 dias seguidos estudando', category: 'study', tiers: [{ tier: 'bronze', label: 'Bronze', requirement: 7 }, { tier: 'silver', label: 'Prata', requirement: 14 }, { tier: 'gold', label: 'Ouro', requirement: 30 }, { tier: 'diamond', label: 'Diamante', requirement: 90 }] },
  { key: 'reader_10', emoji: '📚', title: 'Leitor Ávido', desc: 'Leu textos com áudio', category: 'study', tiers: [{ tier: 'bronze', label: 'Bronze', requirement: 5 }, { tier: 'silver', label: 'Prata', requirement: 10 }, { tier: 'gold', label: 'Ouro', requirement: 25 }] },
  { key: 'flashcard_master', emoji: '🃏', title: 'Mestre dos Flashcards', desc: 'Revisou flashcards no SRS', category: 'srs', tiers: [{ tier: 'bronze', label: 'Bronze', requirement: 50 }, { tier: 'silver', label: 'Prata', requirement: 100 }, { tier: 'gold', label: 'Ouro', requirement: 500 }, { tier: 'diamond', label: 'Diamante', requirement: 1000 }] },
  { key: 'communicator', emoji: '💬', title: 'Comunicador', desc: 'Posts publicados na comunidade', category: 'community', tiers: [{ tier: 'bronze', label: 'Bronze', requirement: 5 }, { tier: 'silver', label: 'Prata', requirement: 10 }, { tier: 'gold', label: 'Ouro', requirement: 25 }] },
  { key: 'oral_practice', emoji: '🎙️', title: 'Mestre da Oralidade', desc: 'Práticas orais completadas', category: 'oral', tiers: [{ tier: 'bronze', label: 'Bronze', requirement: 3 }, { tier: 'silver', label: 'Prata', requirement: 10 }, { tier: 'gold', label: 'Ouro', requirement: 25 }] },
  { key: 'level_a2', emoji: '🏅', title: 'Nível A2', desc: 'Alcançou o nível A2', category: 'study', tiers: [{ tier: 'bronze', label: 'Bronze', requirement: 1 }] },
  { key: 'level_b1', emoji: '🏆', title: 'Nível B1', desc: 'Alcançou o nível B1', category: 'study', tiers: [{ tier: 'gold', label: 'Ouro', requirement: 1 }] },
  { key: 'first_week', emoji: '📅', title: 'Primeira Semana', desc: 'Completou 7 dias na plataforma', category: 'study', tiers: [{ tier: 'bronze', label: 'Bronze', requirement: 1 }] },
  { key: 'words_100', emoji: '📖', title: '100 Palavras', desc: 'Aprendeu 100 palavras novas', category: 'srs', tiers: [{ tier: 'bronze', label: 'Bronze', requirement: 100 }, { tier: 'silver', label: 'Prata', requirement: 250 }, { tier: 'gold', label: 'Ouro', requirement: 500 }] },
  { key: 'live_participant', emoji: '📺', title: 'Participante de Lives', desc: 'Participou de aulas ao vivo', category: 'oral', tiers: [{ tier: 'bronze', label: 'Bronze', requirement: 3 }, { tier: 'silver', label: 'Prata', requirement: 10 }] },
  { key: 'study_hours', emoji: '⏱️', title: 'Dedicação Total', desc: 'Horas totais de estudo', category: 'study', tiers: [{ tier: 'bronze', label: 'Bronze', requirement: 10 }, { tier: 'silver', label: 'Prata', requirement: 50 }, { tier: 'gold', label: 'Ouro', requirement: 100 }] },
];

const CACHE_KEY = 'wisy:achievements';
const HISTORY_CACHE_KEY = 'wisy:activity_history';

// XP level thresholds
export const LEVELS = [
  { level: 1, name: 'Iniciante', minXp: 0 },
  { level: 2, name: 'Explorador', minXp: 200 },
  { level: 3, name: 'Aprendiz', minXp: 500 },
  { level: 4, name: 'Estudante', minXp: 1000 },
  { level: 5, name: 'Intermediário', minXp: 1800 },
  { level: 6, name: 'Avançado', minXp: 2800 },
  { level: 7, name: 'Proficiente', minXp: 4000 },
  { level: 8, name: 'Especialista', minXp: 5500 },
  { level: 9, name: 'Mestre', minXp: 7500 },
  { level: 10, name: 'Lenda', minXp: 10000 },
];

export function getLevelInfo(xp: number) {
  let current = LEVELS[0];
  let next = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXp) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
      break;
    }
  }
  const xpInLevel = xp - current.minXp;
  const xpForNext = next ? next.minXp - current.minXp : 0;
  const percent = next ? Math.round((xpInLevel / xpForNext) * 100) : 100;
  return { level: current.level, name: current.name, totalXp: xp, xpInLevel, xpForNext, percent, nextName: next?.name };
}

export type BadgeFilter = 'all' | 'unlocked' | 'locked';

export function useAchievements() {
  const { user, profile } = useAuthContext();
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>(() => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); } catch { return []; }
  });
  const [history, setHistory] = useState<ActivityEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_CACHE_KEY) || '[]'); } catch { return []; }
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BadgeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Fetch from Supabase
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      const [achRes, histRes] = await Promise.all([
        supabase.from('user_achievements').select('*').eq('user_id', user.id),
        supabase.from('activity_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
      ]);
      if (achRes.data) {
        const mapped = achRes.data.map(a => ({ achievement_key: a.achievement_key, unlocked_at: a.unlocked_at, tier: a.tier, xp_earned: a.xp_earned }));
        setUserAchievements(mapped);
        localStorage.setItem(CACHE_KEY, JSON.stringify(mapped));
      }
      if (histRes.data) {
        const mapped = histRes.data.map(h => ({
          id: h.id,
          action: h.action,
          xp_earned: h.xp_earned,
          metadata: (h.metadata && typeof h.metadata === 'object' ? (h.metadata as Record<string, unknown>) : {}) ?? {},
          created_at: h.created_at,
        }));
        setHistory(mapped);
        localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(mapped));
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const unlockedMap = useMemo(() => {
    const map = new Map<string, UserAchievement>();
    userAchievements.forEach(a => map.set(a.achievement_key, a));
    return map;
  }, [userAchievements]);

  const filteredBadges = useMemo(() => {
    let list = ACHIEVEMENTS;
    if (categoryFilter !== 'all') list = list.filter(a => a.category === categoryFilter);
    if (filter === 'unlocked') list = list.filter(a => unlockedMap.has(a.key));
    if (filter === 'locked') list = list.filter(a => !unlockedMap.has(a.key));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => a.title.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q));
    }
    return list;
  }, [filter, categoryFilter, search, unlockedMap]);

  const totalUnlocked = userAchievements.length;
  const totalBadges = ACHIEVEMENTS.length;

  const levelInfo = getLevelInfo(profile?.xp ?? 0);

  return {
    achievements: ACHIEVEMENTS,
    userAchievements,
    unlockedMap,
    filteredBadges,
    history,
    loading,
    filter, setFilter,
    categoryFilter, setCategoryFilter,
    search, setSearch,
    totalUnlocked,
    totalBadges,
    levelInfo,
    profile,
  };
}
