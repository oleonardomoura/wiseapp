import { useState } from 'react';
import { HelpCircle, MessageSquare, FileText, ExternalLink, Send, ChevronDown, Search, Bug, Lightbulb, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const faqItems = [
  { q: 'Como funciona o sistema de XP?', a: 'Você ganha XP ao completar atividades, flashcards e exercícios de listening. Quanto mais consistente, mais bônus!', cat: 'geral' },
  { q: 'Como manter minha streak?', a: 'Complete pelo menos uma atividade por dia para manter sua streak ativa. Sua streak é zerada se você ficar um dia sem estudar.', cat: 'geral' },
  { q: 'Posso mudar meu nível CEFR?', a: 'Sim! Acesse Minha Conta e atualize seu nível a qualquer momento. Isso ajusta a dificuldade dos conteúdos.', cat: 'conta' },
  { q: 'Como participar das lives?', a: 'Acesse a seção Lives no menu e entre nas aulas ao vivo disponíveis. Você será notificado antes de cada live.', cat: 'lives' },
  { q: 'Como funciona o SRS (Repetição Espaçada)?', a: 'O sistema agenda revisões com intervalos crescentes. Quanto melhor você lembrar, maior o intervalo até a próxima revisão.', cat: 'flashcards' },
  { q: 'Posso baixar os textos com áudio?', a: 'Os textos ficam disponíveis online na plataforma. Você pode estudá-los a qualquer momento pelo navegador.', cat: 'textos' },
  { q: 'Como ganho badges?', a: 'Badges são desbloqueados automaticamente ao atingir marcos: dias de estudo, flashcards revisados, posts na comunidade, etc.', cat: 'geral' },
  { q: 'Esqueci minha senha, o que fazer?', a: 'Na tela de login, clique em "Esqueci minha senha" para receber um e-mail de redefinição.', cat: 'conta' },
  { q: 'Como entro nos grupos de conversação?', a: 'Acesse "Grupos de Conversação" no menu, escolha um grupo e clique em "Participar". Cada grupo tem dia e horário fixo.', cat: 'lives' },
  { q: 'Como funciona o crop de foto do perfil?', a: 'Ao alterar sua foto em "Minha Conta", um editor abre para você recortar a imagem em formato circular antes de salvar.', cat: 'conta' },
];

const faqCategories = [
  { value: 'all', label: 'Todas' },
  { value: 'geral', label: 'Geral' },
  { value: 'conta', label: 'Conta' },
  { value: 'flashcards', label: 'Flashcards' },
  { value: 'lives', label: 'Lives' },
  { value: 'textos', label: 'Textos' },
];

const ticketSchema = z.object({
  subject: z.string().trim().min(5, 'Assunto deve ter pelo menos 5 caracteres').max(120, 'Máximo 120 caracteres'),
  category: z.string().min(1, 'Selecione uma categoria'),
  message: z.string().trim().min(20, 'Descreva com pelo menos 20 caracteres').max(2000, 'Máximo 2000 caracteres'),
});

const feedbackSchema = z.object({
  type: z.string().min(1, 'Selecione o tipo'),
  message: z.string().trim().min(10, 'Escreva pelo menos 10 caracteres').max(1000, 'Máximo 1000 caracteres'),
});

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function SupportPage() {
  const { toast } = useToast();
  const { user } = useAuthContext();

  // Support ticket dialog
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSending, setTicketSending] = useState(false);
  const [ticketErrors, setTicketErrors] = useState<Record<string, string>>({});

  // Feedback dialog
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackErrors, setFeedbackErrors] = useState<Record<string, string>>({});

  // FAQ search & filter
  const [faqSearch, setFaqSearch] = useState('');
  const [faqCat, setFaqCat] = useState('all');

  const filteredFaq = faqItems.filter(f => {
    const matchCat = faqCat === 'all' || f.cat === faqCat;
    const matchSearch = !faqSearch.trim() || f.q.toLowerCase().includes(faqSearch.toLowerCase()) || f.a.toLowerCase().includes(faqSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleSendTicket = async () => {
    const result = ticketSchema.safeParse({ subject: ticketSubject, category: ticketCategory, message: ticketMessage });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach(e => { errs[e.path[0] as string] = e.message; });
      setTicketErrors(errs);
      return;
    }
    setTicketErrors({});
    setTicketSending(true);

    try {
      // Store as a notification to admin (simple approach)
      if (user) {
        const { error } = await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'support_ticket',
          title: `Ticket: ${result.data.subject}`,
          message: `[${result.data.category}] ${result.data.message}`,
        });
        // RLS may block this - fallback to localStorage
        if (error) {
          const tickets = JSON.parse(localStorage.getItem('wisy:tickets') || '[]');
          tickets.push({ ...result.data, user_id: user.id, created_at: new Date().toISOString() });
          localStorage.setItem('wisy:tickets', JSON.stringify(tickets));
        }
      }
      toast({ title: 'Ticket enviado! ✅', description: 'Nossa equipe responderá em breve.' });
      setTicketOpen(false);
      setTicketSubject('');
      setTicketCategory('');
      setTicketMessage('');
    } catch {
      toast({ title: 'Erro ao enviar', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setTicketSending(false);
    }
  };

  const handleSendFeedback = async () => {
    const result = feedbackSchema.safeParse({ type: feedbackType, message: feedbackMessage });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach(e => { errs[e.path[0] as string] = e.message; });
      setFeedbackErrors(errs);
      return;
    }
    setFeedbackErrors({});
    setFeedbackSending(true);

    try {
      if (user) {
        const { error } = await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'feedback',
          title: `Feedback: ${result.data.type}`,
          message: result.data.message,
        });
        if (error) {
          const feedbacks = JSON.parse(localStorage.getItem('wisy:feedbacks') || '[]');
          feedbacks.push({ ...result.data, user_id: user.id, created_at: new Date().toISOString() });
          localStorage.setItem('wisy:feedbacks', JSON.stringify(feedbacks));
        }
      }
      toast({ title: 'Feedback enviado! 💬', description: 'Obrigado pela sua contribuição!' });
      setFeedbackOpen(false);
      setFeedbackType('');
      setFeedbackMessage('');
    } catch {
      toast({ title: 'Erro ao enviar', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setFeedbackSending(false);
    }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Suporte</h1>
        <p className="text-muted-foreground">Como podemos ajudar você?</p>
      </motion.div>

      {/* Action cards */}
      <motion.div variants={item} className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: MessageSquare, title: 'Chat com Suporte', desc: 'Abra um ticket para nossa equipe', action: 'Abrir Ticket', onClick: () => setTicketOpen(true) },
          { icon: BookOpen, title: 'Central de Ajuda', desc: 'Artigos e tutoriais', action: 'Ver FAQ abaixo', onClick: () => document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' }) },
          { icon: Lightbulb, title: 'Feedback', desc: 'Envie sugestões ou reporte bugs', action: 'Enviar Feedback', onClick: () => setFeedbackOpen(true) },
        ].map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-5 text-center space-y-3"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <c.icon className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-foreground">{c.title}</h3>
            <p className="text-sm text-muted-foreground">{c.desc}</p>
            <Button variant="outline" size="sm" className="w-full" onClick={c.onClick}>{c.action}</Button>
          </motion.div>
        ))}
      </motion.div>

      {/* FAQ */}
      <motion.div variants={item} id="faq-section" className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          Perguntas Frequentes
        </h2>

        {/* Search & Filter */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar pergunta..." value={faqSearch} onChange={e => setFaqSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={faqCat} onValueChange={setFaqCat}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {faqCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {filteredFaq.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma pergunta encontrada</p>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {filteredFaq.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="rounded-xl border border-border bg-card px-4">
                <AccordionTrigger className="text-left text-sm font-medium text-foreground hover:no-underline gap-3">
                  <div className="flex items-center gap-3">
                    <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                    <span>{faq.q}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pl-7 text-sm text-muted-foreground pb-4">
                  {faq.a}
                  <Badge variant="secondary" className="ml-2 text-xs">{faqCategories.find(c => c.value === faq.cat)?.label}</Badge>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </motion.div>

      {/* Support Ticket Dialog */}
      <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Abrir Ticket de Suporte
            </DialogTitle>
            <DialogDescription>Descreva seu problema e nossa equipe responderá por e-mail.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Assunto</label>
              <Input
                placeholder="Ex: Problema com flashcards"
                value={ticketSubject}
                onChange={e => setTicketSubject(e.target.value)}
                maxLength={120}
              />
              {ticketErrors.subject && <p className="text-xs text-destructive mt-1">{ticketErrors.subject}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Categoria</label>
              <Select value={ticketCategory} onValueChange={setTicketCategory}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">🐛 Bug / Erro</SelectItem>
                  <SelectItem value="account">👤 Minha Conta</SelectItem>
                  <SelectItem value="content">📚 Conteúdo</SelectItem>
                  <SelectItem value="billing">💳 Pagamento</SelectItem>
                  <SelectItem value="other">❓ Outro</SelectItem>
                </SelectContent>
              </Select>
              {ticketErrors.category && <p className="text-xs text-destructive mt-1">{ticketErrors.category}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Mensagem</label>
              <Textarea
                placeholder="Descreva o que aconteceu em detalhes..."
                value={ticketMessage}
                onChange={e => setTicketMessage(e.target.value)}
                rows={5}
                maxLength={2000}
              />
              <div className="flex justify-between mt-1">
                {ticketErrors.message && <p className="text-xs text-destructive">{ticketErrors.message}</p>}
                <p className="text-xs text-muted-foreground ml-auto">{ticketMessage.length}/2000</p>
              </div>
            </div>
            <Button onClick={handleSendTicket} disabled={ticketSending} className="w-full">
              <Send className="mr-2 h-4 w-4" />
              {ticketSending ? 'Enviando...' : 'Enviar Ticket'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Enviar Feedback
            </DialogTitle>
            <DialogDescription>Sua opinião nos ajuda a melhorar a plataforma!</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Tipo</label>
              <Select value={feedbackType} onValueChange={setFeedbackType}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="suggestion">💡 Sugestão</SelectItem>
                  <SelectItem value="bug">🐛 Reportar Bug</SelectItem>
                  <SelectItem value="compliment">⭐ Elogio</SelectItem>
                  <SelectItem value="other">💬 Outro</SelectItem>
                </SelectContent>
              </Select>
              {feedbackErrors.type && <p className="text-xs text-destructive mt-1">{feedbackErrors.type}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Mensagem</label>
              <Textarea
                placeholder="Conte-nos o que você pensa..."
                value={feedbackMessage}
                onChange={e => setFeedbackMessage(e.target.value)}
                rows={5}
                maxLength={1000}
              />
              <div className="flex justify-between mt-1">
                {feedbackErrors.message && <p className="text-xs text-destructive">{feedbackErrors.message}</p>}
                <p className="text-xs text-muted-foreground ml-auto">{feedbackMessage.length}/1000</p>
              </div>
            </div>
            <Button onClick={handleSendFeedback} disabled={feedbackSending} className="w-full">
              <Send className="mr-2 h-4 w-4" />
              {feedbackSending ? 'Enviando...' : 'Enviar Feedback'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
