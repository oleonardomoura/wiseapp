import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, ChevronRight, Plus, Loader2, Trash2, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

type ClassRow = {
  id: string;
  name: string;
  level: string;
  description: string | null;
  teacher_id: string;
  created_at: string;
  updated_at: string;
};

type EnrollmentRow = {
  class_id: string;
  student_id: string;
};

const LEVEL_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function ClassesPage() {
  const { user, role } = useAuthContext();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [level, setLevel] = useState('A1');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const classesQuery = supabase.from('teacher_classes').select('*').order('created_at', { ascending: true });
      const { data: clsData, error: clsErr } = role === 'admin'
        ? await classesQuery
        : await classesQuery.eq('teacher_id', user.id);
      if (clsErr) throw clsErr;

      const typedClasses = (clsData ?? []) as ClassRow[];
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
      setEnrollments((enrData ?? []) as EnrollmentRow[]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar turmas');
    } finally {
      setLoading(false);
    }
  }, [user, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const enrollmentCountMap = useMemo(() => {
    const map = new Map<string, number>();
    enrollments.forEach(e => map.set(e.class_id, (map.get(e.class_id) ?? 0) + 1));
    return map;
  }, [enrollments]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setLevel('A1');
    setDescription('');
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (cls: ClassRow) => {
    setEditingId(cls.id);
    setName(cls.name);
    setLevel(cls.level);
    setDescription(cls.description ?? '');
    setDialogOpen(true);
  };

  const saveClass = async () => {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Informe o nome da turma');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('teacher_classes')
          .update({
            name: trimmed,
            level,
            description: description.trim() || null,
          })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Turma atualizada');
      } else {
        const { error } = await supabase
          .from('teacher_classes')
          .insert({
            name: trimmed,
            level,
            description: description.trim() || null,
            teacher_id: user.id,
          });
        if (error) throw error;
        toast.success('Turma criada');
      }

      setDialogOpen(false);
      resetForm();
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar turma');
    } finally {
      setSaving(false);
    }
  };

  const removeClass = async (cls: ClassRow) => {
    const ok = window.confirm(`Excluir a turma "${cls.name}"?`);
    if (!ok) return;

    try {
      const { error } = await supabase.from('teacher_classes').delete().eq('id', cls.id);
      if (error) throw error;
      toast.success('Turma removida');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir turma');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Turmas</h1>
          <p className="text-muted-foreground">Gerencie suas turmas e seus alunos</p>
        </div>
        <Button className="gap-2 gradient-primary text-primary-foreground" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova turma
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h3 className="font-semibold text-foreground">Nenhuma turma criada</h3>
          <p className="mt-1 text-sm text-muted-foreground">Crie sua primeira turma para começar a gestão.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md"
            >
              <Link to={`/teacher/lesson-plan/${cls.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
                  <GraduationCap className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{cls.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {enrollmentCountMap.get(cls.id) ?? 0} alunos · Nível {cls.level}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="icon" onClick={() => openEdit(cls)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => removeClass(cls)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar turma' : 'Nova turma'}</DialogTitle>
            <DialogDescription>Defina as informações principais da turma.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Turma A - Noite" />
            </div>
            <div className="space-y-2">
              <Label>Nível</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_OPTIONS.map(lvl => (
                    <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveClass} disabled={saving} className="gradient-primary text-primary-foreground">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
