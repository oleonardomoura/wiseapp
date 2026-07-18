import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Check, Loader2, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type TeacherClass = { id: string; name: string; level: string; teacher_id: string };
type ClassNotification = { id: string; class_id: string; teacher_id: string; title: string; message: string; created_at: string };
type Enrollment = { class_id: string };

export default function NotificationsPage() {
  const { user, role } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [notifications, setNotifications] = useState<ClassNotification[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const isTeacherMode = role === 'teacher' || role === 'admin';

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isTeacherMode) {
        const classesQuery = supabase.from('teacher_classes').select('id, name, level, teacher_id').order('name');
        const { data: classData, error: classErr } = role === 'admin'
          ? await classesQuery
          : await classesQuery.eq('teacher_id', user.id);
        if (classErr) throw classErr;
        const typedClasses = (classData ?? []) as TeacherClass[];
        setClasses(typedClasses);
        if (!selectedClassId && typedClasses.length > 0) setSelectedClassId(typedClasses[0].id);

        if (typedClasses.length > 0) {
          const { data: notifData, error: notifErr } = await supabase
            .from('class_notifications')
            .select('*')
            .in('class_id', typedClasses.map(c => c.id))
            .order('created_at', { ascending: false });
          if (notifErr) throw notifErr;
          setNotifications((notifData ?? []) as ClassNotification[]);
        } else {
          setNotifications([]);
        }
      } else {
        const { data: enrollData, error: enrollErr } = await supabase
          .from('class_enrollments')
          .select('class_id')
          .eq('student_id', user.id);
        if (enrollErr) throw enrollErr;
        const classIds = ((enrollData ?? []) as Enrollment[]).map(e => e.class_id);
        if (classIds.length > 0) {
          const { data: notifData, error: notifErr } = await supabase
            .from('class_notifications')
            .select('*')
            .in('class_id', classIds)
            .order('created_at', { ascending: false });
          if (notifErr) throw notifErr;
          setNotifications((notifData ?? []) as ClassNotification[]);

          const { data: classData } = await supabase
            .from('teacher_classes')
            .select('id, name, level, teacher_id')
            .in('id', classIds);
          setClasses((classData ?? []) as TeacherClass[]);
        } else {
          setNotifications([]);
          setClasses([]);
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }, [user, role, isTeacherMode, selectedClassId]);

  useEffect(() => {
    void load();
  }, [load]);

  const classNameMap = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes]);

  const sendNotification = async () => {
    if (!user) return;
    if (!selectedClassId) {
      toast.error('Selecione uma turma');
      return;
    }
    if (!title.trim() || !message.trim()) {
      toast.error('Preencha título e mensagem');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('class_notifications').insert({
        class_id: selectedClassId,
        teacher_id: user.id,
        title: title.trim(),
        message: message.trim(),
      });
      if (error) throw error;
      toast.success('Notificação enviada para a turma');
      setTitle('');
      setMessage('');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar notificação');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Notificações</h1>
          <p className="text-muted-foreground">
            {isTeacherMode ? 'Envie avisos para as turmas sob sua gestão' : 'Avisos enviados pelos seus professores'}
          </p>
        </div>
        {!isTeacherMode && (
          <Button variant="outline" size="sm">
            <Check className="mr-2 h-4 w-4" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {isTeacherMode && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Turma</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name} · {cls.level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Título</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Aula adiada para amanhã" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Input value={message} onChange={e => setMessage(e.target.value)} placeholder="Detalhes do aviso para os alunos da turma" />
          </div>
          <Button className="gradient-primary text-primary-foreground gap-2" onClick={sendNotification} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar notificação
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-border bg-card p-8 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhuma notificação encontrada.
          </div>
        ) : notifications.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass rounded-xl p-4 flex items-start gap-4 border-l-4 border-primary"
          >
            <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">{n.title}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Turma: {classNameMap.get(n.class_id) || 'Turma'} ·{' '}
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </motion.div>
        ))
        }
      </div>
    </div>
  );
}
