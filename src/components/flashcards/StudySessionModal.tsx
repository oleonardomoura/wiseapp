import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RotateCcw, CheckCircle2, Volume2, Loader2, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Rating } from '@/lib/srs-algorithm';
import { getIntervalDisplay, processReview, calculateNextIntervals } from '@/lib/srs-algorithm';
import { useTTS } from '@/hooks/useTTS';

interface StudyCard {
  id: string;
  front: string;
  back: string;
  easinessFactor: number;
  interval: number;
  repetitions: number;
  dueAt: string;
}

interface StudySessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: StudyCard[];
  collectionName: string;
  onCardReviewed: (cardId: string, rating: Rating, newState: { easinessFactor: number; interval: number; repetitions: number; dueAt: string }) => void;
  onSessionComplete: () => void;
}

const ratingConfig: { rating: Rating; label: string; className: string }[] = [
  { rating: 'again', label: 'Novamente', className: 'border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20' },
  { rating: 'hard', label: 'Difícil', className: 'border-warning/50 bg-warning/10 text-warning hover:bg-warning/20' },
  { rating: 'good', label: 'Bom', className: 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20' },
  { rating: 'easy', label: 'Fácil', className: 'border-green-500/50 bg-green-500/10 text-green-600 hover:bg-green-500/20' },
];

const VOICE_OPTIONS = [
  { id: 'en-US-Neural2-D', label: 'Voz do John' },
  { id: 'en-US-Neural2-F', label: 'Voz da Lily' },
];

export function StudySessionModal({ open, onOpenChange, cards, collectionName, onCardReviewed, onSessionComplete }: StudySessionModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [voice, setVoice] = useState('en-US-Neural2-D');
  const { speak, stop, isLoading: isTTSLoading, isPlaying: isSpeaking } = useTTS();

  const currentCard = cards[currentIndex];
  const progress = cards.length > 0 ? (currentIndex / cards.length) * 100 : 0;

  const nextIntervals = currentCard ? calculateNextIntervals({
    easinessFactor: currentCard.easinessFactor,
    interval: currentCard.interval,
    repetitions: currentCard.repetitions,
    dueAt: currentCard.dueAt
  }) : null;

  const handleRate = (rating: Rating) => {
    if (!currentCard) return;
    stop();

    const newState = processReview({
      easinessFactor: currentCard.easinessFactor,
      interval: currentCard.interval,
      repetitions: currentCard.repetitions,
      dueAt: currentCard.dueAt,
    }, rating);

    if (rating !== 'again') setCorrectCount(prev => prev + 1);

    onCardReviewed(currentCard.id, rating, newState);

    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setRevealed(false);
    } else {
      setCompleted(true);
      onSessionComplete();
    }
  };

  const speakWord = (text: string) => {
    speak(text, 0.85, voice);
  };

  const handleClose = () => {
    stop();
    setCurrentIndex(0);
    setRevealed(false);
    setCompleted(false);
    setCorrectCount(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-0">
        {/* Progress bar */}
        <div className="px-6 pt-10 pr-12 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground font-medium">
            <span>{collectionName}</span>
            <span>{currentIndex + (completed ? 1 : 0)}/{cards.length}</span>
          </div>
          <Progress value={completed ? 100 : progress} className="h-1.5" />
        </div>

        <AnimatePresence mode="wait">
          {completed ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-10 px-6 space-y-4"
            >
              <span className="text-5xl">🎉</span>
              <h3 className="text-xl font-bold text-foreground">Sessão Concluída!</h3>
              <p className="text-muted-foreground">
                Você revisou {cards.length} cards com {cards.length > 0 ? Math.round((correctCount / cards.length) * 100) : 0}% de acerto.
              </p>
              <div className="flex gap-3 justify-center">
                <Badge variant="default">{correctCount} acertos</Badge>
                <Badge variant="secondary">{cards.length - correctCount} erros</Badge>
              </div>
              <Button onClick={handleClose} className="gradient-primary text-primary-foreground w-full h-12">
                Fechar
              </Button>
            </motion.div>
          ) : currentCard ? (
            <motion.div
              key={currentCard.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="px-6 pb-6 space-y-5"
            >
              {/* Card front */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center min-h-[140px] flex flex-col items-center justify-center">
                <p className="text-2xl font-bold text-foreground">{currentCard.front}</p>
                <div className="flex flex-col items-center justify-center gap-1 mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(isSpeaking && "animate-pulse text-primary", "h-10 text-base font-medium")}
                    onClick={() => (isSpeaking ? stop() : speakWord(currentCard.front))}
                    disabled={isTTSLoading}
                  >
                    {isTTSLoading ? (
                      <Loader2 className="h-5 w-5 mr-1.5 animate-spin" />
                    ) : (
                      <Volume2 className="h-5 w-5 mr-1.5" />
                    )}{' '}
                    Ouvir
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1.5 p-1 px-2.5 rounded-full text-[11px] text-muted-foreground/60 hover:text-primary hover:bg-primary/5 transition-all outline-none" title="Selecionar Voz">
                        <Settings2 className="h-3.5 w-3.5" />
                        Voz
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center">
                      {VOICE_OPTIONS.map((v) => (
                        <DropdownMenuItem
                          key={v.id}
                          onClick={() => setVoice(v.id)}
                          className={cn(v.id === voice && 'bg-primary/10 text-primary font-medium')}
                        >
                          {v.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Reveal / Answer */}
              {!revealed ? (
                <Button
                  onClick={() => setRevealed(true)}
                  className="w-full h-14 text-base font-semibold gradient-primary text-primary-foreground"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Revelar Resposta
                </Button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5"
                >
                  {/* Card back */}
                  <div className="rounded-2xl border border-border bg-card p-8 text-center min-h-[100px] flex items-center justify-center">
                    <p className="text-xl font-semibold text-foreground">{currentCard.back}</p>
                  </div>

                  {/* Rating buttons */}
                  <div>
                    <p className="text-center text-sm text-muted-foreground mb-3">Como foi?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {ratingConfig.map(({ rating, label, className }) => {
                        const intervalDisplay = nextIntervals ? getIntervalDisplay(nextIntervals[rating]) : '';
                        return (
                          <Button
                            key={rating}
                            variant="outline"
                            onClick={() => handleRate(rating)}
                            className={cn("h-16 text-base font-semibold border-2 flex flex-col gap-0.5", className)}
                          >
                            <span>{label}</span>
                            <span className="text-xs opacity-80 font-normal">{intervalDisplay}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
