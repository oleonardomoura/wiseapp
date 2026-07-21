import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList,
} from 'recharts';
import { Users, GraduationCap, Shield, ShieldAlert, Loader2 } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, ApprovalStatus } from '@/hooks/useAuth';
import { toast } from 'sonner';

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  approval_status: ApprovalStatus;
  role: AppRole;
};

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const ROLE_LABEL: Record<AppRole, string> = { student: 'Aluno', teacher: 'Professor', admin: 'Admin' };

// Categorical palette (validated: CVD ΔE and contrast checked against this app's
// light/dark card surfaces). Order is fixed — never reassigned per render.
const CATEGORICAL_LIGHT = ['#2a78d6', '#008300', '#e87ba4', '#eda100'];
const CATEGORICAL_DARK = ['#3987e5', '#008300', '#d55181', '#c98500'];

// Sequential single-hue ramp (blue), one step per CEFR level, light -> dark = A1 -> C2.
const SEQUENTIAL_LIGHT = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281', '#0d366b'];
const SEQUENTIAL_DARK = ['#6da7ec', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95'];

function useIsDarkMode() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

function formatDay(iso: string) {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export default function AdminDashboard() {
  const isDark = useIsDarkMode();
  const categorical = isDark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
  const sequential = isDark ? SEQUENTIAL_DARK : SEQUENTIAL_LIGHT;

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [classLevels, setClassLevels] = useState<string[]>([]);
  const [contentCounts, setContentCounts] = useState({ materials: 0, modules: 0, collections: 0, texts: 0 });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [usersRes, classesRes, materialsRes, modulesRes, collectionsRes, textsRes] = await Promise.all([
          supabase.rpc('admin_list_users'),
          supabase.from('teacher_classes').select('level'),
          supabase.from('class_materials').select('id', { count: 'exact', head: true }),
          supabase.from('course_modules').select('id', { count: 'exact', head: true }),
          supabase.from('flashcard_collections').select('id', { count: 'exact', head: true }),
          supabase.from('audio_texts').select('id', { count: 'exact', head: true }),
        ]);
        if (usersRes.error) throw usersRes.error;
        if (classesRes.error) throw classesRes.error;

        setUsers((usersRes.data ?? []) as UserRow[]);
        setClassLevels((classesRes.data ?? []).map(c => c.level));
        setContentCounts({
          materials: materialsRes.count ?? 0,
          modules: modulesRes.count ?? 0,
          collections: collectionsRes.count ?? 0,
          texts: textsRes.count ?? 0,
        });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao carregar o painel');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const totals = useMemo(() => ({
    students: users.filter(u => u.role === 'student').length,
    teachers: users.filter(u => u.role === 'teacher').length,
    admins: users.filter(u => u.role === 'admin').length,
    pending: users.filter(u => u.approval_status === 'pending').length,
  }), [users]);

  const signupTrend = useMemo(() => {
    const days: { key: string; date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, date: formatDay(d.toISOString()), count: 0 });
    }
    const byDay = new Map(days.map(d => [d.key, d]));
    users.forEach(u => {
      const key = u.created_at.slice(0, 10);
      const entry = byDay.get(key);
      if (entry) entry.count += 1;
    });
    return days;
  }, [users]);

  const roleDistribution = useMemo(() => ([
    { key: 'student', label: 'Aluno', value: totals.students },
    { key: 'teacher', label: 'Professor', value: totals.teachers },
    { key: 'admin', label: 'Admin', value: totals.admins },
  ]), [totals]);

  const levelDistribution = useMemo(() => {
    const counts = new Map(LEVELS.map(l => [l, 0]));
    classLevels.forEach(l => counts.set(l, (counts.get(l) ?? 0) + 1));
    return LEVELS.map(level => ({ level, count: counts.get(level) ?? 0 }));
  }, [classLevels]);

  const contentByType = useMemo(() => ([
    { key: 'materials', label: 'Materiais', value: contentCounts.materials },
    { key: 'modules', label: 'Módulos', value: contentCounts.modules },
    { key: 'collections', label: 'Flashcards', value: contentCounts.collections },
    { key: 'texts', label: 'Textos', value: contentCounts.texts },
  ]), [contentCounts]);

  const recentSignups = useMemo(
    () => [...users].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6),
    [users]
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Controle global da Wisy English School</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total de Alunos" value={totals.students} icon={Users} variant="primary" />
        <StatCard title="Professores" value={totals.teachers} icon={GraduationCap} variant="accent" />
        <StatCard title="Admins" value={totals.admins} icon={Shield} variant="success" />
        <Link to="/admin/users" className="block">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 transition-all duration-200 hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Cadastros Pendentes</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">{totals.pending}</p>
                <p className="text-xs text-muted-foreground">{totals.pending > 0 ? 'Clique para revisar' : 'Tudo em dia'}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 text-white">
                <ShieldAlert className="h-5 w-5" />
              </div>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Novos Cadastros</h2>
          <p className="text-sm text-muted-foreground mb-4">Últimos 14 dias</p>
          <ChartContainer config={{ count: { label: 'Cadastros', color: sequential[2] } }} className="aspect-auto h-56 w-full">
            <AreaChart data={signupTrend} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} interval={1} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
              <ChartTooltip content={<ChartTooltipContent hideLabel={false} />} />
              <Area type="monotone" dataKey="count" name="Cadastros" stroke={sequential[2]} fill={sequential[2]} fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Distribuição de Papéis</h2>
          <p className="text-sm text-muted-foreground mb-4">{users.length} usuários no total</p>
          <ChartContainer config={{ value: { label: 'Usuários' } }} className="aspect-auto h-56 w-full">
            <BarChart data={roleDistribution} layout="vertical" margin={{ left: 8, right: 24 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} fontSize={13} width={80} />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="value" name="Usuários" radius={[0, 6, 6, 0]} barSize={28}>
                {roleDistribution.map((entry, i) => <Cell key={entry.key} fill={categorical[i]} />)}
                <LabelList dataKey="value" position="right" className="fill-foreground" fontSize={13} fontWeight={600} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Turmas por Nível</h2>
          <p className="text-sm text-muted-foreground mb-4">{classLevels.length} turmas cadastradas</p>
          <ChartContainer config={{ count: { label: 'Turmas' } }} className="aspect-auto h-56 w-full">
            <BarChart data={levelDistribution} margin={{ left: -20, right: 8, top: 16 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="level" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="count" name="Turmas" radius={[4, 4, 0, 0]}>
                {levelDistribution.map((entry, i) => <Cell key={entry.level} fill={sequential[i]} />)}
                <LabelList dataKey="count" position="top" className="fill-foreground" fontSize={12} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Conteúdo por Tipo</h2>
          <p className="text-sm text-muted-foreground mb-4">Materiais, curso, flashcards e textos criados</p>
          <ChartContainer config={{ value: { label: 'Itens' } }} className="aspect-auto h-56 w-full">
            <BarChart data={contentByType} margin={{ left: -20, right: 8, top: 16 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="value" name="Itens" radius={[4, 4, 0, 0]}>
                {contentByType.map((entry, i) => <Cell key={entry.key} fill={categorical[i]} />)}
                <LabelList dataKey="value" position="top" className="fill-foreground" fontSize={12} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Cadastros Recentes</h2>
        {recentSignups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cadastro ainda.</p>
        ) : (
          <div className="space-y-3">
            {recentSignups.map(u => (
              <div key={u.id} className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                <div className="h-2 w-2 rounded-full gradient-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground">{u.full_name || u.email}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(u.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                <Badge variant={u.approval_status === 'pending' ? 'outline' : 'secondary'} className="shrink-0">
                  {ROLE_LABEL[u.role]}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
