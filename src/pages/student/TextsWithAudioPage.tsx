import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Play, Clock, TrendingUp, Lock, CheckCircle2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import TextStudyModal from '@/components/texts/TextStudyModal';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

interface AudioText {
  id: string;
  title: string;
  title_pt: string;
  level: string;
  theme: string;
  seq: number;
  duration: string;
  full_text_pt?: string;
}

interface AudioSession {
  id: string;
  text_id: string;
  initial_score: number;
  final_score: number;
  completed: boolean;
}

interface Sentence {
  id: string;
  text_id: string;
  seq: number;
  en: string;
  pt: string;
}

interface VocabItem {
  id: string;
  sentence_id: string;
  word: string;
  translation: string;
  explanation: string | null;
}

interface PhraseItem {
  id: string;
  text_id: string;
  phrase: string;
  translation: string;
  explanation: string | null;
}

interface TipItem {
  id: string;
  text_id: string;
  seq: number;
  title: string;
  content: string;
}

export default function TextsWithAudioPage() {
  const { user } = useAuth();
  const [levelFilter, setLevelFilter] = useState('all');
  const [themeFilter, setThemeFilter] = useState('all');
  const [texts, setTexts] = useState<AudioText[]>([]);
  const [sessions, setSessions] = useState<AudioSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Study modal state
  const [studyModalOpen, setStudyModalOpen] = useState(false);
  const [selectedText, setSelectedText] = useState<AudioText | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [vocabulary, setVocabulary] = useState<VocabItem[]>([]);
  const [phrases, setPhrases] = useState<PhraseItem[]>([]);
  const [tips, setTips] = useState<TipItem[]>([]);

  // Fetch texts and sessions
  const DEV_MOCK_USER = user?.id === 'dev-user-id';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Always fetch texts
      const textsRes = await supabase.from('audio_texts').select('*').order('level').order('seq');
      if (textsRes.data) setTexts(textsRes.data as AudioText[]);

      // Only fetch sessions for real users (not the dev bypass mock)
      if (user && !DEV_MOCK_USER) {
        const sessionsRes = await supabase.from('audio_sessions').select('*').eq('user_id', user.id);
        if (sessionsRes.data) setSessions(sessionsRes.data as AudioSession[]);
      }
      setLoading(false);
    };
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);


  const levels = useMemo(() => [...new Set(texts.map((t) => t.level))], [texts]);
  const themes = useMemo(() => [...new Set(texts.map((t) => t.theme))], [texts]);

  // Determine text status based on gating logic
  const levelOrder = useMemo(() => {
    const sorted = [...new Set(texts.map(t => t.level))].sort();
    return sorted;
  }, [texts]);

  const getTextStatus = (text: AudioText) => {
    const session = sessions.find((s) => s.text_id === text.id);
    if (session?.completed) return 'completed' as const;

    const currentLevelIdx = levelOrder.indexOf(text.level);

    // Check if all texts from previous levels are completed
    if (currentLevelIdx > 0) {
      const prevLevels = levelOrder.slice(0, currentLevelIdx);
      const allPrevCompleted = prevLevels.every(lvl => {
        const lvlTexts = texts.filter(t => t.level === lvl);
        return lvlTexts.every(t => sessions.find(s => s.text_id === t.id)?.completed);
      });
      if (!allPrevCompleted) return 'locked' as const;
    }

    // Within the same level, check sequential order
    const sameLevelTexts = texts.filter((t) => t.level === text.level).sort((a, b) => a.seq - b.seq);
    const textIdx = sameLevelTexts.findIndex((t) => t.id === text.id);

    if (textIdx === 0) return 'available' as const;

    const prevText = sameLevelTexts[textIdx - 1];
    const prevSession = sessions.find((s) => s.text_id === prevText?.id);
    if (prevSession?.completed) return 'available' as const;

    return 'locked' as const;
  };

  const getTextAccuracy = (textId: string) => {
    const session = sessions.find((s) => s.text_id === textId);
    if (!session) return undefined;
    return Math.round((session.initial_score + session.final_score) / 2);
  };

  const filtered = texts.filter((t) => {
    if (levelFilter !== 'all' && t.level !== levelFilter) return false;
    if (themeFilter !== 'all' && t.theme !== themeFilter) return false;
    return true;
  });

  const handleStartStudy = async (text: AudioText) => {
    setSelectedText(text);

    const sentRes = await supabase.from('audio_text_sentences').select('*').eq('text_id', text.id).order('seq');
    const fetchedSentences = (sentRes.data || []) as Sentence[];
    setSentences(fetchedSentences);

    // Fetch vocabulary, phrases, and tips in parallel
    const sentenceIds = fetchedSentences.map((s) => s.id);
    const [vocabRes, phrasesRes, tipsRes] = await Promise.all([
      sentenceIds.length > 0
        ? supabase.from('audio_text_vocabulary').select('*').in('sentence_id', sentenceIds)
        : Promise.resolve({ data: [] }),
      supabase.from('audio_text_phrases').select('*').eq('text_id', text.id),
      supabase.from('audio_text_tips').select('*').eq('text_id', text.id).order('seq'),
    ]);

    setVocabulary((vocabRes.data || []) as VocabItem[]);
    setPhrases((phrasesRes.data || []) as PhraseItem[]);
    setTips((tipsRes.data || []) as TipItem[]);

    setStudyModalOpen(true);
  };

  const handleComplete = async (initialScore: number, finalScore: number) => {
    if (!user || !selectedText || DEV_MOCK_USER) {
      // In dev mode, just update local state without saving to Supabase
      if (selectedText) {
        setSessions((prev) => {
          const existing = prev.findIndex((s) => s.text_id === selectedText.id);
          const newSession: AudioSession = {
            id: crypto.randomUUID(),
            text_id: selectedText.id,
            initial_score: initialScore,
            final_score: finalScore,
            completed: true,
          };
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = newSession;
            return updated;
          }
          return [...prev, newSession];
        });
        toast.success('🎉 Texto concluído! (modo dev)');
      }
      return;
    }

    const { error } = await supabase.from('audio_sessions').upsert(
      {
        user_id: user.id,
        text_id: selectedText.id,
        initial_score: initialScore,
        final_score: finalScore,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,text_id' }
    );

    if (error) {
      toast.error('Erro ao salvar progresso');
      console.error(error);
      return;
    }

    // Update local sessions
    setSessions((prev) => {
      const existing = prev.findIndex((s) => s.text_id === selectedText.id);
      const newSession: AudioSession = {
        id: crypto.randomUUID(),
        text_id: selectedText.id,
        initial_score: initialScore,
        final_score: finalScore,
        completed: true,
      };
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newSession;
        return updated;
      }
      return [...prev, newSession];
    });

    // Save to localStorage as backup
    const key = `audio_sessions_${user.id}`;
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    stored[selectedText.id] = { initialScore, finalScore, completed: true, completedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(stored));
  };

  // Stats
  const completedCount = sessions.filter((s) => s.completed).length;
  const avgAccuracy = sessions.length > 0
    ? Math.round(sessions.reduce((acc, s) => acc + (s.initial_score + s.final_score) / 2, 0) / sessions.length)
    : 0;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Textos com Áudio</h1>
        <p className="text-muted-foreground">Pratique sua compreensão auditiva com textos narrados</p>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <BookOpen className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold text-foreground">{completedCount}/{texts.length}</p>
          <p className="text-xs text-muted-foreground">Concluídos</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <TrendingUp className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
          <p className="text-2xl font-bold text-foreground">{avgAccuracy}%</p>
          <p className="text-xs text-muted-foreground">Média</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto text-warning mb-1" />
          <p className="text-2xl font-bold text-foreground">{texts.length - completedCount}</p>
          <p className="text-xs text-muted-foreground">Pendentes</p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={item} className="glass rounded-xl border border-border p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Nível</span>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {levels.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Tema</span>
          <Select value={themeFilter} onValueChange={setThemeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {themes.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Texts list */}
      <motion.div variants={item} className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Seus Textos</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl border border-border bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((text, i) => {
              const status = getTextStatus(text);
              const isLocked = status === 'locked';
              const isCompleted = status === 'completed';
              const accuracy = getTextAccuracy(text.id);

              return (
                <motion.div
                  key={text.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  className={cn(
                    'rounded-xl border p-5 flex items-center gap-4',
                    isCompleted && 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
                    status === 'available' && 'bg-primary/5 border-primary/20 dark:bg-primary/10 dark:border-primary/30',
                    isLocked && 'bg-card border-border opacity-50'
                  )}
                >
                  {/* Play icon */}
                  <button
                    disabled={isLocked}
                    onClick={() => !isLocked && handleStartStudy(text)}
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors',
                      isLocked
                        ? 'border-border bg-secondary text-muted-foreground'
                        : isCompleted
                          ? 'border-emerald-300 bg-emerald-100 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400'
                          : 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
                    )}
                  >
                    {isLocked ? <Lock className="h-4 w-4" /> : isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={cn('font-semibold', isLocked ? 'text-muted-foreground' : 'text-foreground')}>
                        {text.title}
                      </h3>
                      <Badge className="bg-primary text-primary-foreground text-[10px]">{text.level}</Badge>
                      <span className="text-sm text-muted-foreground">{text.title_pt}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{text.duration}</span>
                      <Badge variant={isCompleted ? 'secondary' : isLocked ? 'outline' : 'default'} className="text-[10px]">
                        {isCompleted ? 'Concluído' : isLocked ? 'Bloqueado' : 'Disponível'}
                      </Badge>
                      {accuracy !== undefined && (
                        <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />Média: {accuracy}%</span>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  <Button
                    disabled={isLocked}
                    variant={isCompleted ? 'outline' : 'default'}
                    onClick={() => handleStartStudy(text)}
                    className={cn(
                      'shrink-0',
                      !isCompleted && !isLocked && 'gradient-primary text-primary-foreground'
                    )}
                  >
                    {isCompleted ? 'Rever' : 'Iniciar'}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Study Modal */}
      {selectedText && (
        <TextStudyModal
          open={studyModalOpen}
          onOpenChange={setStudyModalOpen}
          title={selectedText.title}
          titlePt={selectedText.title_pt}
          level={selectedText.level}
          fullTextPt={selectedText.full_text_pt}
          sentences={sentences}
          vocabulary={vocabulary}
          phrases={phrases}
          tips={tips}
          onComplete={handleComplete}
        />
      )}
    </motion.div>
  );
}
