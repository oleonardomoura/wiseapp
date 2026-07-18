import { useState, useCallback, useRef, useEffect } from 'react';
import { diffWords } from 'diff';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Play,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  RotateCcw,
  Plus,
  Loader2,
  Lightbulb,
  Languages,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import AudioPlayer from './AudioPlayer';
import { useTTS } from '@/hooks/useTTS';

interface Sentence {
  id: string;
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

interface TextStudyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  titlePt: string;
  level: string;
  fullTextPt?: string;
  sentences: Sentence[];
  vocabulary: VocabItem[];
  phrases: PhraseItem[];
  tips: TipItem[];
  onComplete: (initialScore: number, finalScore: number) => void;
}

const STAGE_TABS = [
  { num: 1, label: 'Ouvir' },
  { num: 2, label: 'Entender' },
  { num: 3, label: 'Traduzir' },
  { num: 4, label: 'Repetir' },
  { num: 5, label: 'Só ouvir' },
];

const MIN_REPS = 5;
const MAX_REPS = 10;

/** Escape string for use in RegExp */
function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default function TextStudyModal({
  open,
  onOpenChange,
  title,
  titlePt,
  level,
  fullTextPt,
  sentences,
  vocabulary,
  phrases,
  tips,
  onComplete,
}: TextStudyModalProps) {
  const [stage, setStage] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxStageReached, setMaxStageReached] = useState(1);
  const [initialScore, setInitialScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(0.85);
  const [voice, setVoice] = useState('en-US-Neural2-D');
  const [showVocabulary, setShowVocabulary] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  const [showDicas, setShowDicas] = useState(false);
  const [showFullPt, setShowFullPt] = useState(false);
  const [activeSentenceIdx, setActiveSentenceIdx] = useState<number | null>(null);
  const [practiceCount, setPracticeCount] = useState(0);
  const [initialScoreSubmitted, setInitialScoreSubmitted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [showTextStage4, setShowTextStage4] = useState(false);
  const [showTranslationStage4, setShowTranslationStage4] = useState(false);
  const [visibleTranslations, setVisibleTranslations] = useState<Set<string>>(new Set());
  
  // Stage 3: Translate
  const [userTranslations, setUserTranslations] = useState<Record<string, string>>({});
  const [revealedSentences, setRevealedSentences] = useState<Set<string>>(new Set());
  
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const { speak: ttsSpeak, isLoading: ttsLoading } = useTTS();

  // Reset on open
  useEffect(() => {
    if (open) {
      setStage(1);
      setMaxStageReached(1);
      setInitialScore(0);
      setFinalScore(0);
      setPlaybackRate(0.85);
      setShowVocabulary(false);
      setShowTranslations(false);
      setShowDicas(false);
      setShowFullPt(false);
      setActiveSentenceIdx(null);
      setPracticeCount(0);
      setInitialScoreSubmitted(false);
      setCompleted(false);
      setShowTextStage4(false);
      setShowTranslationStage4(false);
      setVisibleTranslations(new Set());
      setUserTranslations({});
      setRevealedSentences(new Set());
    }
  }, [open]);

  // Auto-scroll active sentence
  useEffect(() => {
    if (open && activeSentenceIdx !== null && sentences[activeSentenceIdx]) {
      const sentence = sentences[activeSentenceIdx];
      const elId =
        stage === 2 ? `sentence-${sentence.id}` :
        stage === 3 ? `sentence-s3-${sentence.id}` :
        stage === 4 ? `sentence-s4-${sentence.id}` :
        stage === 5 ? `sentence-s5-${sentence.id}` : null;
      if (elId) {
        const el = document.getElementById(elId);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeSentenceIdx, open, stage, sentences]);

  const scrollToTop = () => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToStage = (s: number) => {
    if (s <= maxStageReached) { setStage(s); scrollToTop(); }
  };

  const advanceStage = (next: number) => {
    setStage(next);
    setMaxStageReached((m) => Math.max(m, next));
    scrollToTop();
  };

  const getVocabForSentence = (sentenceId: string) =>
    vocabulary.filter((v) => v.sentence_id === sentenceId);

  const toggleSentenceTranslation = (id: string) => {
    setVisibleTranslations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /**
   * Highlight words in a sentence with:
   * - Blue underline for vocabulary items (Seção 6)
   * - Amber underline for bilingual phrases (Seção 4)
   * Both show a popover on click when showVocabulary is active.
   */
  const highlightWords = (text: string, vocabItems: VocabItem[]) => {
    if (!showVocabulary || (vocabItems.length === 0 && phrases.length === 0)) {
      return <span className="font-mono text-sm">{text}</span>;
    }

    type Segment =
      | { text: string; type: 'plain' }
      | { text: string; type: 'vocab'; item: VocabItem }
      | { text: string; type: 'phrase'; item: PhraseItem };

    const segments: Segment[] = [{ text, type: 'plain' }];

    // Helper: split segments by a set of match items
    function applySplits<T extends { word?: string; phrase?: string }>(
      segs: Segment[],
      items: T[],
      segType: 'vocab' | 'phrase',
    ): Segment[] {
      let result: Segment[] = segs;
      for (const item of items) {
        const keyword = (item as unknown as VocabItem).word ?? (item as unknown as PhraseItem).phrase;
        const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'gi');
        result = result.flatMap((seg) => {
          if (seg.type !== 'plain') return [seg];
          const parts = seg.text.split(regex);
          return parts.map((p) =>
            regex.test(p)
              ? ({ text: p, type: segType, item: item as unknown } as Segment)
              : ({ text: p, type: 'plain' } as Segment),
          );
        });
      }
      return result;
    }

    const sortedVocab = [...vocabItems].sort((a, b) => b.word.length - a.word.length);
    const sortedPhrases = [...phrases].sort((a, b) => b.phrase.length - a.phrase.length);

    const final = applySplits(applySplits(segments, sortedPhrases, 'phrase'), sortedVocab, 'vocab');

    return (
      <span className="font-mono text-sm">
        {final.map((seg, i) => {
          if (seg.type === 'plain') return <span key={i}>{seg.text}</span>;

          if (seg.type === 'vocab') {
            const v = seg.item as VocabItem;
            return (
              <Popover key={i}>
                <PopoverTrigger asChild>
                  <button className="underline decoration-primary decoration-2 underline-offset-2 text-primary font-semibold hover:bg-primary/10 rounded px-0.5 transition-colors">
                    {seg.text}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="text-[10px] bg-primary/10 text-primary border-primary/30">Vocabulário</Badge>
                    <p className="font-semibold text-foreground text-sm">{v.word}</p>
                  </div>
                  <p className="text-sm text-primary font-medium">{v.translation}</p>
                  {v.explanation && <p className="text-xs text-muted-foreground">{v.explanation}</p>}
                </PopoverContent>
              </Popover>
            );
          }

          // type === 'phrase' (bilingual analysis)
          const p = seg.item as PhraseItem;
          return (
            <Popover key={i}>
              <PopoverTrigger asChild>
                <button className="underline decoration-amber-500 decoration-2 underline-offset-2 text-amber-600 dark:text-amber-400 font-semibold hover:bg-amber-500/10 rounded px-0.5 transition-colors">
                  {seg.text}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-400/30">Expressão</Badge>
                  <p className="font-semibold text-foreground text-sm">{p.phrase}</p>
                </div>
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">{p.translation}</p>
                {p.explanation && <p className="text-xs text-muted-foreground">{p.explanation}</p>}
              </PopoverContent>
            </Popover>
          );
        })}
      </span>
    );
  };

  const speakSentence = useCallback(
    async (sentenceId: string, text: string) => {
      setSpeakingId(sentenceId);
      await ttsSpeak(text, playbackRate, voice);
      setSpeakingId(null);
    },
    [playbackRate, voice, ttsSpeak],
  );

  const handleComplete = () => {
    setCompleted(true);
    onComplete(initialScore, finalScore);
    toast.success('🎉 Texto concluído! Parabéns!');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent ref={contentRef} className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background border-b border-border px-6 pt-5 pb-4">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {title} <span className="text-muted-foreground font-normal">· {titlePt}</span>
              </DialogTitle>
              <p className="text-sm text-muted-foreground">{level} · {title}</p>
            </DialogHeader>

            {/* Tab navigation */}
            <div className="flex items-center gap-2 mt-4">
              {STAGE_TABS.map((tab) => {
                const isActive = stage === tab.num;
                const isReachable = tab.num <= maxStageReached;
                return (
                  <button
                    key={tab.num}
                    onClick={() => goToStage(tab.num)}
                    disabled={!isReachable}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary'
                        : isReachable
                          ? 'bg-card border-border text-foreground hover:bg-muted'
                          : 'bg-muted border-border text-muted-foreground cursor-not-allowed',
                    )}
                  >
                    {tab.num} · {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-6 pb-6 pt-4 space-y-5">
            <AnimatePresence mode="wait">
              {/* ─── STAGE 1: Ouvir ─── */}
              {stage === 1 && !completed && (
                <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <AudioPlayer
                    sentences={sentences}
                    playbackRate={playbackRate}
                    onPlaybackRateChange={setPlaybackRate}
                    voice={voice}
                    onVoiceChange={setVoice}
                  />

                  <p className="text-sm text-primary">
                    Não se preocupe se você ainda não entendeu muito. Apenas escute e perceba os sons principais.
                  </p>

                  {/* Self-assessment */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                    <div className="text-center">
                      <p className="font-semibold text-foreground">Autoavaliação inicial</p>
                      <p className="text-sm text-muted-foreground">Avalie sua compreensão antes de prosseguir.</p>
                    </div>
                    <Slider
                      value={[initialScore]}
                      onValueChange={([v]) => setInitialScore(v)}
                      min={0}
                      max={100}
                      step={5}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Baixa compreensão</span>
                      <span>Alta compreensão</span>
                    </div>
                    <p className="text-center text-lg font-bold text-foreground">{initialScore}%</p>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setInitialScore(0)}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Repetir do Início
                    </Button>
                    <Button onClick={() => { setInitialScoreSubmitted(true); advanceStage(2); }}>
                      Já ouvi
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ─── STAGE 2: Entender ─── */}
              {stage === 2 && !completed && (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <AudioPlayer
                    sentences={sentences}
                    playbackRate={playbackRate}
                    onPlaybackRateChange={setPlaybackRate}
                    voice={voice}
                    onVoiceChange={setVoice}
                    activeSentenceIdx={activeSentenceIdx}
                    onSentenceChange={setActiveSentenceIdx}
                  />

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm text-primary flex-1 min-w-0">
                      Alterne a tradução apenas quando necessário. Foque no significado de cada linha.
                    </p>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <Button
                        variant={showVocabulary ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShowVocabulary(!showVocabulary)}
                      >
                        <BookOpen className="h-3.5 w-3.5 mr-1" /> Vocabulário
                      </Button>
                      <Button
                        variant={showTranslations ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShowTranslations(!showTranslations)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> PT-BR
                      </Button>
                      {tips.length > 0 && (
                        <Button
                          variant={showDicas ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setShowDicas(true)}
                          className={showDicas ? '' : 'border-amber-400/60 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'}
                        >
                          <Lightbulb className="h-3.5 w-3.5 mr-1" /> Dicas
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Vocab legend */}
                  {showVocabulary && (vocabulary.length > 0 || phrases.length > 0) && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
                      {vocabulary.length > 0 && (
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-4 h-0.5 bg-primary rounded" />
                          <span className="underline decoration-primary decoration-2 underline-offset-1 text-primary font-medium">Vocabulário</span>
                        </span>
                      )}
                      {phrases.length > 0 && (
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-4 h-0.5 bg-amber-500 rounded" />
                          <span className="underline decoration-amber-500 decoration-2 underline-offset-1 text-amber-600 font-medium">Expressões</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Sentences */}
                  <div className="space-y-3">
                    {sentences.map((s, idx) => {
                      const vocabItems = getVocabForSentence(s.id);
                      const isActive = activeSentenceIdx === idx;
                      const showThisTranslation = showTranslations || visibleTranslations.has(s.id);

                      return (
                        <div
                          key={s.id}
                          id={`sentence-${s.id}`}
                          className={cn(
                            'rounded-xl border p-4 transition-all',
                            isActive ? 'border-primary bg-primary/5' : 'border-border bg-card',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">Inglês</p>
                              <p className={cn('leading-relaxed', isActive && 'font-medium')}>
                                {highlightWords(s.en, vocabItems)}
                              </p>
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Tradução</p>
                                {showThisTranslation ? (
                                  <div>
                                    <p className="text-sm text-muted-foreground italic">{s.pt}</p>
                                    {!showTranslations && (
                                      <button
                                        onClick={() => toggleSentenceTranslation(s.id)}
                                        className="text-[10px] text-muted-foreground flex items-center gap-1 hover:underline mt-1.5"
                                      >
                                        <EyeOff className="h-3 w-3" /> Ocultar tradução
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => toggleSentenceTranslation(s.id)}
                                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                                  >
                                    <Eye className="h-3 w-3" /> Mostrar tradução (pt-BR)
                                  </button>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => speakSentence(s.id, s.en)}
                              disabled={speakingId === s.id || ttsLoading}
                              className="mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                            >
                              {speakingId === s.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Play className="h-3.5 w-3.5 ml-0.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2">
                    <Button variant="ghost" size="sm" onClick={() => goToStage(1)}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                    </Button>
                    <Button onClick={() => advanceStage(3)}>
                      Continuar <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ─── STAGE 3: Traduzir ─── */}
              {stage === 3 && !completed && (
                <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <p className="text-sm text-primary">
                    Pratique sua escrita. Leia a tradução em português e tente escrever em inglês. Depois confira.
                  </p>

                  <div className="space-y-4">
                    {sentences.map((s, idx) => {
                      const isRevealed = revealedSentences.has(s.id);
                      return (
                        <div key={s.id} id={`sentence-s3-${s.id}`} className="rounded-xl border border-border bg-card p-4 space-y-3">
                          <p className="text-sm font-medium text-muted-foreground italic">{s.pt}</p>
                          
                          {isRevealed ? (
                            <div className="flex-1 space-y-2 pb-1 relative">
                              {(() => {
                                const cleanForDiff = (str: string) => str.replace(/[,;:"-]/g, '').replace(/\s+/g, ' ').trim();
                                const userStr = cleanForDiff(userTranslations[s.id] || '');
                                const correctStr = cleanForDiff(s.en);
                                const diff = diffWords(userStr, correctStr);
                                
                                const matchChars = diff.filter(d => !d.added && !d.removed).map(d => d.value.replace(/\s+/g, '')).join('').length;
                                const extraChars = diff.filter(d => d.removed).map(d => d.value.replace(/\s+/g, '')).join('').length;
                                const correctChars = correctStr.replace(/\s+/g, '').length;
                                
                                // Calculate score: Match chars minus a penalty for extra wrong chars, divided by total correct chars.
                                const rawScore = Math.round(((matchChars - (extraChars * 0.5)) / (correctChars || 1)) * 100);
                                const score = Math.max(0, Math.min(100, rawScore));
                                
                                const scoreColor = score >= 90 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-red-500';

                                return (
                                  <>
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="text-xs font-semibold text-muted-foreground">Comparação:</p>
                                      <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-full border border-border">
                                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Acerto:</span>
                                        <span className={cn('text-sm font-bold', scoreColor)}>{score}%</span>
                                      </div>
                                    </div>
                                    <div className="min-h-[60px] w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm shadow-sm leading-relaxed whitespace-pre-wrap">
                                      {diff.map((part, i) => (
                                        <span
                                          key={i}
                                          className={cn(
                                            part.added ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-0.5 rounded font-medium' :
                                            part.removed ? 'bg-red-500/20 text-red-700 dark:text-red-400 line-through px-0.5 rounded text-muted-foreground' :
                                            'text-foreground'
                                          )}
                                        >
                                          {part.value}
                                        </span>
                                      ))}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          ) : (
                            <textarea
                              className="min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              placeholder="Type in English..."
                              value={userTranslations[s.id] || ''}
                              onChange={(e) => setUserTranslations({ ...userTranslations, [s.id]: e.target.value })}
                            />
                          )}

                          <div className="flex items-center justify-between">
                            {!isRevealed ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setRevealedSentences(new Set(revealedSentences).add(s.id))}
                              >
                                Conferir resposta
                              </Button>
                            ) : (
                              <div className="flex-1 space-y-2">
                                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Resposta Correta:</p>
                                <p className="text-sm font-mono text-foreground">{s.en}</p>
                              </div>
                            )}

                            {isRevealed && (
                              <button
                                onClick={() => speakSentence(s.id, s.en)}
                                disabled={speakingId === s.id || ttsLoading}
                                className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                              >
                                {speakingId === s.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Play className="h-3.5 w-3.5 ml-0.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2">
                    <Button variant="ghost" size="sm" onClick={() => goToStage(2)}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                    </Button>
                    <Button onClick={() => advanceStage(4)}>
                      Continuar <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ─── STAGE 4: Repetir ─── */}
              {stage === 4 && !completed && (
                <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <AudioPlayer
                    sentences={sentences}
                    playbackRate={playbackRate}
                    onPlaybackRateChange={setPlaybackRate}
                    voice={voice}
                    onVoiceChange={setVoice}
                    activeSentenceIdx={activeSentenceIdx}
                    onSentenceChange={setActiveSentenceIdx}
                  />

                  <p className="text-sm text-primary">
                    Cada repetição fica mais fácil. Continue!
                  </p>

                  {/* Text display */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground mb-3">Inglês</p>
                    {sentences.map((s, idx) => (
                      <p
                        key={s.id}
                        id={`sentence-s4-${s.id}`}
                        className={cn(
                          'font-mono text-sm leading-relaxed py-0.5 px-2 rounded transition-colors',
                          activeSentenceIdx === idx && 'bg-primary/10 text-primary font-medium',
                        )}
                      >
                        {s.en}
                      </p>
                    ))}
                  </div>

                  {/* Repetition counter */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Repetições alvo: {MIN_REPS}–{MAX_REPS}
                    </p>
                    <div className="flex items-center gap-3">
                      <Button size="sm" onClick={() => setPracticeCount((c) => c + 1)}>
                        <Plus className="h-4 w-4 mr-1" /> +1 repetição
                      </Button>
                      <span className="text-lg font-bold text-foreground">{practiceCount}</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2">
                    <Button variant="ghost" size="sm" onClick={() => goToStage(3)}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                    </Button>
                    <Button onClick={() => advanceStage(5)} disabled={practiceCount < MIN_REPS}>
                      Continuar <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ─── STAGE 5: Só ouvir ─── */}
              {stage === 5 && !completed && (
                <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <AudioPlayer
                    sentences={sentences}
                    playbackRate={playbackRate}
                    onPlaybackRateChange={setPlaybackRate}
                    voice={voice}
                    onVoiceChange={setVoice}
                    activeSentenceIdx={activeSentenceIdx}
                    onSentenceChange={setActiveSentenceIdx}
                  />

                  <p className="text-sm text-primary">
                    Apenas ouvir. Oculte o texto por padrão; revele somente se necessário.
                  </p>

                  {/* English text - hidden by default */}
                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-muted-foreground">Inglês</p>
                      <Button variant="outline" size="sm" onClick={() => setShowTextStage4(!showTextStage4)}>
                        {showTextStage4 ? 'Ocultar' : 'Mostrar'}
                      </Button>
                    </div>
                    <AnimatePresence>
                      {showTextStage4 && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-1 overflow-hidden">
                          {sentences.map((s, idx) => (
                            <p
                              key={s.id}
                              id={`sentence-s5-${s.id}`}
                              className={cn(
                                'font-mono text-sm leading-relaxed py-0.5 px-2 rounded transition-colors',
                                activeSentenceIdx === idx && 'bg-primary/10 text-primary font-medium',
                              )}
                            >
                              {s.en}
                            </p>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Translation - hidden by default */}
                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-muted-foreground">Tradução</p>
                      <Button variant="outline" size="sm" onClick={() => setShowTranslationStage4(!showTranslationStage4)}>
                        {showTranslationStage4 ? 'Ocultar' : 'Mostrar'}
                      </Button>
                    </div>
                    <AnimatePresence>
                      {showTranslationStage4 && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-1 overflow-hidden">
                          {sentences.map((s, idx) => (
                            <p
                              key={s.id}
                              className={cn(
                                'text-sm italic leading-relaxed py-0.5 px-2 rounded transition-colors',
                                activeSentenceIdx === idx ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'
                              )}
                            >
                              {s.pt}
                            </p>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Final assessment */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                    <div className="text-center">
                      <p className="font-semibold text-foreground">Autoavaliação final</p>
                      <p className="text-sm text-muted-foreground">Quanto você entende agora?</p>
                    </div>
                    <Slider
                      value={[finalScore]}
                      onValueChange={([v]) => setFinalScore(v)}
                      min={0}
                      max={100}
                      step={5}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                    </div>
                    <p className="text-center text-lg font-bold text-foreground">{finalScore}%</p>

                    {/* Comparison */}
                    <div className="flex items-center justify-center gap-6 p-3 rounded-lg bg-muted/50">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Antes</p>
                        <p className="text-lg font-bold text-muted-foreground">{initialScore}%</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Agora</p>
                        <p className={cn('text-lg font-bold', finalScore > initialScore ? 'text-emerald-500' : 'text-foreground')}>
                          {finalScore}%
                        </p>
                      </div>
                      {finalScore > initialScore && (
                        <Badge className="bg-emerald-500 text-white">+{finalScore - initialScore}%</Badge>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2">
                    <Button variant="ghost" size="sm" onClick={() => goToStage(4)}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                    </Button>
                    <Button onClick={handleComplete} className="bg-primary text-primary-foreground">
                      Concluir Texto
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ─── COMPLETED ─── */}
              {completed && (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6 py-8">
                  <div className="text-6xl">🎉</div>
                  <h3 className="text-2xl font-bold text-foreground">Parabéns!</h3>
                  <p className="text-muted-foreground">Você completou "{title}"</p>
                  <div className="flex items-center justify-center gap-6 p-4 rounded-xl bg-muted/50">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Compreensão Inicial</p>
                      <p className="text-xl font-bold">{initialScore}%</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Compreensão Final</p>
                      <p className="text-xl font-bold text-emerald-500">{finalScore}%</p>
                    </div>
                  </div>
                  <Button onClick={() => onOpenChange(false)}>Fechar</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Dicas Sheet (Grammar Tips) ─── */}
      <Sheet open={showDicas} onOpenChange={setShowDicas}>
        <SheetContent side="right" className="w-[360px] sm:w-[420px] overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Dicas Gramaticais
            </SheetTitle>
            <p className="text-sm text-muted-foreground">{title}</p>
          </SheetHeader>

          <div className="space-y-5 py-5">
            {tips.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sem dicas disponíveis para este texto.
              </p>
            ) : (
              tips.map((tip, i) => (
                <div key={tip.id ?? i} className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold shrink-0">
                      {tip.seq}
                    </span>
                    <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm uppercase tracking-wide">
                      {tip.title}
                    </p>
                  </div>
                  <div className="text-sm text-foreground leading-relaxed whitespace-pre-line pl-8">
                    {tip.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
