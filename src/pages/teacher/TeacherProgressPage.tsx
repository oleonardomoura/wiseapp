import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

type TeacherClass = { id: string; name: string; level: string; teacher_id: string };
type Enrollment = { student_id: string; class_id: string };
type ProfileLite = { id: string; full_name: string | null; username: string | null; xp: number | null };
type CourseProgress = { user_id: string; completed: boolean; oral_practice_completed: boolean; consolidation_completed: boolean };
type FlashProgress = { user_id: string; total_reviews: number; correct_reviews: number };
type AudioSession = { user_id: string; completed: boolean; final_score: number | null };
type UserAchievement = { user_id: string };

type StudentSummary = {
  id: string;
  name: string;
  xp: number;
  courseCompleted: number;
  courseOral: number;
  courseConsolidation: number;
  flashReviews: number;
  flashAccuracy: number;
  textsCompleted: number;
  textsAvgScore: number;
  achievements: number;
};

export default function TeacherProgressPage() {
  const { user, role } = useAuthContext();
  const isAdmin = role === 'admin';
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState<StudentSummary[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const classesQuery = supabase.from('teacher_classes').select('id, name, level, teacher_id').order('name');
      const { data: classData, error: classErr } = isAdmin
        ? await classesQuery
        : await classesQuery.eq('teacher_id', user.id);
      if (classErr) throw classErr;
      const cls = (classData ?? []) as TeacherClass[];
      setClasses(cls);

      const classId = selectedClassId || cls[0]?.id;
      if (!selectedClassId && classId) setSelectedClassId(classId);
      if (!classId) {
        setStudents([]);
        return;
      }

      const { data: enrData, error: enrErr } = await supabase
        .from('class_enrollments')
        .select('student_id, class_id')
        .eq('class_id', classId);
      if (enrErr) throw enrErr;
      const enrollments = (enrData ?? []) as Enrollment[];
      const studentIds = [...new Set(enrollments.map(e => e.student_id))];
      if (studentIds.length === 0) {
        setStudents([]);
        return;
      }

      const [{ data: profiles }, { data: courseRows }, { data: flashRows }, { data: audioRows }, { data: achievementRows }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, username, xp').in('id', studentIds),
        supabase.from('course_progress').select('user_id, completed, oral_practice_completed, consolidation_completed').in('user_id', studentIds),
        supabase.from('flashcard_progress').select('user_id, total_reviews, correct_reviews').in('user_id', studentIds),
        supabase.from('audio_sessions').select('user_id, completed, final_score').in('user_id', studentIds),
        supabase.from('user_achievements').select('user_id').in('user_id', studentIds),
      ]);

      const profileList = (profiles ?? []) as ProfileLite[];
      const courseList = (courseRows ?? []) as CourseProgress[];
      const flashList = (flashRows ?? []) as FlashProgress[];
      const audioList = (audioRows ?? []) as AudioSession[];
      const achievementList = (achievementRows ?? []) as UserAchievement[];

      const byStudent = new Map<string, StudentSummary>();
      profileList.forEach(p => {
        byStudent.set(p.id, {
          id: p.id,
          name: p.full_name || p.username || 'Aluno',
          xp: p.xp ?? 0,
          courseCompleted: 0,
          courseOral: 0,
          courseConsolidation: 0,
          flashReviews: 0,
          flashAccuracy: 0,
          textsCompleted: 0,
          textsAvgScore: 0,
          achievements: 0,
        });
      });

      courseList.forEach(c => {
        const s = byStudent.get(c.user_id);
        if (!s) return;
        if (c.completed) s.courseCompleted += 1;
        if (c.oral_practice_completed) s.courseOral += 1;
        if (c.consolidation_completed) s.courseConsolidation += 1;
      });

      const flashTotals = new Map<string, { total: number; correct: number }>();
      flashList.forEach(f => {
        const current = flashTotals.get(f.user_id) ?? { total: 0, correct: 0 };
        current.total += f.total_reviews ?? 0;
        current.correct += f.correct_reviews ?? 0;
        flashTotals.set(f.user_id, current);
      });
      flashTotals.forEach((v, userId) => {
        const s = byStudent.get(userId);
        if (!s) return;
        s.flashReviews = v.total;
        s.flashAccuracy = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0;
      });

      const audioTotals = new Map<string, { completed: number; scoreSum: number; scoreCount: number }>();
      audioList.forEach(a => {
        const current = audioTotals.get(a.user_id) ?? { completed: 0, scoreSum: 0, scoreCount: 0 };
        if (a.completed) current.completed += 1;
        if (typeof a.final_score === 'number') {
          current.scoreSum += a.final_score;
          current.scoreCount += 1;
        }
        audioTotals.set(a.user_id, current);
      });
      audioTotals.forEach((v, userId) => {
        const s = byStudent.get(userId);
        if (!s) return;
        s.textsCompleted = v.completed;
        s.textsAvgScore = v.scoreCount > 0 ? Math.round(v.scoreSum / v.scoreCount) : 0;
      });

      achievementList.forEach(a => {
        const s = byStudent.get(a.user_id);
        if (!s) return;
        s.achievements += 1;
      });

      const ordered = [...byStudent.values()].sort((a, b) => b.xp - a.xp);
      setStudents(ordered);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar progresso por turma');
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, selectedClassId]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentClass = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Progresso por Turma</h1>
          <p className="text-muted-foreground">Curso, Flashcards, Textos e Conquistas dos alunos da sua turma</p>
        </div>
        <div className="w-full sm:w-[320px]">
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma turma" />
            </SelectTrigger>
            <SelectContent>
              {classes.map(cls => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name} · {cls.level}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!currentClass && !loading ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Nenhuma turma encontrada para exibir progresso.
        </div>
      ) : (
        <>
          {currentClass && (
            <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
              <p className="font-semibold text-foreground">{currentClass.name}</p>
              <Badge>{currentClass.level}</Badge>
            </div>
          )}

          <Tabs defaultValue="course" className="space-y-4">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="course">Curso</TabsTrigger>
              <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
              <TabsTrigger value="texts">Textos</TabsTrigger>
              <TabsTrigger value="achievements">Conquistas</TabsTrigger>
            </TabsList>

            <TabsContent value="course" className="space-y-3">
              {loading ? <Skeleton className="h-48 w-full" /> : students.map(s => (
                <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Aulas concluídas: {s.courseCompleted} · Oral: {s.courseOral} · Consolidação: {s.courseConsolidation}
                  </p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="flashcards" className="space-y-3">
              {loading ? <Skeleton className="h-48 w-full" /> : students.map(s => (
                <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Revisões: {s.flashReviews} · Precisão: {s.flashAccuracy}%
                  </p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="texts" className="space-y-3">
              {loading ? <Skeleton className="h-48 w-full" /> : students.map(s => (
                <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Textos concluídos: {s.textsCompleted} · Média final: {s.textsAvgScore}%
                  </p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="achievements" className="space-y-3">
              {loading ? <Skeleton className="h-48 w-full" /> : students.map(s => (
                <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Conquistas: {s.achievements} · XP: {s.xp}
                  </p>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </>
      )}
    </motion.div>
  );
}

