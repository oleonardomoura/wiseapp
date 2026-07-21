import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Search, ShieldAlert, Undo2, UserPlus, RefreshCw, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import type { AppRole, ApprovalStatus } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  approval_status: ApprovalStatus;
  role: AppRole;
};

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: 'student', label: 'Aluno' },
  { value: 'teacher', label: 'Professor' },
  { value: 'admin', label: 'Admin' },
];

const STATUS_OPTIONS: { value: ApprovalStatus; label: string }[] = [
  { value: 'pending', label: 'Pendente' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'rejected', label: 'Rejeitado' },
];

function statusBadgeVariant(status: ApprovalStatus): 'default' | 'outline' | 'destructive' {
  if (status === 'approved') return 'default';
  if (status === 'rejected') return 'destructive';
  return 'outline';
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuthContext();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('student');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_users');
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setUsers((data ?? []) as UserRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pendingUsers = useMemo(() => users.filter(u => u.approval_status === 'pending'), [users]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter(u =>
      (u.full_name ?? '').toLowerCase().includes(query) ||
      (u.username ?? '').toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const setApprovalStatus = async (u: UserRow, status: ApprovalStatus) => {
    setUpdatingId(u.id);
    try {
      const { error } = await supabase.from('profiles').update({ approval_status: status }).eq('id', u.id);
      if (error) throw error;
      toast.success(
        status === 'approved' ? `${u.full_name || u.email} aprovado` :
        status === 'rejected' ? `${u.full_name || u.email} rejeitado` :
        `${u.full_name || u.email} voltou para pendente`
      );
      window.dispatchEvent(new CustomEvent('wisy:usersUpdated'));
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar aprovação');
    } finally {
      setUpdatingId(null);
    }
  };

  const changeRole = async (u: UserRow, role: AppRole) => {
    if (role === u.role) return;
    if (u.id === currentUser?.id && role !== 'admin') {
      const ok = window.confirm('Você está removendo seu próprio acesso de Admin. Você perderá acesso a esta tela imediatamente. Continuar?');
      if (!ok) return;
    }
    setUpdatingId(u.id);
    try {
      const { error: delErr } = await supabase.from('user_roles').delete().eq('user_id', u.id);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from('user_roles').insert({ user_id: u.id, role });
      if (insErr) throw insErr;
      toast.success(`Papel de ${u.full_name || u.email} alterado para ${ROLE_OPTIONS.find(r => r.value === role)?.label}`);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar papel');
    } finally {
      setUpdatingId(null);
    }
  };

  const openCreateDialog = () => {
    setNewName(''); setNewEmail(''); setNewPassword(generatePassword()); setNewRole('student');
    setCreateDialogOpen(true);
  };

  const createUser = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      toast.error('Preencha nome, e-mail e senha');
      return;
    }
    setCreating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessão expirada, faça login novamente');

      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { email: newEmail.trim(), password: newPassword, full_name: newName.trim(), role: newRole },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Usuário ${newName.trim()} criado como ${ROLE_OPTIONS.find(r => r.value === newRole)?.label}`);
      setCreateDialogOpen(false);
      window.dispatchEvent(new CustomEvent('wisy:usersUpdated'));
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar usuário');
    } finally {
      setCreating(false);
    }
  };

  const copyPassword = async () => {
    await navigator.clipboard.writeText(newPassword);
    toast.success('Senha copiada');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Usuários</h1>
          <p className="text-muted-foreground">Aprove novos cadastros e gerencie o nível de acesso de qualquer usuário</p>
        </div>
        <Button className="gap-2 gradient-primary text-primary-foreground shrink-0" onClick={openCreateDialog}>
          <UserPlus className="h-4 w-4" /> Cadastrar Usuário
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {pendingUsers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                <h2 className="font-semibold text-foreground">
                  {pendingUsers.length} cadastro{pendingUsers.length > 1 ? 's' : ''} aguardando aprovação
                </h2>
              </div>
              <div className="space-y-3">
                {pendingUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={u.avatar_url ?? ''} />
                      <AvatarFallback>{(u.full_name || u.email).charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{u.full_name || 'Sem nome'}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      disabled={updatingId === u.id}
                      onClick={() => setApprovalStatus(u, 'rejected')}
                    >
                      <XCircle className="h-4 w-4" /> Rejeitar
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 gradient-primary text-primary-foreground"
                      disabled={updatingId === u.id}
                      onClick={() => setApprovalStatus(u, 'approved')}
                    >
                      {updatingId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Aprovar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-foreground">Todos os usuários</h2>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar por nome ou e-mail..." className="pl-9" />
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map(u => (
                  <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={u.avatar_url ?? ''} />
                      <AvatarFallback>{(u.full_name || u.email).charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-[160px]">
                      <p className="text-sm font-medium text-foreground truncate">
                        {u.full_name || 'Sem nome'} {u.id === currentUser?.id && <span className="text-xs text-muted-foreground">(você)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Badge variant={statusBadgeVariant(u.approval_status)} className="shrink-0">
                      {STATUS_OPTIONS.find(s => s.value === u.approval_status)?.label}
                    </Badge>
                    {u.approval_status !== 'pending' && (
                      <Select value={u.approval_status} onValueChange={(v) => setApprovalStatus(u, v as ApprovalStatus)}>
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <Select value={u.role} onValueChange={(v) => changeRole(u, v as AppRole)}>
                      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {u.approval_status === 'rejected' && (
                      <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => setApprovalStatus(u, 'pending')}>
                        <Undo2 className="h-3.5 w-3.5" /> Reabrir
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar usuário</DialogTitle>
            <DialogDescription>Cria a conta já aprovada, com o papel escolhido. Compartilhe a senha com a pessoa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Maria Silva" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@wisy.edu" />
            </div>
            <div className="space-y-2">
              <Label>Senha provisória</Label>
              <div className="flex gap-2">
                <Input value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                <Button type="button" variant="outline" size="icon" onClick={() => setNewPassword(generatePassword())} title="Gerar nova senha">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={copyPassword} title="Copiar senha">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={createUser} disabled={creating} className="gradient-primary text-primary-foreground">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
