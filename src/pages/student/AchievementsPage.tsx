import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Search } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAchievements, type AchievementDef } from '@/hooks/useAchievements';
import { LevelBanner } from '@/components/achievements/LevelBanner';
import { StreakAlert } from '@/components/achievements/StreakAlert';
import { StatsCards } from '@/components/achievements/StatsCards';
import { AchievementBadge } from '@/components/achievements/AchievementBadge';
import { AchievementModal } from '@/components/achievements/AchievementModal';
import { MilestoneTimeline } from '@/components/achievements/MilestoneTimeline';
import { HistoryList } from '@/components/achievements/HistoryList';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function AchievementsPage() {
  const {
    filteredBadges, unlockedMap, history, loading,
    filter, setFilter, categoryFilter, setCategoryFilter, search, setSearch,
    totalUnlocked, totalBadges, levelInfo, profile,
  } = useAchievements();

  const [selectedBadge, setSelectedBadge] = useState<AchievementDef | null>(null);

  const streak = profile?.streak ?? 0;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item}>
        <div className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Minhas Conquistas</h1>
            <p className="text-muted-foreground">Acompanhe seu progresso, conquistas e marcos no aprendizado</p>
          </div>
        </div>
      </motion.div>

      {/* Level Banner */}
      <motion.div variants={item}>
        <LevelBanner
          level={levelInfo.level}
          name={levelInfo.name}
          totalXp={levelInfo.totalXp}
          xpInLevel={levelInfo.xpInLevel}
          xpForNext={levelInfo.xpForNext}
          percent={levelInfo.percent}
          nextName={levelInfo.nextName}
        />
      </motion.div>

      {/* Streak Alert */}
      <motion.div variants={item}>
        <StreakAlert streak={streak} />
      </motion.div>

      {/* Tabs */}
      <motion.div variants={item}>
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="badges">Badges</TabsTrigger>
            <TabsTrigger value="milestones">Marcos</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-6">
            <StatsCards streak={streak} totalUnlocked={totalUnlocked} totalBadges={totalBadges} />
          </TabsContent>

          {/* Badges */}
          <TabsContent value="badges" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar badge..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unlocked' | 'locked')}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="unlocked">Desbloqueados</SelectItem>
                  <SelectItem value="locked">Bloqueados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Categorias</SelectItem>
                  <SelectItem value="study">Estudo Diário</SelectItem>
                  <SelectItem value="srs">Mestre do SRS</SelectItem>
                  <SelectItem value="oral">Prática Oral</SelectItem>
                  <SelectItem value="community">Comunidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredBadges.map((ach, i) => (
                <AchievementBadge
                  key={ach.key}
                  achievement={ach}
                  userAch={unlockedMap.get(ach.key)}
                  index={i}
                  onClick={() => setSelectedBadge(ach)}
                />
              ))}
              {filteredBadges.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-8">Nenhum badge encontrado</p>
              )}
            </div>
          </TabsContent>

          {/* Milestones */}
          <TabsContent value="milestones">
            <div className="rounded-xl border border-border bg-card p-6">
              <MilestoneTimeline profile={profile} />
            </div>
          </TabsContent>

          {/* History */}
          <TabsContent value="history">
            <HistoryList history={history} />
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Badge detail modal */}
      <AchievementModal
        achievement={selectedBadge}
        userAch={selectedBadge ? unlockedMap.get(selectedBadge.key) : undefined}
        open={!!selectedBadge}
        onOpenChange={open => !open && setSelectedBadge(null)}
      />
    </motion.div>
  );
}
