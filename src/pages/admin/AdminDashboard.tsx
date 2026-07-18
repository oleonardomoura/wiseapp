import { motion } from 'framer-motion';
import { StatCard } from '@/components/ui/stat-card';
import { Users, GraduationCap, Shield, Activity } from 'lucide-react';

export default function AdminDashboard() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Painel Administrativo</h1>
        <p className="text-muted-foreground">Controle global da Wisy English School</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total de Alunos" value={142} icon={Users} variant="primary" />
        <StatCard title="Professores" value={6} icon={GraduationCap} variant="accent" />
        <StatCard title="Admins" value={2} icon={Shield} variant="success" />
        <StatCard title="Usuários Ativos Hoje" value={38} icon={Activity} variant="default" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Atividade Recente</h2>
          <div className="space-y-3 text-sm">
            {[
              'Maria Silva completou o módulo "Gramática Básica"',
              'João Santos se cadastrou na plataforma',
              'Prof. Ana criou um novo plano de aula',
              'Pedro Oliveira alcançou 500 XP',
            ].map((activity, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                <div className="h-2 w-2 rounded-full gradient-primary shrink-0" />
                <span className="text-muted-foreground">{activity}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Estatísticas do Sistema</h2>
          <div className="space-y-4">
            {[
              { label: 'Taxa de Retenção', value: '87%' },
              { label: 'Tempo Médio por Sessão', value: '23 min' },
              { label: 'Posts na Comunidade', value: '342' },
              { label: 'Flashcards Criados', value: '1.2k' },
            ].map(stat => (
              <div key={stat.label} className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <span className="font-semibold text-foreground">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
