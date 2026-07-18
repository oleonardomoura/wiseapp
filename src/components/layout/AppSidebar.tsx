import { Link, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  Headphones,
  Users,
  User,
  Trophy,
  Bell,
  Video,
  MessageCircle,
  HelpCircle,
  GraduationCap,
  UserPlus,
  BarChart3,
  Shield,
  ChevronLeft,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useCallback } from 'react';

const studentLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Início' },
  { to: '/course', icon: BookOpen, label: 'Curso' },
  { to: '/flashcards', icon: Layers, label: 'Flashcards' },
  { to: '/texts-with-audio', icon: Headphones, label: 'Textos' },
  { to: '/community', icon: Users, label: 'Comunidade' },
  { to: '/lives', icon: Video, label: 'Lives' },
  { to: '/conversation-groups', icon: MessageCircle, label: 'Grupos de Conversação' },
  { to: '/achievements', icon: Trophy, label: 'Minhas Conquistas' },
];

const teacherLinks = [
  { to: '/teacher', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/teacher/classes', icon: GraduationCap, label: 'Turmas' },
  { to: '/teacher/progress', icon: BarChart3, label: 'Progresso' },
  { to: '/teacher/students/register', icon: UserPlus, label: 'Cadastrar Aluno' },
  { to: '/notifications', icon: Bell, label: 'Notificações' },
  { to: '/lives', icon: Video, label: 'Lives' },
  { to: '/conversation-groups', icon: MessageCircle, label: 'Grupos de Conversação' },
];

const adminLinks = [
  { to: '/admin', icon: Shield, label: 'Painel Admin' },
];

const sharedLinks = [
  { to: '/my-account', icon: User, label: 'Minha Conta' },
  { to: '/support', icon: HelpCircle, label: 'Suporte' },
];

export function AppSidebar() {
  const { role, profile, signOut, user } = useAuthContext();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // Sync collapsed state to CSS custom property for header/main alignment
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', collapsed ? '68px' : '256px');
  }, [collapsed]);
  const [dark, setDark] = useState(false);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setDark(isDark);
  }, []);

  useEffect(() => {
    const handler = () => forceUpdate(n => n + 1);
    window.addEventListener('wisy:profileUpdated', handler);
    return () => window.removeEventListener('wisy:profileUpdated', handler);
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setDark(!dark);
  };

  const links = role === 'admin'
    ? [...adminLinks, ...teacherLinks, ...sharedLinks]
    : role === 'teacher'
      ? [...teacherLinks, ...sharedLinks]
      : [...studentLinks, { to: '/notifications', icon: Bell, label: 'Notificações' }, ...sharedLinks];

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-card transition-all duration-300",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* User profile - aligned with h-16 header */}
      <div className={cn(
        "flex h-16 items-center border-b border-border transition-all duration-300",
        collapsed ? "justify-center px-2" : "gap-3 px-4"
      )}>
        {collapsed ? (
          <button onClick={() => setCollapsed(false)} className="relative">
            <Avatar className="h-9 w-9 border-2 border-primary/20">
              <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || 'Usuário'} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-card border border-border">
              <ChevronLeft className="h-3 w-3 rotate-180 text-muted-foreground" />
            </span>
          </button>
        ) : (
          <>
            <Link to="/my-account" className="shrink-0">
              <Avatar className="h-9 w-9 border-2 border-primary/20">
                <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || 'Usuário'} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
            <Link to="/my-account" className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {profile?.full_name || 'Usuário'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {profile?.cefr_level ? `Nível ${profile.cefr_level}` : user?.email}
              </p>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(true)}
              className="h-8 w-8 shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {links.map(link => {
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "gradient-primary text-white shadow-glow"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <link.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-1">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
        >
          {dark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {!collapsed && <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
