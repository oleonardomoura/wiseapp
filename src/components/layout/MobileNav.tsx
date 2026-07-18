import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Layers, Users, Menu, Shield, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Headphones, Bell, Video, MessageCircle, User, Trophy, HelpCircle } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';

const studentMobileLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Início' },
  { to: '/course', icon: BookOpen, label: 'Curso' },
  { to: '/flashcards', icon: Layers, label: 'Cards' },
  { to: '/community', icon: Users, label: 'Social' },
];

const teacherMobileLinks = [
  { to: '/teacher', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/teacher/classes', icon: Users, label: 'Turmas' },
  { to: '/teacher/progress', icon: BarChart3, label: 'Progresso' },
  { to: '/teacher/students/register', icon: User, label: 'Alunos' },
  { to: '/notifications', icon: Bell, label: 'Notificações' },
];

const studentAllLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Início' },
  { to: '/course', icon: BookOpen, label: 'Curso' },
  { to: '/flashcards', icon: Layers, label: 'Flashcards' },
  { to: '/texts-with-audio', icon: Headphones, label: 'Textos' },
  { to: '/community', icon: Users, label: 'Comunidade' },
  { to: '/notifications', icon: Bell, label: 'Notificações' },
  { to: '/lives', icon: Video, label: 'Lives' },
  { to: '/conversation-groups', icon: MessageCircle, label: 'Grupos de Conversação' },
  { to: '/my-account', icon: User, label: 'Minha Conta' },
  { to: '/achievements', icon: Trophy, label: 'Minhas Conquistas' },
  { to: '/support', icon: HelpCircle, label: 'Suporte' },
];

const teacherAllLinks = [
  { to: '/teacher', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/teacher/classes', icon: Users, label: 'Turmas' },
  { to: '/teacher/progress', icon: BarChart3, label: 'Progresso' },
  { to: '/teacher/students/register', icon: User, label: 'Cadastrar Aluno' },
  { to: '/notifications', icon: Bell, label: 'Notificações' },
  { to: '/lives', icon: Video, label: 'Lives' },
  { to: '/conversation-groups', icon: MessageCircle, label: 'Grupos de Conversação' },
  { to: '/my-account', icon: User, label: 'Minha Conta' },
  { to: '/support', icon: HelpCircle, label: 'Suporte' },
];

const adminMobileLinks = [
  { to: '/admin', icon: Shield, label: 'Admin' },
  ...teacherMobileLinks,
];

const adminAllLinks = [
  { to: '/admin', icon: Shield, label: 'Painel Admin' },
  ...teacherAllLinks,
];

export function MobileNav() {
  const location = useLocation();
  const { role } = useAuthContext();
  const [open, setOpen] = useState(false);
  const mobileLinks = role === 'admin'
    ? adminMobileLinks
    : role === 'teacher'
      ? teacherMobileLinks
      : studentMobileLinks;
  const allLinks = role === 'admin'
    ? adminAllLinks
    : role === 'teacher'
      ? teacherAllLinks
      : studentAllLinks;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border">
      <div className="flex items-center justify-around py-2">
        {mobileLinks.map(link => {
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <link.icon className={cn("h-5 w-5", isActive && "drop-shadow-sm")} />
              <span>{link.label}</span>
            </Link>
          );
        })}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Menu className="h-5 w-5" />
              <span>Menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-8">
            <div className="space-y-1 pt-2">
              {allLinks.map(link => {
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <link.icon className="h-5 w-5" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
