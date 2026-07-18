import { useAuthContext } from '@/contexts/AuthContext';
import { Flame, Clock, Zap, Users, BookOpen, Play, Trophy, Badge as BadgeIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function StudentDashboard() {
  const { profile } = useAuthContext();

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      {/* Hero */}
      <motion.div variants={item} className="text-center space-y-3">
        <h1 className="text-3xl font-bold tracking-tight gradient-text sm:text-4xl">
          Bem-vindo de volta!
        </h1>
        <p className="text-muted-foreground">
          Continue sua jornada no inglês. Você está no nível{' '}
          <Badge variant="outline" className="ml-1 font-semibold">{profile?.cefr_level || 'A1'}</Badge>
        </p>
        <div className="pt-2">
          <Button asChild size="lg" className="gradient-primary text-primary-foreground px-8 h-12 text-base font-semibold">
            <Link to="/course">
              <Play className="mr-2 h-4 w-4" />
              Continuar Curso
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Stats cards */}
      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Sequência */}
        <div className="glass rounded-xl border border-border p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Sequência</span>
            <Flame className="h-4 w-4 text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-foreground">{profile?.streak ?? 0} dias</p>
          <p className="text-xs text-muted-foreground">Continue assim!</p>
        </div>

        {/* Próximas Revisões */}
        <div className="glass rounded-xl border border-border p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Próximas Revisões</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold text-foreground">23</p>
          <p className="text-xs text-muted-foreground">Flashcards pendentes</p>
          <Button asChild size="sm" className="w-full gradient-primary text-primary-foreground mt-1">
            <Link to="/flashcards">Revisar Agora</Link>
          </Button>
        </div>

        {/* XP desta Semana */}
        <div className="glass rounded-xl border border-border p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">XP desta Semana</span>
            <BadgeIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold text-foreground">{profile?.xp ?? 0}</p>
          <p className="text-xs text-muted-foreground">Meta: 1000 XP</p>
        </div>

        {/* Próximo Grupo */}
        <div className="glass rounded-xl border border-border p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Próximo Grupo</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold text-foreground">4</p>
          <p className="text-xs text-muted-foreground">Hoje às 19:00</p>
          <Button asChild variant="outline" size="sm" className="w-full mt-1">
            <Link to="/conversation-groups">Ver Detalhes</Link>
          </Button>
        </div>
      </motion.div>

      {/* Aula de Hoje */}
      <motion.div variants={item} className="glass rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">A Aula de Hoje</h2>
        </div>

        <div>
          <h3 className="text-xl font-bold text-foreground">Introducing Yourself</h3>
          <p className="text-sm text-muted-foreground">Basic Greetings and Introductions</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <span className="font-medium text-foreground">Prática Oral</span>
            <Badge variant="secondary">Pendente</Badge>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <span className="font-medium text-foreground">Consolidação</span>
            <Badge variant="outline">Bloqueado</Badge>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso Semanal</span>
            <span className="font-semibold text-foreground">85%</span>
          </div>
          <Progress value={85} className="h-2.5" />
        </div>
      </motion.div>

      {/* Bottom grid */}
      <motion.div variants={item} className="grid gap-6 lg:grid-cols-2">
        {/* Insights */}
        <div className="glass rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Insights de Aprendizado</h2>
          <div>
            <p className="text-sm font-semibold text-primary">Sons para Treinar</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {['/θ/ - th', '/r/ - r', '/v/ - v', '/ʃ/ - sh'].map(sound => (
                <Badge key={sound} variant="secondary" className="text-sm font-mono">{sound}</Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">Vocabulário da Semana</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {['introduce', 'pleasure', 'nationality', 'occupation'].map(word => (
                <Badge key={word} variant="outline" className="text-sm">{word}</Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Últimas Conquistas */}
        <div className="glass rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-foreground">Últimas Conquistas</h2>
          </div>
          <div className="space-y-3">
            {[
              { title: 'First Week Streak', desc: '2 dias atrás', emoji: '🔥' },
              { title: 'Primeiro Login', desc: '5 dias atrás', emoji: '🎉' },
              { title: 'Leitor Ávido', desc: '1 semana atrás', emoji: '📚' },
            ].map(ach => (
              <div key={ach.title} className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                <span className="text-2xl">{ach.emoji}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{ach.title}</p>
                  <p className="text-xs text-muted-foreground">{ach.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/achievements">Ver Todas</Link>
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
