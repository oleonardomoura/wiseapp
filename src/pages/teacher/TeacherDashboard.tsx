import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { StatCard } from '@/components/ui/stat-card';
import { Users, BookOpen, TrendingUp, CalendarDays } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type TeacherClass = {
  id: string;
  name: string;
};

type Enrollment = {
  class_id: string;
  student_id: string;
};

export default function TeacherDashboard() {
  const { user, role } = useAuthContext();
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const classesQuery = supabase.from('teacher_classes').select('id, name').order('name');
      const { data: classData, error: classErr } = role === 'admin'
        ? await classesQuery
        : await classesQuery.eq('teacher_id', user.id);
      if (classErr) throw classErr;
      const typedClasses = (classData ?? []) as TeacherClass[];
      setClasses(typedClasses);

      if (typedClasses.length === 0) {
        setEnrollments([]);
        return;
      }

      const { data: enrData, error: enrErr } = await supabase
        .from('class_enrollments')
        .select('class_id, student_id')
        .in('class_id', typedClasses.map(c => c.id));
      if (enrErr) throw enrErr;
      setEnrollments((enrData ?? []) as Enrollment[]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar painel do professor');
    }
  }, [user, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalStudents = useMemo(() => new Set(enrollments.map(e => e.student_id)).size, [enrollments]);
  const avgStudentsPerClass = useMemo(() => {
    if (classes.length === 0) return 0;
    return Math.round((enrollments.length / classes.length) * 10) / 10;
  }, [classes.length, enrollments.length]);

  const classCountMap = useMemo(() => {
    const m = new Map<string, number>();
    enrollments.forEach(e => m.set(e.class_id, (m.get(e.class_id) ?? 0) + 1));
    return m;
  }, [enrollments]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Painel do Professor</h1>
        <p className="text-muted-foreground">Visão geral das suas turmas e alunos</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Alunos Ativos" value={totalStudents} icon={Users} variant="primary" />
        <StatCard title="Turmas" value={classes.length} icon={BookOpen} variant="accent" />
        <StatCard title="Média alunos/turma" value={avgStudentsPerClass} icon={TrendingUp} variant="success" />
        <StatCard title="Aulas esta Semana" value={classes.length} icon={CalendarDays} variant="default" />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Turmas</h2>
        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma turma criada ainda.</p>
        ) : (
          <div className="space-y-3">
            {classes.map((cls) => (
              <div key={cls.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-4">
                <span className="font-medium text-foreground">{cls.name}</span>
                <span className="text-sm text-muted-foreground">{classCountMap.get(cls.id) ?? 0} alunos</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
