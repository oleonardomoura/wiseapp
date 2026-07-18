import { useState, useEffect, useCallback } from 'react';
import { Video, Calendar, Users, Play, Clock, Eye, Bell, BellOff, Search, Filter, Radio, ChevronRight, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow, isPast, isFuture, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Label } from '@/components/ui/label';

interface LiveSession {
  class_id: string | null;
  id: string;
  title: string;
  description: string | null;
  host_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  max_participants: number | null;
  meeting_url: string | null;
  level: string | null;
  created_at: string;
  host_name?: string;
  participant_count?: number;
  is_registered?: boolean;
}

interface RecordedLive {
  id: string;
  title: string;
  description: string | null;
  host_id: string;
  video_url: string | null;
  thumbnail_url: string | null;
  duration: string | null;
  views: number | null;
  level: string | null;
  created_at: string;
  host_name?: string;
}
interface TeacherClass {
  id: string;
  name: string;
  level: string;
}

type LiveSessionRow = Omit<LiveSession, 'host_name' | 'participant_count' | 'is_registered'>;
type RecordedLiveRow = Omit<RecordedLive, 'host_name'>;
type LiveRegistrationRow = { live_session_id: string };
type ProfileLiteRow = { id: string; full_name: string | null };

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

const LEVELS = ['Todos', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function LivesPage() {
  const { user, role } = useAuthContext();
  const { toast } = useToast();
  const isTeacherMode = role === 'teacher' || role === 'admin';

  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [recordedLives, setRecordedLives] = useState<RecordedLive[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState('Todos');
  const [search, setSearch] = useState('');
  const [selectedRecording, setSelectedRecording] = useState<RecordedLive | null>(null);
  const [registeringId, setRegisteringId] = useState<string | null>(null);

  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [manageTitle, setManageTitle] = useState('');
  const [manageDescription, setManageDescription] = useState('');
  const [manageScheduledAt, setManageScheduledAt] = useState('');
  const [manageDuration, setManageDuration] = useState('60');
  const [manageMeetingUrl, setManageMeetingUrl] = useState('');
  const [manageLevel, setManageLevel] = useState('A1');
  const [manageClassId, setManageClassId] = useState('none');
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isTeacherMode) {
        const classesQuery = supabase.from('teacher_classes').select('id, name, level').order('name');
        const { data: classData, error: classErr } = role === 'admin'
          ? await classesQuery
          : await classesQuery.eq('teacher_id', user.id);
        if (classErr) throw classErr;
        const teacherClasses = (classData ?? []) as TeacherClass[];
        setClasses(teacherClasses);

        const classIds = teacherClasses.map(c => c.id);
        let sessionsQuery = supabase.from('live_sessions').select('*').order('scheduled_at', { ascending: true });
        if (role !== 'admin') {
          if (classIds.length > 0) {
            sessionsQuery = sessionsQuery.or(`host_id.eq.${user.id},class_id.in.(${classIds.join(',')})`);
          } else {
            sessionsQuery = sessionsQuery.eq('host_id', user.id);
          }
        }
        const { data: teacherSessions, error: sessionErr } = await sessionsQuery;
        if (sessionErr) throw sessionErr;

        setLiveSessions(((teacherSessions ?? []) as LiveSessionRow[]).map(s => ({
          ...s,
          participant_count: 0,
          is_registered: false,
        })));
        setRecordedLives([]);
        return;
      }

      const [sessionsRes, recordedRes, regsRes] = await Promise.all([
        supabase.from('live_sessions').select('*').order('scheduled_at', { ascending: true }),
        supabase.from('recorded_lives').select('*').order('created_at', { ascending: false }),
        supabase.from('live_registrations').select('live_session_id').eq('user_id', user.id),
      ]);

      const sessions = (sessionsRes.data ?? []) as LiveSessionRow[];
      const recordings = (recordedRes.data ?? []) as RecordedLiveRow[];
      const regs = (regsRes.data ?? []) as LiveRegistrationRow[];
      const myRegs = new Set(regs.map(r => r.live_session_id));

      // Get host profiles
      const hostIds = [...new Set([...sessions.map(s => s.host_id), ...recordings.map(r => r.host_id)])];
      const profilesRes = await supabase.from('profiles').select('id, full_name').in('id', hostIds);
      const profiles = (profilesRes.data ?? []) as ProfileLiteRow[];
      const profileMap = new Map(profiles.map(p => [p.id, p.full_name || 'Professor']));

      // Get registration counts per session
      const sessionIds = sessions.map(s => s.id);
      const regCounts = new Map<string, number>();
      if (sessionIds.length > 0) {
        const countsRes = await supabase.from('live_registrations').select('live_session_id').in('live_session_id', sessionIds);
        ((countsRes.data ?? []) as LiveRegistrationRow[]).forEach((r) => {
          regCounts.set(r.live_session_id, (regCounts.get(r.live_session_id) || 0) + 1);
        });
      }

      setLiveSessions(sessions.map(s => ({
        ...s,
        host_name: profileMap.get(s.host_id) || 'Professor',
        participant_count: regCounts.get(s.id) || 0,
        is_registered: myRegs.has(s.id),
      })));

      setRecordedLives(recordings.map(r => ({
        ...r,
        host_name: profileMap.get(r.host_id) || 'Professor',
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, isTeacherMode, role]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime subscription for live_sessions changes
  useEffect(() => {
    if (isTeacherMode) return;
    const channel = supabase
      .channel('live_sessions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, isTeacherMode]);

  const createLiveSession = async () => {
    if (!user) return;
    if (!manageTitle.trim() || !manageScheduledAt) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const payload = {
        title: manageTitle.trim(),
        description: manageDescription.trim() || null,
        host_id: user.id,
        class_id: manageClassId === 'none' ? null : manageClassId,
        scheduled_at: new Date(manageScheduledAt).toISOString(),
        duration_minutes: Number(manageDuration) || 60,
        status: 'upcoming',
        meeting_url: manageMeetingUrl.trim() || null,
        level: manageLevel,
      };
      const { error } = await supabase.from('live_sessions').insert(payload);
      if (error) throw error;
      toast({ title: 'Live agendada com sucesso' });
      setManageTitle('');
      setManageDescription('');
      setManageScheduledAt('');
      setManageDuration('60');
      setManageMeetingUrl('');
      await fetchData();
    } catch (err) {
      toast({ title: 'Erro ao agendar live', description: err instanceof Error ? err.message : 'Erro inesperado', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const deleteLiveSession = async (id: string) => {
    try {
      const { error } = await supabase.from('live_sessions').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Live removida' });
      await fetchData();
    } catch (err) {
      toast({ title: 'Erro ao remover live', description: err instanceof Error ? err.message : 'Erro inesperado', variant: 'destructive' });
    }
  };

  if (isTeacherMode) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={item}>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Lives</h1>
          <p className="text-muted-foreground">Agende lives para suas turmas</p>
        </motion.div>

        <motion.div variants={item} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={manageTitle} onChange={e => setManageTitle(e.target.value)} placeholder="Ex: Conversação A2" />
            </div>
            <div className="space-y-2">
              <Label>Turma</Label>
              <Select value={manageClassId} onValueChange={setManageClassId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem turma específica</SelectItem>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} · {c.level}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data e hora</Label>
              <Input type="datetime-local" value={manageScheduledAt} onChange={e => setManageScheduledAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Duração (min)</Label>
              <Input type="number" min={15} value={manageDuration} onChange={e => setManageDuration(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nível</Label>
              <Select value={manageLevel} onValueChange={setManageLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEVELS.filter(l => l !== 'Todos').map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Link da reunião</Label>
              <Input value={manageMeetingUrl} onChange={e => setManageMeetingUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={manageDescription} onChange={e => setManageDescription(e.target.value)} placeholder="Descrição opcional" />
          </div>
          <Button className="gradient-primary text-primary-foreground" onClick={createLiveSession} disabled={creating}>
            {creating ? 'Salvando...' : 'Agendar live'}
          </Button>
        </motion.div>

        <motion.div variants={item} className="space-y-3">
          {liveSessions.map(session => (
            <div key={session.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-foreground">{session.title}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(session.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · {session.duration_minutes} min · {session.level}
                </p>
              </div>
              <Button variant="outline" onClick={() => deleteLiveSession(session.id)}>Excluir</Button>
            </div>
          ))}
          {liveSessions.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Nenhuma live cadastrada.
            </div>
          )}
        </motion.div>
      </motion.div>
    );
  }

  const toggleRegistration = async (session: LiveSession) => {
    if (!user) return;
    setRegisteringId(session.id);
    try {
      if (session.is_registered) {
        await supabase.from('live_registrations').delete().eq('live_session_id', session.id).eq('user_id', user.id);
        toast({ title: 'Lembrete removido', description: `Você não será mais lembrado sobre "${session.title}"` });
      } else {
        await supabase.from('live_registrations').insert({ live_session_id: session.id, user_id: user.id });
        toast({ title: 'Lembrete ativado! 🔔', description: `Você será lembrado sobre "${session.title}"` });
      }
      setLiveSessions(prev => prev.map(s =>
        s.id === session.id ? { ...s, is_registered: !s.is_registered, participant_count: s.is_registered ? (s.participant_count || 1) - 1 : (s.participant_count || 0) + 1 } : s
      ));
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível atualizar o lembrete', variant: 'destructive' });
    } finally {
      setRegisteringId(null);
    }
  };

  const incrementViews = async (rec: RecordedLive) => {
    await supabase.from('recorded_lives').update({ views: (rec.views || 0) + 1 }).eq('id', rec.id);
    setRecordedLives(prev => prev.map(r => r.id === rec.id ? { ...r, views: (r.views || 0) + 1 } : r));
  };

  const getSessionStatus = (session: LiveSession) => {
    const now = new Date();
    const start = new Date(session.scheduled_at);
    const end = new Date(start.getTime() + session.duration_minutes * 60000);
    if (now >= start && now <= end) return 'live';
    if (isPast(end)) return 'ended';
    return 'upcoming';
  };

  const getTimeLabel = (session: LiveSession) => {
    const start = new Date(session.scheduled_at);
    const status = getSessionStatus(session);
    if (status === 'live') return 'Ao vivo agora!';
    if (status === 'ended') return 'Encerrada';
    const diff = differenceInMinutes(start, new Date());
    if (diff < 60) return `Começa em ${diff} min`;
    return format(start, "EEEE, dd/MM 'às' HH:mm", { locale: ptBR });
  };

  // Filter logic
  const filteredSessions = liveSessions.filter(s => {
    const status = getSessionStatus(s);
    if (status === 'ended') return false;
    if (levelFilter !== 'Todos' && s.level !== levelFilter) return false;
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const sa = getSessionStatus(a);
    const sb = getSessionStatus(b);
    if (sa === 'live' && sb !== 'live') return -1;
    if (sb === 'live' && sa !== 'live') return 1;
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
  });

  const filteredRecordings = recordedLives.filter(r => {
    if (levelFilter !== 'Todos' && r.level !== levelFilter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Lives</h1>
          <p className="text-muted-foreground">Participe de aulas ao vivo e assista gravações</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar lives..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-24">
              <Filter className="mr-1 h-3 w-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      <Tabs defaultValue="upcoming" className="space-y-6">
        <motion.div variants={item}>
          <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid">
            <TabsTrigger value="upcoming" className="gap-2">
              <Radio className="h-3.5 w-3.5" />
              Próximas Lives
            </TabsTrigger>
            <TabsTrigger value="recorded" className="gap-2">
              <Play className="h-3.5 w-3.5" />
              Gravações
            </TabsTrigger>
          </TabsList>
        </motion.div>

        {/* === UPCOMING LIVES === */}
        <TabsContent value="upcoming" className="space-y-4">
          {filteredSessions.length === 0 ? (
            <motion.div variants={item} className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <Video className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium text-muted-foreground">Nenhuma live agendada</p>
              <p className="text-sm text-muted-foreground/70">Novas lives serão publicadas em breve!</p>
            </motion.div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {filteredSessions.map((session, i) => {
                  const status = getSessionStatus(session);
                  const isLive = status === 'live';
                  return (
                    <motion.div
                      key={session.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.05 }}
                      className={`group relative overflow-hidden rounded-xl border p-5 space-y-3 transition-shadow hover:shadow-md ${
                        isLive ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card'
                      }`}
                    >
                      {isLive && (
                        <div className="absolute inset-0 animate-pulse bg-destructive/5 pointer-events-none" />
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground leading-tight">{session.title}</h3>
                          {session.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{session.description}</p>
                          )}
                        </div>
                        {isLive ? (
                          <Badge className="shrink-0 bg-destructive text-destructive-foreground animate-pulse gap-1">
                            <Radio className="h-2.5 w-2.5" />
                            AO VIVO
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="shrink-0">{session.level}</Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">{session.host_name}</p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {getTimeLabel(session)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {session.duration_minutes} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {session.participant_count}{session.max_participants ? `/${session.max_participants}` : ''}
                        </span>
                      </div>

                      <div className="flex gap-2 pt-1">
                        {isLive ? (
                          <Button
                            className="flex-1 gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                              if (session.meeting_url) {
                                window.open(session.meeting_url, '_blank');
                              } else {
                                toast({ title: 'Link indisponível', description: 'O link da live ainda não foi disponibilizado.' });
                              }
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                            Entrar agora
                          </Button>
                        ) : (
                          <Button
                            variant={session.is_registered ? 'secondary' : 'outline'}
                            className="flex-1 gap-2"
                            disabled={registeringId === session.id}
                            onClick={() => toggleRegistration(session)}
                          >
                            {session.is_registered ? (
                              <><BellOff className="h-4 w-4" /> Cancelar lembrete</>
                            ) : (
                              <><Bell className="h-4 w-4" /> Lembrar-me</>
                            )}
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* === RECORDED LIVES === */}
        <TabsContent value="recorded" className="space-y-4">
          {filteredRecordings.length === 0 ? (
            <motion.div variants={item} className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <Play className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium text-muted-foreground">Nenhuma gravação encontrada</p>
            </motion.div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRecordings.map((rec, i) => (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.04 }}
                  className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
                  onClick={() => {
                    setSelectedRecording(rec);
                    incrementViews(rec);
                  }}
                >
                  {/* Thumbnail */}
                  <div className="relative flex h-36 items-center justify-center bg-secondary">
                    {rec.thumbnail_url ? (
                      <img src={rec.thumbnail_url} alt={rec.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                        <Video className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/80 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity scale-90 group-hover:scale-100">
                        <Play className="h-5 w-5 ml-0.5" />
                      </div>
                    </div>
                    {rec.duration && (
                      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
                        <Clock className="h-3 w-3" />
                        {rec.duration}
                      </div>
                    )}
                    {rec.level && (
                      <Badge variant="outline" className="absolute top-2 left-2 bg-background/80 text-[10px]">{rec.level}</Badge>
                    )}
                  </div>

                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2">{rec.title}</h3>
                    <p className="text-xs text-muted-foreground">{rec.host_name}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDistanceToNow(new Date(rec.created_at), { addSuffix: true, locale: ptBR })}</span>
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{rec.views || 0}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Recording Player Dialog */}
      <Dialog open={!!selectedRecording} onOpenChange={open => !open && setSelectedRecording(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedRecording?.title}</DialogTitle>
            <DialogDescription>
              {selectedRecording?.host_name} · {selectedRecording?.level} · {selectedRecording?.duration}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRecording?.video_url ? (
              <div className="aspect-video rounded-lg overflow-hidden bg-black">
                <video
                  src={selectedRecording.video_url}
                  controls
                  autoPlay
                  className="h-full w-full"
                />
              </div>
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center rounded-lg bg-secondary text-center">
                <Video className="mb-3 h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">Vídeo em processamento</p>
                <p className="text-xs text-muted-foreground/70 mt-1">A gravação estará disponível em breve</p>
              </div>
            )}
            {selectedRecording?.description && (
              <p className="text-sm text-muted-foreground">{selectedRecording.description}</p>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{selectedRecording && formatDistanceToNow(new Date(selectedRecording.created_at), { addSuffix: true, locale: ptBR })}</span>
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{selectedRecording?.views || 0} visualizações</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
