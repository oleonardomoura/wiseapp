import { useState, useEffect, useCallback } from 'react';
import { Users, Calendar, Clock, Video, LogIn, LogOut, Search, Filter, UserCheck, ExternalLink, CalendarPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';

interface ConversationGroup {
  class_id: string | null;
  id: string;
  name: string;
  description: string | null;
  level: string;
  max_members: number | null;
  day_of_week: string;
  time_slot: string;
  teacher_id: string | null;
  meeting_url: string | null;
  next_session_at: string | null;
  member_count: number;
  is_member: boolean;
  teacher_name?: string;
  members: { id: string; full_name: string; avatar_url: string | null }[];
}

type ConversationGroupRow = Omit<ConversationGroup, 'member_count' | 'is_member' | 'teacher_name' | 'members'>;
type GroupMembershipRow = { group_id: string; user_id: string };
type GroupMembershipIdRow = { group_id: string };
type ProfileRow = { id: string; full_name: string | null; avatar_url: string | null };
type TeacherClass = { id: string; name: string; level: string };

const LEVELS = ['Todos', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const DAYS_ORDER = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function ConversationGroupsPage() {
  const { user, role } = useAuthContext();
  const { toast } = useToast();
  const isTeacherMode = role === 'teacher' || role === 'admin';

  const [groups, setGroups] = useState<ConversationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState('Todos');
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<ConversationGroup | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLevel, setNewLevel] = useState('A1');
  const [newDay, setNewDay] = useState('Quarta-feira');
  const [newTime, setNewTime] = useState('19:00');
  const [newMeetingUrl, setNewMeetingUrl] = useState('');
  const [newMaxMembers, setNewMaxMembers] = useState('30');
  const [newClassId, setNewClassId] = useState('none');

  const fetchGroups = useCallback(async () => {
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

        let groupsQuery = supabase.from('conversation_groups').select('*').order('created_at', { ascending: false });
        if (role !== 'admin') {
          const classIds = teacherClasses.map(c => c.id);
          if (classIds.length > 0) {
            groupsQuery = groupsQuery.or(`teacher_id.eq.${user.id},class_id.in.(${classIds.join(',')})`);
          } else {
            groupsQuery = groupsQuery.eq('teacher_id', user.id);
          }
        }
        const { data: groupsData, error: groupsErr } = await groupsQuery;
        if (groupsErr) throw groupsErr;
        const teacherGroups = (groupsData ?? []) as ConversationGroupRow[];
        setGroups(
          teacherGroups.map(g => ({
            ...g,
            member_count: 0,
            is_member: false,
            teacher_name: undefined,
            members: [],
          }))
        );
        return;
      }

      const [groupsRes, membershipsRes, myMembershipsRes] = await Promise.all([
        supabase.from('conversation_groups').select('*').order('created_at'),
        supabase.from('group_memberships').select('group_id, user_id'),
        supabase.from('group_memberships').select('group_id').eq('user_id', user.id),
      ]);

      const allGroups = (groupsRes.data ?? []) as ConversationGroupRow[];
      const allMemberships = (membershipsRes.data ?? []) as GroupMembershipRow[];
      const myMemberships = (myMembershipsRes.data ?? []) as GroupMembershipIdRow[];
      const myGroupIds = new Set(myMemberships.map(m => m.group_id));

      // Member counts & member user_ids per group
      const memberMap = new Map<string, string[]>();
      allMemberships.forEach((m) => {
        if (!memberMap.has(m.group_id)) memberMap.set(m.group_id, []);
        memberMap.get(m.group_id)!.push(m.user_id);
      });

      // Get all member + teacher profiles
      const teacherIds = allGroups.map(g => g.teacher_id).filter((id): id is string => Boolean(id));
      const allUserIds = [...new Set([...allMemberships.map(m => m.user_id), ...teacherIds])];

      const profileMap = new Map<string, { full_name: string; avatar_url: string | null }>();
      if (allUserIds.length > 0) {
        const profilesRes = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', allUserIds);
        (profilesRes.data ?? []).forEach((p) => {
          const prof = p as ProfileRow;
          profileMap.set(prof.id, { full_name: prof.full_name || 'Aluno', avatar_url: prof.avatar_url });
        });
      }

      setGroups(allGroups.map(g => ({
        id: g.id,
        class_id: g.class_id,
        name: g.name,
        description: g.description,
        level: g.level,
        max_members: g.max_members,
        day_of_week: g.day_of_week,
        time_slot: g.time_slot,
        teacher_id: g.teacher_id,
        meeting_url: g.meeting_url,
        next_session_at: g.next_session_at,
        member_count: memberMap.get(g.id)?.length || 0,
        is_member: myGroupIds.has(g.id),
        teacher_name: g.teacher_id ? profileMap.get(g.teacher_id)?.full_name || 'Professor' : undefined,
        members: (memberMap.get(g.id) || []).map(uid => ({
          id: uid,
          full_name: profileMap.get(uid)?.full_name || 'Aluno',
          avatar_url: profileMap.get(uid)?.avatar_url || null,
        })),
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, isTeacherMode, role]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const joinGroup = async (group: ConversationGroup) => {
    if (!user) return;
    setJoiningId(group.id);
    try {
      const { error } = await supabase.from('group_memberships').insert({ group_id: group.id, user_id: user.id });
      if (error) throw error;
      toast({ title: 'Inscrição confirmada! 🎉', description: `Você agora faz parte do grupo "${group.name}"` });
      await fetchGroups();
      // Update selected group if open
      if (selectedGroup?.id === group.id) {
        setSelectedGroup(prev => prev ? { ...prev, is_member: true, member_count: prev.member_count + 1 } : null);
      }
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível entrar no grupo', variant: 'destructive' });
    } finally {
      setJoiningId(null);
    }
  };

  const leaveGroup = async (group: ConversationGroup) => {
    if (!user) return;
    setJoiningId(group.id);
    try {
      await supabase.from('group_memberships').delete().eq('group_id', group.id).eq('user_id', user.id);
      toast({ title: 'Inscrição cancelada', description: `Você saiu do grupo "${group.name}"` });
      await fetchGroups();
      if (selectedGroup?.id === group.id) {
        setSelectedGroup(null);
      }
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível sair do grupo', variant: 'destructive' });
    } finally {
      setJoiningId(null);
    }
  };

  const filteredGroups = groups.filter(g => {
    if (levelFilter !== 'Todos' && g.level !== levelFilter) return false;
    if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => DAYS_ORDER.indexOf(a.day_of_week) - DAYS_ORDER.indexOf(b.day_of_week));

  const myGroups = filteredGroups.filter(g => g.is_member);
  const availableGroups = filteredGroups.filter(g => !g.is_member);

  const createGroup = async () => {
    if (!user) return;
    if (!newName.trim()) {
      toast({ title: 'Informe o nome do grupo', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const payload = {
        name: newName.trim(),
        description: newDescription.trim() || null,
        level: newLevel,
        day_of_week: newDay,
        time_slot: newTime,
        meeting_url: newMeetingUrl.trim() || null,
        max_members: Number(newMaxMembers) || 30,
        created_by: user.id,
        teacher_id: user.id,
        class_id: newClassId === 'none' ? null : newClassId,
      };
      const { error } = await supabase.from('conversation_groups').insert(payload);
      if (error) throw error;
      toast({ title: 'Grupo criado com sucesso' });
      setNewName('');
      setNewDescription('');
      setNewMeetingUrl('');
      setNewMaxMembers('30');
      await fetchGroups();
    } catch (err) {
      toast({ title: 'Erro ao criar grupo', description: err instanceof Error ? err.message : 'Erro inesperado', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const removeGroup = async (groupId: string) => {
    try {
      const { error } = await supabase.from('conversation_groups').delete().eq('id', groupId);
      if (error) throw error;
      toast({ title: 'Grupo removido' });
      await fetchGroups();
    } catch (err) {
      toast({ title: 'Erro ao remover grupo', description: err instanceof Error ? err.message : 'Erro inesperado', variant: 'destructive' });
    }
  };

  if (isTeacherMode) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={item}>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Grupos de Conversação</h1>
          <p className="text-muted-foreground">Crie e gerencie grupos de conversação das suas turmas</p>
        </motion.div>

        <motion.div variants={item} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Debate B1" />
            </div>
            <div className="space-y-2">
              <Label>Turma</Label>
              <Select value={newClassId} onValueChange={setNewClassId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem turma específica</SelectItem>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} · {c.level}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nível</Label>
              <Select value={newLevel} onValueChange={setNewLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEVELS.filter(l => l !== 'Todos').map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dia</Label>
              <Select value={newDay} onValueChange={setNewDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DAYS_ORDER.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Máximo de membros</Label>
              <Input type="number" min={2} value={newMaxMembers} onChange={e => setNewMaxMembers(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Tema e objetivo do grupo" />
          </div>
          <div className="space-y-2">
            <Label>Link da reunião</Label>
            <Input value={newMeetingUrl} onChange={e => setNewMeetingUrl(e.target.value)} placeholder="https://..." />
          </div>
          <Button className="gradient-primary text-primary-foreground" onClick={createGroup} disabled={creating}>
            {creating ? 'Salvando...' : 'Criar grupo'}
          </Button>
        </motion.div>

        <motion.div variants={item} className="space-y-3">
          {groups.map(group => (
            <div key={group.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-foreground">{group.name}</p>
                <p className="text-sm text-muted-foreground">{group.day_of_week} às {group.time_slot} · {group.level}</p>
              </div>
              <Button variant="outline" onClick={() => removeGroup(group.id)}>Excluir</Button>
            </div>
          ))}
          {groups.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Nenhum grupo cadastrado.
            </div>
          )}
        </motion.div>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-4 sm:grid-cols-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}</div>
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Grupos de Conversação</h1>
          <p className="text-muted-foreground">Encontros semanais por vídeo com professor para praticar inglês</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar grupos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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

      {/* My Groups */}
      {myGroups.length > 0 && (
        <motion.div variants={item} className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <UserCheck className="h-4 w-4" /> Meus Grupos ({myGroups.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {myGroups.map((group, i) => (
              <GroupCard key={group.id} group={group} index={i} joiningId={joiningId} onLeave={leaveGroup} onJoin={joinGroup} onSelect={setSelectedGroup} isMember />
            ))}
          </div>
        </motion.div>
      )}

      {/* Available Groups */}
      <motion.div variants={item} className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <Users className="h-4 w-4" /> {myGroups.length > 0 ? 'Outros Grupos Disponíveis' : 'Grupos Disponíveis'}
        </h2>
        {availableGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <Video className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium text-muted-foreground">
              {groups.length === 0 ? 'Nenhum grupo disponível no momento' : 'Você já está em todos os grupos!'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {availableGroups.map((group, i) => (
              <GroupCard key={group.id} group={group} index={i} joiningId={joiningId} onLeave={leaveGroup} onJoin={joinGroup} onSelect={setSelectedGroup} isMember={false} />
            ))}
          </div>
        )}
      </motion.div>

      {/* Group Detail Dialog */}
      <Dialog open={!!selectedGroup} onOpenChange={open => !open && setSelectedGroup(null)}>
        {selectedGroup && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedGroup.name}
              </DialogTitle>
              <DialogDescription>{selectedGroup.description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Schedule info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 rounded-lg bg-secondary p-3">
                  <Calendar className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Dia</p>
                    <p className="text-sm font-medium text-foreground">{selectedGroup.day_of_week}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-secondary p-3">
                  <Clock className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Horário</p>
                    <p className="text-sm font-medium text-foreground">{selectedGroup.time_slot}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Badge variant="outline">{selectedGroup.level}</Badge>
                <span className="text-muted-foreground">
                  {selectedGroup.member_count}/5 membros
                </span>
                {selectedGroup.teacher_name && (
                  <span className="text-muted-foreground">· Prof. {selectedGroup.teacher_name}</span>
                )}
              </div>

              <Separator />

              {/* Members */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Membros</p>
                {selectedGroup.members.length === 0 ? (
                  <p className="text-sm text-muted-foreground/60 italic">Nenhum membro ainda</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedGroup.members.map(m => (
                      <div key={m.id} className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={m.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px]">{m.full_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-foreground">{m.full_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Google Calendar */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  const dayMap: Record<string, string> = {
                    'Segunda-feira': 'MO', 'Terça-feira': 'TU', 'Quarta-feira': 'WE',
                    'Quinta-feira': 'TH', 'Sexta-feira': 'FR', 'Sábado': 'SA', 'Domingo': 'SU',
                  };
                  const rruleDay = dayMap[selectedGroup.day_of_week] || 'WE';
                  const [h, m] = selectedGroup.time_slot.split(':').map(Number);
                  // Build next occurrence date
                  const now = new Date();
                  const daysOfWeek = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
                  const targetDay = daysOfWeek.indexOf(selectedGroup.day_of_week);
                  const currentDay = now.getDay();
                  let daysUntil = targetDay - currentDay;
                  if (daysUntil <= 0) daysUntil += 7;
                  const startDate = new Date(now);
                  startDate.setDate(now.getDate() + daysUntil);
                  startDate.setHours(h, m, 0, 0);
                  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1h duration
                  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
                  const params = new URLSearchParams({
                    action: 'TEMPLATE',
                    text: `Conversação: ${selectedGroup.name}`,
                    dates: `${fmt(startDate)}/${fmt(endDate)}`,
                    details: `Grupo de conversação em inglês - Nível ${selectedGroup.level}\n${selectedGroup.description || ''}`,
                    recur: `RRULE:FREQ=WEEKLY;BYDAY=${rruleDay}`,
                  });
                  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank');
                }}
              >
                <CalendarPlus className="h-4 w-4" />
                Salvar no Google Agenda
              </Button>

              <Separator />

              {/* Action */}
              {selectedGroup.is_member ? (
                <div className="space-y-2">
                  {selectedGroup.meeting_url && (
                    <Button className="w-full gap-2" onClick={() => window.open(selectedGroup.meeting_url!, '_blank')}>
                      <ExternalLink className="h-4 w-4" />
                      Entrar na Videochamada
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full gap-2 text-destructive hover:text-destructive"
                    disabled={joiningId === selectedGroup.id}
                    onClick={() => leaveGroup(selectedGroup)}
                  >
                    <LogOut className="h-4 w-4" />
                    Sair do Grupo
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full gap-2 gradient-primary text-primary-foreground"
                  disabled={joiningId === selectedGroup.id}
                  onClick={() => joinGroup(selectedGroup)}
                >
                  <LogIn className="h-4 w-4" />
                  Inscrever-se
                </Button>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </motion.div>
  );
}

function GroupCard({
  group, index, joiningId, onJoin, onLeave, onSelect, isMember,
}: {
  group: ConversationGroup; index: number; joiningId: string | null;
  onJoin: (g: ConversationGroup) => void; onLeave: (g: ConversationGroup) => void;
  onSelect: (g: ConversationGroup) => void; isMember: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`group relative overflow-hidden rounded-xl border p-5 space-y-3 transition-shadow hover:shadow-md cursor-pointer ${
        isMember ? 'border-primary/20 bg-primary/[0.02]' : 'border-border bg-card'
      }`}
      onClick={() => onSelect(group)}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-foreground leading-tight">{group.name}</h3>
          {group.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{group.description}</p>
          )}
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">{group.level}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {group.day_of_week}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {group.time_slot}
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {group.member_count}/5
        </span>
      </div>

      {/* Member avatars */}
      {group.members.length > 0 && (
        <div className="flex items-center gap-1">
          <div className="flex -space-x-2">
            {group.members.slice(0, 5).map(m => (
              <Avatar key={m.id} className="h-6 w-6 border-2 border-background">
                <AvatarImage src={m.avatar_url || undefined} />
                <AvatarFallback className="text-[8px]">{m.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
            ))}
          </div>
          {group.members.length > 5 && (
            <span className="text-[10px] text-muted-foreground ml-1">+{group.members.length - 5}</span>
          )}
        </div>
      )}

      <div onClick={e => e.stopPropagation()}>
        {isMember ? (
          <div className="flex gap-2">
            {group.meeting_url && (
              <Button size="sm" className="flex-1 gap-1" onClick={() => window.open(group.meeting_url!, '_blank')}>
                <Video className="h-3.5 w-3.5" />
                Entrar
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-destructive hover:text-destructive"
              disabled={joiningId === group.id}
              onClick={() => onLeave(group)}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            className="w-full gap-1 gradient-primary text-primary-foreground"
            disabled={joiningId === group.id}
            onClick={() => onJoin(group)}
          >
            <LogIn className="h-3.5 w-3.5" />
            Inscrever-se
          </Button>
        )}
      </div>
    </motion.div>
  );
}
