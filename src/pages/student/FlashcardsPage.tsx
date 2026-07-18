import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Clock, Brain, TrendingUp, RotateCcw, Play, Flame, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isDue } from '@/lib/srs-algorithm';
import type { Rating } from '@/lib/srs-algorithm';
import { toast } from 'sonner';

// Lazy load study modal since it's only used when studying
const StudySessionModal = lazy(() => import('@/components/flashcards/StudySessionModal').then(m => ({ default: m.StudySessionModal })));

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

interface Collection {
  id: string;
  name: string;
  level: string;
}

interface CollectionStats extends Collection {
  totalCards: number;
  dueCount: number;
  accuracy: number;
}

interface Flashcard {
  id: string;
  collection_id: string;
  front: string;
  back: string;
}

interface CardProgress {
  flashcard_id: string;
  easiness_factor: number;
  interval: number;
  repetitions: number;
  due_at: string;
  total_reviews: number;
  correct_reviews: number;
}

// Skeleton loading component
function SkeletonCard() {
  return (
    <div className="glass rounded-xl border border-border p-5 space-y-4">
      <Skeleton className="h-6 w-3/4" />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-8" />
        </div>
      </div>
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

function getStreakKey(userId: string) { return `flashcard_streak_${userId}`; }

function loadStreak(userId: string): { count: number; lastDate: string } {
  try {
    const raw = localStorage.getItem(getStreakKey(userId));
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return { count: 0, lastDate: '' };
}

function updateStreak(userId: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const streak = loadStreak(userId);

  if (streak.lastDate === today) return streak.count;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newCount = streak.lastDate === yesterday ? streak.count + 1 : 1;
  const newStreak = { count: newCount, lastDate: today };
  localStorage.setItem(getStreakKey(userId), JSON.stringify(newStreak));
  return newCount;
}

export default function FlashcardsPage() {
  const { user } = useAuthContext();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, CardProgress>>({});
  const [loading, setLoading] = useState(true);
  const [collectionStats, setCollectionStats] = useState<CollectionStats[]>([]);
  const [streak, setStreak] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(20);

  // Study session state
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionCollectionId, setSessionCollectionId] = useState<string | null>(null);
  const [todayReviewed, setTodayReviewed] = useState(0);

  const DEV_MOCK_USER = user?.id === 'dev-user-id';

  // Load initial data with optimized queries
  useEffect(() => {
    // DEV BYPASS: load collections/flashcards even without real user
    // (skip progress fetch for mock user)
    
    let isMounted = true;
    if (user?.id && !DEV_MOCK_USER) {
      setStreak(loadStreak(user.id).count);
    }

    const loadData = async () => {
      try {
        // Load collections first - fastest query
        const { data: collectionsData } = await supabase
          .from('flashcard_collections')
          .select('id, name, level')
          .order('level, name');

        if (!isMounted) return;
        if (collectionsData) setCollections(collectionsData as Collection[]);

        // Load flashcards for all collections; only fetch user-specific data for real users
        const flashcardsRes = await supabase
          .from('flashcards')
          .select('id, collection_id, front, back')
          .in('collection_id', collectionsData?.map(c => c.id) || []);

        const [progressRes, prefsRes] = user?.id && !DEV_MOCK_USER
          ? await Promise.all([
              supabase.from('flashcard_progress').select('*').eq('user_id', user.id),
              supabase.from('study_preferences').select('daily_reviews').eq('user_id', user.id).maybeSingle()
            ])
          : [{ data: [] }, { data: null }];

        if (!isMounted) return;

        // Process flashcards
        if (flashcardsRes.data) {
          setFlashcards(flashcardsRes.data as Flashcard[]);
        }

        // Process progress
        if (progressRes.data) {
          const map: Record<string, CardProgress> = {};
          const todayStr = new Date().toISOString().slice(0, 10);
          let reviewedToday = 0;
          
          for (const p of progressRes.data) {
            map[p.flashcard_id] = p as unknown as CardProgress;
            if (p.last_reviewed_at && (p.last_reviewed_at as string).slice(0, 10) === todayStr) {
              reviewedToday++;
            }
          }
          setProgressMap(map);
          setTodayReviewed(reviewedToday);
        }

        // Set preferences
        if (prefsRes.data?.daily_reviews) {
          setDailyLimit(prefsRes.data.daily_reviews);
        }

      } catch (error) {
        console.error('Error loading flashcard data:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    
    return () => { isMounted = false; };
  }, [user?.id]);

  // Compute collection stats efficiently
  useEffect(() => {
    const stats = collections.map(col => {
      const cards = flashcards.filter(c => c.collection_id === col.id);
      let dueCount = 0;
      let totalReviews = 0;
      let correctReviews = 0;

      for (const card of cards) {
        const prog = progressMap[card.id];
        if (!prog || isDue(prog.due_at)) dueCount++;
        if (prog) {
          totalReviews += prog.total_reviews;
          correctReviews += prog.correct_reviews;
        }
      }

      const accuracy = totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0;
      return { ...col, totalCards: cards.length, dueCount, accuracy };
    });
    setCollectionStats(stats);
  }, [collections, flashcards, progressMap]);

  const totalCards = flashcards.length;
  const totalDue = collectionStats.reduce((a, c) => a + c.dueCount, 0);
  const globalAccuracy = useMemo(() => {
    let total = 0, correct = 0;
    for (const p of Object.values(progressMap)) {
      total += p.total_reviews;
      correct += p.correct_reviews;
    }
    return total > 0 ? Math.round((correct / total) * 100) : 0;
  }, [progressMap]);

  // Get study queue for a collection (or all), limited by daily reviews setting
  const getStudyQueue = useCallback((collectionId: string | null) => {
    const remaining = Math.max(0, dailyLimit - todayReviewed);
    if (remaining === 0) return [];

    const cards = collectionId
      ? flashcards.filter(c => c.collection_id === collectionId)
      : flashcards;

    return cards
      .filter(card => {
        const prog = progressMap[card.id];
        return !prog || isDue(prog.due_at);
      })
      .slice(0, remaining)
      .map(card => {
        const prog = progressMap[card.id];
        return {
          id: card.id,
          front: card.front,
          back: card.back,
          easinessFactor: prog?.easiness_factor ?? 2.5,
          interval: prog?.interval ?? 0,
          repetitions: prog?.repetitions ?? 0,
          dueAt: prog?.due_at ?? new Date().toISOString(),
        };
      });
  }, [flashcards, progressMap, dailyLimit, todayReviewed]);

  const remainingToday = Math.max(0, dailyLimit - todayReviewed);

  // Handle card review
  const handleCardReviewed = useCallback(async (
    cardId: string,
    rating: Rating,
    newState: { easinessFactor: number; interval: number; repetitions: number; dueAt: string }
  ) => {
    // In dev bypass, update local state only (no Supabase persist)

    const prev = progressMap[cardId];
    const isCorrect = rating !== 'again';

    const updated: CardProgress = {
      flashcard_id: cardId,
      easiness_factor: newState.easinessFactor,
      interval: newState.interval,
      repetitions: newState.repetitions,
      due_at: newState.dueAt,
      total_reviews: (prev?.total_reviews ?? 0) + 1,
      correct_reviews: (prev?.correct_reviews ?? 0) + (isCorrect ? 1 : 0),
    };

    setProgressMap(prev => ({ ...prev, [cardId]: updated }));
    setTodayReviewed(prev => prev + 1);

    // Persist to Supabase only for real users
    if (user?.id && !DEV_MOCK_USER) {
      await supabase.from('flashcard_progress').upsert({
        user_id: user.id,
        flashcard_id: cardId,
        easiness_factor: updated.easiness_factor,
        interval: updated.interval,
        repetitions: updated.repetitions,
        due_at: updated.due_at,
        total_reviews: updated.total_reviews,
        correct_reviews: updated.correct_reviews,
        last_reviewed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,flashcard_id' });
    }
  }, [user?.id, progressMap]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSessionComplete = useCallback(() => {
    if (user?.id && !DEV_MOCK_USER) {
      const newStreak = updateStreak(user.id);
      setStreak(newStreak);
      toast.success(`🎉 Sessão concluída! Sequência: ${newStreak} dia${newStreak > 1 ? 's' : ''}`);
    } else {
      toast.success('🎉 Sessão concluída! (modo dev)');
    }
  }, [user?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const startSession = (collectionId: string | null) => {
    setSessionCollectionId(collectionId);
    setSessionOpen(true);
  };

  const studyQueue = sessionOpen ? getStudyQueue(sessionCollectionId) : [];
  const sessionCollectionName = sessionCollectionId
    ? collections.find(c => c.id === sessionCollectionId)?.name ?? 'Flashcards'
    : 'Todas as Coleções';

  const dailyProgress = dailyLimit > 0
    ? Math.min(100, Math.round((todayReviewed / dailyLimit) * 100))
    : (todayReviewed > 0 ? 100 : 0);
  const effectiveDue = Math.min(totalDue, remainingToday);

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="text-center space-y-2">
          <Skeleton className="h-9 w-64 mx-auto" />
          <Skeleton className="h-5 w-96 mx-auto" />
        </div>

        {/* Stats skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="glass rounded-xl border border-border p-5 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-4" />
              </div>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>

        {/* Collections skeleton */}
        <div className="space-y-6">
          <Skeleton className="h-6 w-32" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
        {/* Header */}
        <motion.div variants={item} className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Flashcards</h1>
          <p className="text-muted-foreground">Sistema de repetição espaçada para memorização eficaz</p>
        </motion.div>

        {/* Stats */}
        <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="glass rounded-xl border border-border p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total de Cards</span>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-foreground">{totalCards}</p>
          </div>

          <div className="glass rounded-xl border border-border p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Para Revisar</span>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {effectiveDue > 0 && <Badge variant="destructive" className="text-[10px]">Pendente</Badge>}
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground">{effectiveDue}</p>
            <p className="text-xs text-muted-foreground">{todayReviewed}/{dailyLimit} revisões hoje</p>
            {effectiveDue > 0 && (
              <Button size="sm" className="w-full gradient-primary text-primary-foreground mt-1" onClick={() => startSession(null)}>
                Estudar Agora
              </Button>
            )}
          </div>

          <div className="glass rounded-xl border border-border p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Sequência</span>
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-3xl font-bold text-foreground">{streak} {streak === 1 ? 'dia' : 'dias'}</p>
            <p className="text-xs text-muted-foreground">{streak > 0 ? 'Continue assim!' : 'Comece hoje!'}</p>
          </div>

          <div className="glass rounded-xl border border-border p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Precisão</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-foreground">{globalAccuracy}%</p>
            <p className="text-xs text-muted-foreground">Todas as revisões</p>
          </div>
        </motion.div>

        {/* Pending reviews */}
        <motion.div variants={item} className="glass rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Revisões Pendentes</h2>
          </div>

          {effectiveDue > 0 ? (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xl font-bold text-foreground">{effectiveDue} cards para revisar</p>
                  <p className="text-sm text-muted-foreground">
                    {todayReviewed}/{dailyLimit} revisões feitas · Tempo estimado: {Math.ceil(effectiveDue * 0.5)} min
                  </p>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Hoje
                </Badge>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progresso Diário</span>
                  <span className="font-semibold text-foreground">{dailyProgress}%</span>
                </div>
                <Progress value={dailyProgress} className="h-2" />
              </div>

              <Button
                className="w-full gradient-primary text-primary-foreground h-12 text-base font-semibold"
                onClick={() => startSession(null)}
              >
                <Play className="mr-2 h-4 w-4" />
                Começar Sessão de Estudo
              </Button>
            </>
          ) : remainingToday === 0 ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <h3 className="text-lg font-semibold text-foreground">Meta diária atingida! 🎉</h3>
              <p className="text-muted-foreground">Você completou suas {dailyLimit} revisões de hoje. Volte amanhã!</p>
            </div>
          ) : (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <h3 className="text-lg font-semibold text-foreground">Tudo em dia! 🎉</h3>
              <p className="text-muted-foreground">Não há cards para revisar agora. Volte mais tarde.</p>
            </div>
          )}
        </motion.div>

        {/* Collections grouped by level */}
        <motion.div variants={item} className="space-y-6">
          <h2 className="text-lg font-semibold text-foreground">Suas Coleções</h2>
          {Object.entries(
            collectionStats.reduce((acc, col) => {
              const level = col.level || 'Outros';
              if (!acc[level]) acc[level] = [];
              acc[level].push(col);
              return acc;
            }, {} as Record<string, CollectionStats[]>)
          )
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([level, cols]) => (
              <div key={level} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-semibold">{level}</Badge>
                  <span className="text-sm text-muted-foreground">{Array.isArray(cols) ? cols.length : 0} {Array.isArray(cols) && cols.length === 1 ? 'coleção' : 'coleções'}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.isArray(cols) && cols.map((col, i) => (
                    <motion.div
                      key={col.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.02 }}
                      className="glass rounded-xl border border-border p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">{col.name}</h3>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-semibold text-foreground">{col.totalCards} cards</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Para revisar</p>
                          <p className="font-semibold text-foreground">{col.dueCount}</p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Precisão</span>
                          <span className="font-semibold text-foreground">{col.accuracy}%</span>
                        </div>
                        <Progress value={col.accuracy} className="h-1.5" />
                      </div>

                      <Button
                        size="sm"
                        className="w-full gradient-primary text-primary-foreground"
                        disabled={col.dueCount === 0}
                        onClick={() => startSession(col.id)}
                      >
                        {col.dueCount > 0 ? (
                          <>Estudar {col.dueCount}</>
                        ) : (
                          <><Sparkles className="mr-1 h-3 w-3" /> Em dia</>
                        )}
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
        </motion.div>

        {/* Tips */}
        <motion.div variants={item} className="glass rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Dicas de Estudo</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-primary">Consistência é a chave</p>
              <p className="text-sm text-muted-foreground mt-1">Estude um pouco todos os dias em vez de sessões longas esporádicas.</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">Seja honesto nas avaliações</p>
              <p className="text-sm text-muted-foreground mt-1">Use Novamente/Difícil/Bom/Fácil de forma precisa para otimizar o algoritmo.</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Study Modal - Lazy loaded */}
      {sessionOpen && (
        <Suspense fallback={<div />}>
          <StudySessionModal
            open={sessionOpen}
            onOpenChange={setSessionOpen}
            cards={studyQueue}
            collectionName={sessionCollectionName}
            onCardReviewed={handleCardReviewed}
            onSessionComplete={handleSessionComplete}
          />
        </Suspense>
      )}
    </>
  );
}
