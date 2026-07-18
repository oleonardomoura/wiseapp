import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, TrendingUp, Users, Sparkles, X, Plus, FileText, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import PostCard, { type PostData } from '@/components/community/PostCard';
import CreatePostDialog from '@/components/community/CreatePostDialog';
import GuidelinesDialog from '@/components/community/GuidelinesDialog';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

type Filter = 'todos' | 'turma' | 'conquistas';
const PAGE_SIZE = 10;

interface LeaderboardEntry {
  id: string;
  full_name: string | null;
  cefr_level: string | null;
  xp: number | null;
}

export default function CommunityPage() {
  const { user, profile } = useAuthContext();
  const [filter, setFilter] = useState<Filter>('todos');
  const [showBanner, setShowBanner] = useState(() => !localStorage.getItem('community_banner_dismissed'));
  const [search, setSearch] = useState('');
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [statsToday, setStatsToday] = useState({ posts: 0, online: 0 });

  const fetchPosts = useCallback(async (offset = 0, append = false) => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (search.trim()) {
      query = query.ilike('content', `%${search.trim()}%`);
    }

    const { data: postsData } = await query;
    if (!postsData) { setLoading(false); return; }

    if (postsData.length < PAGE_SIZE) setHasMore(false);
    else setHasMore(true);

    // Enrich with profiles, likes count, liked_by_me, comments count
    const postIds = postsData.map(p => p.id);
    const userIds = [...new Set(postsData.map(p => p.user_id))];

    const [profilesRes, likesRes, myLikesRes, commentsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, cefr_level, avatar_url, username').in('id', userIds),
      supabase.from('post_likes').select('post_id').in('post_id', postIds),
      supabase.from('post_likes').select('post_id').in('post_id', postIds).eq('user_id', user.id),
      supabase.from('comments').select('post_id').in('post_id', postIds),
    ]);

    const profileMap = new Map(profilesRes.data?.map(p => [p.id, p]) ?? []);
    const likesMap = new Map<string, number>();
    likesRes.data?.forEach(l => likesMap.set(l.post_id, (likesMap.get(l.post_id) ?? 0) + 1));
    const myLikesSet = new Set(myLikesRes.data?.map(l => l.post_id) ?? []);
    const commentsMap = new Map<string, number>();
    commentsRes.data?.forEach(c => commentsMap.set(c.post_id, (commentsMap.get(c.post_id) ?? 0) + 1));

    let enriched: PostData[] = postsData.map(p => ({
      ...p,
      profile: profileMap.get(p.user_id) ?? undefined,
      likes_count: likesMap.get(p.id) ?? 0,
      comments_count: commentsMap.get(p.id) ?? 0,
      liked_by_me: myLikesSet.has(p.id),
    }));

    // Apply client-side filters
    if (filter === 'turma' && profile?.cefr_level) {
      enriched = enriched.filter(p => p.profile?.cefr_level === profile.cefr_level);
    }
    if (filter === 'conquistas') {
      enriched = enriched.filter(p => p.content.startsWith('🏆') || p.content.startsWith('✨'));
    }

    setPosts(prev => append ? [...prev, ...enriched] : enriched);
    setLoading(false);
  }, [user, search, filter, profile]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Leaderboard
  useEffect(() => {
    supabase.from('profiles').select('id, full_name, cefr_level, xp').order('xp', { ascending: false }).limit(5)
      .then(({ data }) => { if (data) setLeaderboard(data); });
  }, []);

  // Stats
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString())
      .then(({ count }) => setStatsToday(s => ({ ...s, posts: count ?? 0 })));
  }, [posts.length]);

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem('community_banner_dismissed', '1');
  };

  const loadMore = () => { fetchPosts(posts.length, true); };

  if (!user) return null;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Welcome banner */}
      {showBanner && (
        <motion.div variants={item} className="glass rounded-xl border border-border p-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">🎉 Bem-vindo à Comunidade!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Conecte-se com outros estudantes, compartilhe seu progresso e pratique inglês juntos.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setGuidelinesOpen(true)}>
              Ver Diretrizes da Comunidade
            </Button>
          </div>
          <button onClick={dismissBanner} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {/* Header */}
      <motion.div variants={item} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Comunidade</h1>
          <p className="text-muted-foreground">Conecte-se com outros alunos e compartilhe sua jornada</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setGuidelinesOpen(true)}>Diretrizes</Button>
          <Button className="gradient-primary text-primary-foreground" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Post
          </Button>
        </div>
      </motion.div>

      {/* Search + Filters */}
      <motion.div variants={item} className="glass rounded-xl border border-border p-4 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar posts, hashtags..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(['todos', 'turma', 'conquistas'] as Filter[]).map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'ghost'}
              onClick={() => setFilter(f)}
              className={cn(filter === f && 'gradient-primary text-primary-foreground')}
            >
              {f === 'todos' ? 'Todos' : f === 'turma' ? 'Minha Turma' : 'Conquistas'}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Feed */}
        <div className="space-y-4">
          {posts.length === 0 && !loading && (
            <div className="glass rounded-xl border border-border p-10 text-center">
              <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhum post encontrado. Seja o primeiro a compartilhar!</p>
            </div>
          )}

          {posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user.id}
              index={i}
              onRefresh={() => fetchPosts()}
            />
          ))}

          {hasMore && posts.length > 0 && (
            <div className="text-center pt-2">
              <Button variant="outline" onClick={loadMore} disabled={loading}>
                {loading ? 'Carregando...' : 'Carregar Mais'}
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Leaderboard */}
          <motion.div variants={item} className="glass rounded-xl border border-border p-5 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground">Top da Semana</h3>
            </div>
            <div className="space-y-3">
              {leaderboard.map((u, idx) => (
                <div key={u.id} className="flex items-center gap-3">
                  <span className={cn(
                    'text-sm font-bold w-5 text-center',
                    idx < 3 ? 'text-primary' : 'text-muted-foreground'
                  )}>
                    {idx + 1}
                  </span>
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-secondary text-xs">
                      {(u.full_name ?? '?').charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.full_name ?? 'Anônimo'}</p>
                    <p className="text-xs text-muted-foreground">{u.xp ?? 0} XP</p>
                  </div>
                  {u.cefr_level && <Badge variant="outline" className="text-[10px]">{u.cefr_level}</Badge>}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div variants={item} className="glass rounded-xl border border-border p-5 space-y-3">
            <h3 className="font-semibold text-foreground">Estatísticas</h3>
            <div className="space-y-2">
              {[
                { icon: Users, label: 'Membros', value: String(leaderboard.length) },
                { icon: MessageCircle, label: 'Posts hoje', value: String(statsToday.posts) },
                { icon: Sparkles, label: 'Seu nível', value: profile?.cefr_level ?? 'A1' },
              ].map(stat => (
                <div key={stat.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <stat.icon className="h-4 w-4" />
                    {stat.label}
                  </span>
                  <span className="font-semibold text-foreground">{stat.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Guidelines */}
          <motion.div variants={item} className="glass rounded-xl border border-border p-5 text-center space-y-2">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Diretrizes da Comunidade</h3>
            <p className="text-sm text-muted-foreground">Mantenha nossa comunidade segura e acolhedora</p>
            <Button variant="outline" size="sm" className="w-full" onClick={() => setGuidelinesOpen(true)}>
              Ler Diretrizes
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Dialogs */}
      <CreatePostDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        userId={user.id}
        onPostCreated={() => fetchPosts()}
      />
      <GuidelinesDialog open={guidelinesOpen} onOpenChange={setGuidelinesOpen} />
    </motion.div>
  );
}
