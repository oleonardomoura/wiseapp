import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type TeacherClass = {
  id: string;
  name: string;
  level: string;
  teacher_id: string;
};

type StudentProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
};

type EnrollmentRow = {
  id: string;
  class_id: string;
  student_id: string;
};

export default function RegisterStudentPage() {
  const { user, role } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const classesQuery = supabase.from('teacher_classes').select('id, name, level, teacher_id').order('name');
      const { data: classData, error: classErr } = role === 'admin'
        ? await classesQuery
        : await classesQuery.eq('teacher_id', user.id);
      if (classErr) throw classErr;
      const typedClasses = (classData ?? []) as TeacherClass[];
      setClasses(typedClasses);
      if (!selectedClassId && typedClasses.length > 0) setSelectedClassId(typedClasses[0].id);

      const { data: roleRows, error: roleErr } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');
      if (roleErr) throw roleErr;
      const studentIds = [...new Set((roleRows ?? []).map(r => r.user_id))];

      if (studentIds.length > 0) {
        const { data: profData, error: profErr } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', studentIds)
          .order('full_name');
        if (profErr) throw profErr;
        setStudents((profData ?? []) as StudentProfile[]);
      } else {
        setStudents([]);
      }

      if (typedClasses.length > 0) {
        const { data: enrData, error: enrErr } = await supabase
          .from('class_enrollments')
          .select('id, class_id, student_id')
          .in('class_id', typedClasses.map(c => c.id));
        if (enrErr) throw enrErr;
        setEnrollments((enrData ?? []) as EnrollmentRow[]);
      } else {
        setEnrollments([]);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [user, role, selectedClassId]);

  useEffect(() => {
    void load();
  }, [load]);

  const classEnrollmentRows = useMemo(
    () => enrollments.filter(e => e.class_id === selectedClassId),
    [enrollments, selectedClassId]
  );

  const enrolledSet = useMemo(
    () => new Set(classEnrollmentRows.map(e => e.student_id)),
    [classEnrollmentRows]
  );

  const visibleStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s => (s.full_name || '').toLowerCase().includes(q) || (s.username || '').toLowerCase().includes(q));
  }, [students, query]);

  const addByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) {
      toast.error('Selecione uma turma');
      return;
    }
    const target = email.trim().toLowerCase();
    if (!target) {
      toast.error('Digite o e-mail do aluno');
      return;
    }

    setSaving(true);
    try {
      const { data: userRow, error: findErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', target)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!userRow?.id) {
        toast.error('Aluno não encontrado. Peça para o aluno criar conta primeiro.');
        return;
      }

      const { error } = await supabase
        .from('class_enrollments')
        .insert({ class_id: selectedClassId, student_id: userRow.id });
      if (error) throw error;
      toast.success('Aluno vinculado à turma');
      setEmail('');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao vincular aluno');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnrollment = async (studentId: string) => {
    if (!selectedClassId) return;
    setSaving(true);
    try {
      if (enrolledSet.has(studentId)) {
        const enrollment = classEnrollmentRows.find(e => e.student_id === studentId);
        if (!enrollment) return;
        const { error } = await supabase.from('class_enrollments').delete().eq('id', enrollment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('class_enrollments')
          .insert({ class_id: selectedClassId, student_id: studentId });
        if (error) throw error;
      }
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar vínculo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Gestão de Alunos</h1>
        <p className="text-muted-foreground">Vincule alunos existentes às suas turmas</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <form onSubmit={addByEmail} className="space-y-4">
            <div className="space-y-2">
              <Label>Turma</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} · {cls.level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>E-mail do aluno</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email usado no cadastro"
                required
              />
            </div>
            <Button type="submit" className="w-full gap-2 gradient-primary text-primary-foreground" disabled={saving || loading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Vincular por e-mail
            </Button>
          </form>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="space-y-3">
            <Label>Busca rápida de alunos</Label>
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por nome"
            />
          </div>
          <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : visibleStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum aluno encontrado.</p>
            ) : (
              visibleStudents.map(student => (
                <div key={student.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{student.full_name || 'Aluno sem nome'}</p>
                    <p className="text-xs text-muted-foreground truncate">{student.username || student.id}</p>
                  </div>
                  <Button
                    variant={enrolledSet.has(student.id) ? 'outline' : 'default'}
                    className={enrolledSet.has(student.id) ? '' : 'gradient-primary text-primary-foreground'}
                    size="sm"
                    onClick={() => toggleEnrollment(student.id)}
                    disabled={saving || !selectedClassId}
                  >
                    {enrolledSet.has(student.id) ? (
                      <>
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Remover
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-3.5 w-3.5 mr-1" />
                        Adicionar
                      </>
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
