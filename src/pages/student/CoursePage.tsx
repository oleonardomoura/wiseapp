import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Lock, CheckCircle2, ChevronRight, Play, Clock, Mic, PenLine, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getExercisesForLesson } from '@/data/course-exercises';
import { OralPracticeModal } from '@/components/course/OralPracticeModal';
import { ConsolidationModal } from '@/components/course/ConsolidationModal';
import { toast } from 'sonner';

// ── Types ──
interface LessonState {
  id: number;
  title: string;
  completed: boolean;
  oralPracticeCompleted: boolean;
  consolidationCompleted: boolean;
}

interface ModuleState {
  id: number;
  title: string;
  level: string;
  lessons: LessonState[];
}

// ── Static module definitions ──
const moduleDefinitions: ModuleState[] = [
  {
    id: 1, title: 'Basic Greetings and Introductions', level: 'A1',
    lessons: [
      { id: 1, title: 'Hello and Basic Greetings', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
      { id: 2, title: 'Introducing Yourself', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
      { id: 3, title: 'Asking About Others', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
      { id: 4, title: 'Common Courtesy Phrases', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
    ],
  },
  {
    id: 2, title: 'Everyday Vocabulary', level: 'A1',
    lessons: [
      { id: 5, title: 'Numbers and Counting', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
      { id: 6, title: 'Days, Months & Seasons', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
      { id: 7, title: 'Colors and Shapes', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
      { id: 8, title: 'Food and Drinks', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
    ],
  },
  {
    id: 3, title: 'Essential Grammar', level: 'A2',
    lessons: [
      { id: 9, title: 'Present Simple Tense', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
      { id: 10, title: 'Articles: A, An, The', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
      { id: 11, title: 'Plural Nouns', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
      { id: 12, title: 'Subject Pronouns', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
      { id: 13, title: 'Simple Questions', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
    ],
  },
  {
    id: 4, title: 'Conversation Skills', level: 'A2',
    lessons: [
      { id: 14, title: 'At the Restaurant', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
      { id: 15, title: 'Asking for Directions', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
      { id: 16, title: 'Shopping Dialogues', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
      { id: 17, title: 'Making Plans', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
    ],
  },
  {
    id: 5, title: 'Reading & Comprehension', level: 'B1',
    lessons: [
      { id: 18, title: 'Short Stories', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
      { id: 19, title: 'News Articles', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
      { id: 20, title: 'Email Writing', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
      { id: 21, title: 'Blog Posts', completed: false, oralPracticeCompleted: false, consolidationCompleted: false },
    ],
  },
];

// ── Helpers ──
function getStorageKey(userId: string) {
  return `course_progress_${userId}`;
}

function deepCloneModules(modules: ModuleState[]): ModuleState[] {
  return JSON.parse(JSON.stringify(modules));
}

function getLessonStatus(lesson: LessonState, index: number, lessons: LessonState[]): 'completed' | 'active' | 'locked' {
  if (lesson.completed) return 'completed';
  if (index === 0) return 'active';
  if (lessons[index - 1].completed) return 'active';
  return 'locked';
}

function getModuleProgress(mod: ModuleState): number {
  const completed = mod.lessons.filter(l => l.completed).length;
  return Math.round((completed / mod.lessons.length) * 100);
}

function isModuleLocked(mod: ModuleState, allModules: ModuleState[]): boolean {
  const idx = allModules.findIndex(m => m.id === mod.id);
  if (idx === 0) return false;
  return getModuleProgress(allModules[idx - 1]) < 100;
}

// ── Component ──
export default function CoursePage() {
  const { profile, user } = useAuthContext();
  const [modules, setModules] = useState<ModuleState[]>(() => deepCloneModules(moduleDefinitions));
  const [selectedModuleId, setSelectedModuleId] = useState(1);
  const [oralModalOpen, setOralModalOpen] = useState(false);
  const [consolidationModalOpen, setConsolidationModalOpen] = useState(false);
  const [activeLessonId, setActiveLessonId] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const selectedModule = modules.find(m => m.id === selectedModuleId)!;
  const moduleProgress = getModuleProgress(selectedModule);

  // Find the current active lesson in selected module
  const currentActiveLessonIndex = selectedModule.lessons.findIndex((l, i) => getLessonStatus(l, i, selectedModule.lessons) === 'active');
  const currentActiveLesson = currentActiveLessonIndex >= 0 ? selectedModule.lessons[currentActiveLessonIndex] : null;

  // ── Load progress from localStorage + Supabase ──
  useEffect(() => {
    if (!user?.id) return;

    // Load from localStorage first (fast)
    const stored = localStorage.getItem(getStorageKey(user.id));
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ModuleState[];
        setModules(parsed);
      } catch { /* ignore */ }
    }

    // Then sync from Supabase
    (async () => {
      const { data } = await supabase
        .from('course_progress')
        .select('*')
        .eq('user_id', user.id);

      if (data && data.length > 0) {
        setModules(prev => {
          const updated = deepCloneModules(prev);
          for (const row of data) {
            for (const mod of updated) {
              const lesson = mod.lessons.find(l => l.id === row.lesson_id);
              if (lesson) {
                lesson.oralPracticeCompleted = row.oral_practice_completed;
                lesson.consolidationCompleted = row.consolidation_completed;
                lesson.completed = row.completed;
              }
            }
          }
          localStorage.setItem(getStorageKey(user.id), JSON.stringify(updated));
          return updated;
        });
      }
    })();
  }, [user?.id]);

  // ── Persist progress ──
  const persistProgress = useCallback(async (updatedModules: ModuleState[]) => {
    if (!user?.id) return;
    localStorage.setItem(getStorageKey(user.id), JSON.stringify(updatedModules));

    // Upsert all lessons that have any progress
    for (const mod of updatedModules) {
      for (const lesson of mod.lessons) {
        if (lesson.oralPracticeCompleted || lesson.consolidationCompleted || lesson.completed) {
          await supabase.from('course_progress').upsert(
            {
              user_id: user.id,
              module_id: mod.id,
              lesson_id: lesson.id,
              oral_practice_completed: lesson.oralPracticeCompleted,
              consolidation_completed: lesson.consolidationCompleted,
              completed: lesson.completed,
            },
            { onConflict: 'user_id,lesson_id' }
          );
        }
      }
    }
  }, [user?.id]);

  // ── Activity completion handlers ──
  const handleOralComplete = useCallback(() => {
    setModules(prev => {
      const updated = deepCloneModules(prev);
      for (const mod of updated) {
        const lesson = mod.lessons.find(l => l.id === activeLessonId);
        if (lesson) {
          lesson.oralPracticeCompleted = true;
          // Check if both activities are done
          if (lesson.oralPracticeCompleted && lesson.consolidationCompleted) {
            lesson.completed = true;
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
            toast.success('🎉 Lição concluída! Parabéns!');
          }
          break;
        }
      }
      persistProgress(updated);
      return updated;
    });
  }, [activeLessonId, persistProgress]);

  const handleConsolidationComplete = useCallback(() => {
    setModules(prev => {
      const updated = deepCloneModules(prev);
      for (const mod of updated) {
        const lesson = mod.lessons.find(l => l.id === activeLessonId);
        if (lesson) {
          lesson.consolidationCompleted = true;
          if (lesson.oralPracticeCompleted && lesson.consolidationCompleted) {
            lesson.completed = true;
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
            toast.success('🎉 Lição concluída! Parabéns!');
          }
          break;
        }
      }
      persistProgress(updated);
      return updated;
    });
  }, [activeLessonId, persistProgress]);

  const openOralPractice = (lessonId: number) => {
    setActiveLessonId(lessonId);
    setOralModalOpen(true);
  };

  const openConsolidation = (lessonId: number) => {
    setActiveLessonId(lessonId);
    setConsolidationModalOpen(true);
  };

  const exercises = activeLessonId ? getExercisesForLesson(activeLessonId) : null;
  const activeLessonData = activeLessonId ? modules.flatMap(m => m.lessons).find(l => l.id === activeLessonId) : null;

  return (
    <>
      {/* Confetti overlay */}
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1.2 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <PartyPopper className="h-24 w-24 text-primary" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="font-semibold">{selectedModule.level}</Badge>
            <span>•</span>
            <span>{profile?.cefr_level || 'A1'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {selectedModule.title}
          </h1>
          <div className="mx-auto max-w-md space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso do Módulo</span>
              <span className="font-semibold text-foreground">{moduleProgress}%</span>
            </div>
            <Progress value={moduleProgress} className="h-2.5" />
          </div>
        </div>

        {/* Current lesson card */}
        {currentActiveLesson && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl border border-border p-6 space-y-5"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Aula Atual: {currentActiveLesson.title}</span>
              </div>
              <Badge variant="secondary" className="text-xs">Em andamento</Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Oral Practice */}
              <div className={cn(
                "rounded-xl border p-4 space-y-3",
                currentActiveLesson.oralPracticeCompleted
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-card"
              )}>
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-foreground">Prática Oral</h4>
                  {currentActiveLesson.oralPracticeCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Mic className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">Pratique a pronúncia das frases principais desta aula</p>
                <Button
                  size="sm"
                  className={cn(
                    "w-full",
                    currentActiveLesson.oralPracticeCompleted
                      ? ""
                      : "gradient-primary text-primary-foreground"
                  )}
                  variant={currentActiveLesson.oralPracticeCompleted ? "outline" : "default"}
                  onClick={() => openOralPractice(currentActiveLesson.id)}
                >
                  {currentActiveLesson.oralPracticeCompleted ? (
                    <><CheckCircle2 className="mr-2 h-3 w-3" /> Concluído — Revisar</>
                  ) : (
                    <><Play className="mr-2 h-3 w-3" /> Iniciar Prática</>
                  )}
                </Button>
              </div>

              {/* Consolidation */}
              <div className={cn(
                "rounded-xl border p-4 space-y-3",
                currentActiveLesson.consolidationCompleted
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-card"
              )}>
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-foreground">Consolidação</h4>
                  {currentActiveLesson.consolidationCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <PenLine className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">Exercícios de tradução e aplicação prática</p>
                <Button
                  size="sm"
                  className={cn(
                    "w-full",
                    currentActiveLesson.consolidationCompleted
                      ? ""
                      : "gradient-primary text-primary-foreground"
                  )}
                  variant={currentActiveLesson.consolidationCompleted ? "outline" : "default"}
                  onClick={() => openConsolidation(currentActiveLesson.id)}
                >
                  {currentActiveLesson.consolidationCompleted ? (
                    <><CheckCircle2 className="mr-2 h-3 w-3" /> Concluído — Revisar</>
                  ) : (
                    <>Iniciar Consolidação</>
                  )}
                </Button>
              </div>
            </div>

            {/* Completion hint */}
            {(currentActiveLesson.oralPracticeCompleted || currentActiveLesson.consolidationCompleted) &&
              !currentActiveLesson.completed && (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-center">
                  <p className="text-sm text-foreground">
                    Complete <strong>ambas</strong> as atividades para desbloquear a próxima lição!
                  </p>
                </div>
              )}
          </motion.div>
        )}

        {/* Lessons list */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Aulas do Módulo</h2>
          <div className="space-y-2">
            {selectedModule.lessons.map((lesson, i) => {
              const status = getLessonStatus(lesson, i, selectedModule.lessons);
              const isCompleted = status === 'completed';
              const isActive = status === 'active';
              const isLocked = status === 'locked';

              return (
                <motion.div
                  key={lesson.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className={cn(
                    "flex items-center gap-4 rounded-xl border p-4 transition-all",
                    isActive && "border-primary/30 bg-primary/5 shadow-sm",
                    isCompleted && "border-border bg-card",
                    isLocked && "border-border bg-card opacity-50"
                  )}
                >
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    isCompleted && "bg-primary/10 text-primary",
                    isActive && "gradient-primary text-primary-foreground",
                    isLocked && "bg-secondary text-muted-foreground"
                  )}>
                    {isCompleted ? <CheckCircle2 className="h-4 w-4" /> :
                      isLocked ? <Lock className="h-3 w-3" /> : lesson.id}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className={cn("font-medium", isLocked ? "text-muted-foreground" : "text-foreground")}>
                      {lesson.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">
                        {isCompleted ? 'Concluída' : isActive ? 'Em andamento' : 'Bloqueada'}
                      </p>
                      {(isCompleted || isActive) && (
                        <div className="flex gap-1">
                          {lesson.oralPracticeCompleted && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                              <Mic className="h-2.5 w-2.5 mr-0.5" /> Oral
                            </Badge>
                          )}
                          {lesson.consolidationCompleted && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                              <PenLine className="h-2.5 w-2.5 mr-0.5" /> Escrita
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {isActive && (
                    <Badge variant="default" className="text-[10px] shrink-0">Atual</Badge>
                  )}
                  {isCompleted && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Module selector */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Todos os Módulos</h2>
          <div className="space-y-2">
            {modules.map((mod, i) => {
              const locked = isModuleLocked(mod, modules);
              const isSelected = mod.id === selectedModuleId;
              const progress = getModuleProgress(mod);
              const completedCount = mod.lessons.filter(l => l.completed).length;

              return (
                <motion.button
                  key={mod.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  onClick={() => !locked && setSelectedModuleId(mod.id)}
                  disabled={locked}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all",
                    isSelected && "border-primary/40 bg-primary/5 shadow-sm",
                    !isSelected && !locked && "border-border bg-card hover:bg-secondary/50",
                    locked && "border-border bg-card opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                    progress === 100 && "bg-primary/10 text-primary",
                    progress > 0 && progress < 100 && "gradient-primary text-primary-foreground",
                    progress === 0 && !locked && "bg-secondary text-muted-foreground",
                    locked && "bg-secondary text-muted-foreground"
                  )}>
                    {locked ? <Lock className="h-4 w-4" /> : progress === 100 ? <CheckCircle2 className="h-4 w-4" /> : mod.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={cn("font-semibold truncate", locked ? "text-muted-foreground" : "text-foreground")}>
                        {mod.title}
                      </h3>
                      <Badge variant="outline" className="text-[10px] shrink-0">{mod.level}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {completedCount}/{mod.lessons.length} aulas • {progress}% completo
                    </p>
                  </div>
                  {!locked && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Modals */}
      {exercises && activeLessonData && (
        <>
          <OralPracticeModal
            open={oralModalOpen}
            onOpenChange={setOralModalOpen}
            phrases={exercises.oralPhrases}
            lessonTitle={activeLessonData.title}
            onComplete={handleOralComplete}
          />
          <ConsolidationModal
            open={consolidationModalOpen}
            onOpenChange={setConsolidationModalOpen}
            exercises={exercises.consolidation}
            lessonTitle={activeLessonData.title}
            onComplete={handleConsolidationComplete}
          />
        </>
      )}
    </>
  );
}
