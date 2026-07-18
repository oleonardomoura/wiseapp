import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, ChevronRight, Eye, PenLine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ConsolidationExercise } from '@/data/course-exercises';
import { checkConsolidationAnswer } from '@/lib/speech-utils';

interface ConsolidationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercises: ConsolidationExercise[];
  lessonTitle: string;
  onComplete: () => void;
}

export function ConsolidationModal({ open, onOpenChange, exercises, lessonTitle, onComplete }: ConsolidationModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const currentExercise = exercises[currentIndex];
  const progress = (currentIndex / exercises.length) * 100;

  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setUserAnswer('');
      setResult(null);
      setShowSolution(false);
      setCompleted(false);
      setCorrectCount(0);
    }
  }, [open]);

  const handleCheck = () => {
    if (!userAnswer.trim()) return;
    const isCorrect = checkConsolidationAnswer(userAnswer, currentExercise.answer, currentExercise.acceptable);
    setResult(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) setCorrectCount(prev => prev + 1);
  };

  const handleNext = () => {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserAnswer('');
      setResult(null);
      setShowSolution(false);
    } else {
      setCompleted(true);
      onComplete();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-primary" />
            Consolidação
          </DialogTitle>
          <DialogDescription>{lessonTitle} — Traduza para o inglês</DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Exercício {currentIndex + 1} de {exercises.length}</span>
            <span>{Math.round(completed ? 100 : progress)}%</span>
          </div>
          <Progress value={completed ? 100 : progress} className="h-2" />
        </div>

        <AnimatePresence mode="wait">
          {completed ? (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8 space-y-4"
            >
              <span className="text-5xl">✅</span>
              <h3 className="text-xl font-bold text-foreground">Consolidação Concluída!</h3>
              <p className="text-muted-foreground">
                Você acertou {correctCount} de {exercises.length} exercícios.
              </p>
              <Badge variant={correctCount >= exercises.length * 0.7 ? "default" : "secondary"}>
                {Math.round((correctCount / exercises.length) * 100)}% de acerto
              </Badge>
              <div>
                <Button onClick={() => onOpenChange(false)} className="gradient-primary text-primary-foreground">
                  Fechar
                </Button>
              </div>
            </motion.div>
          ) : currentExercise ? (
            <motion.div
              key={currentExercise.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              {/* Prompt */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center space-y-2">
                <Badge variant="secondary" className="text-xs">Traduza para o inglês</Badge>
                <p className="text-xl font-semibold text-foreground">
                  "{currentExercise.prompt}"
                </p>
              </div>

              {/* Answer input */}
              <Textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Digite sua resposta em inglês..."
                className="min-h-[80px] text-base"
                disabled={result !== null}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && result === null) {
                    e.preventDefault();
                    handleCheck();
                  }
                }}
              />

              {/* Result feedback */}
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "rounded-xl border p-4 space-y-2",
                    result === 'correct' ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {result === 'correct' ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    <p className="font-semibold text-foreground">
                      {result === 'correct' ? 'Correto! 🎉' : 'Incorreto'}
                    </p>
                  </div>

                  {result === 'wrong' && !showSolution && (
                    <Button variant="ghost" size="sm" onClick={() => setShowSolution(true)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Ver Solução
                    </Button>
                  )}

                  {showSolution && (
                    <div className="rounded-lg bg-card border border-border p-3">
                      <p className="text-sm text-muted-foreground">Resposta correta:</p>
                      <p className="font-medium text-foreground">{currentExercise.answer}</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {result === null ? (
                  <Button
                    className="w-full gradient-primary text-primary-foreground h-12 text-base font-semibold"
                    onClick={handleCheck}
                    disabled={!userAnswer.trim()}
                  >
                    Verificar Resposta
                  </Button>
                ) : (
                  <Button
                    className="w-full gradient-primary text-primary-foreground h-12 text-base font-semibold"
                    onClick={handleNext}
                  >
                    {currentIndex < exercises.length - 1 ? (
                      <>Próximo <ChevronRight className="ml-1 h-4 w-4" /></>
                    ) : (
                      <>Concluir <CheckCircle2 className="ml-1 h-4 w-4" /></>
                    )}
                  </Button>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
