import { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, MoreHorizontal, Flag, Trash2, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CommentsSection from './CommentsSection';
import ReportDialog from './ReportDialog';
import { renderContentWithMentions } from '@/lib/mentions';

export interface PostData {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user_id: string;
  profile?: { full_name: string | null; cefr_level: string | null; avatar_url: string | null; username: string | null };
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
}

interface PostCardProps {
  post: PostData;
  currentUserId: string;
  index: number;
  onRefresh: () => void;
}

export default function PostCard({ post, currentUserId, index, onRefresh }: PostCardProps) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [showComments, setShowComments] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const isOwner = post.user_id === currentUserId;
  const isAchievement = post.content.startsWith('🏆') || post.content.startsWith('✨');

  const toggleLike = async () => {
    if (liked) {
      setLiked(false);
      setLikesCount(c => c - 1);
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', currentUserId);
    } else {
      setLiked(true);
      setLikesCount(c => c + 1);
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: currentUserId });
    }
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (error) { toast.error('Erro ao deletar post.'); return; }
    toast.success('Post deletado.');
    onRefresh();
  };

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/community?post=${post.id}`);
    toast.success('Link copiado!');
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 + index * 0.04 }}
        className="glass rounded-xl border border-border p-5 space-y-3"
      >
        {/* Author row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {(post.profile?.full_name ?? '?').charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {post.profile?.full_name ?? 'Anônimo'}
                </span>
                {post.profile?.username && (
                  <span className="text-[11px] font-mono text-muted-foreground bg-secondary/30 px-1.5 py-0.5 rounded">
                    {post.profile.username}
                  </span>
                )}
                {post.profile?.cefr_level && (
                  <Badge variant="outline" className="text-[10px]">{post.profile.cefr_level}</Badge>
                )}
                {isAchievement && (
                  <Badge variant="secondary" className="text-[10px]">
                    <Sparkles className="mr-1 h-3 w-3" />Conquista
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setReportOpen(true)}>
                <Flag className="mr-2 h-4 w-4" /> Denunciar
              </DropdownMenuItem>
              {isOwner && (
                <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Deletar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {renderContentWithMentions(post.content)}
        </div>

        {/* Image */}
        {post.image_url && (
          <img src={post.image_url} alt="" className="rounded-lg w-full max-h-72 object-cover" />
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleLike}
              className={cn(
                'flex items-center gap-1.5 text-sm transition-colors',
                liked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
              )}
            >
              <Heart className={cn('h-4 w-4', liked && 'fill-current')} />
              {likesCount}
            </button>
            <button
              onClick={() => setShowComments(s => !s)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              {commentsCount}
            </button>
          </div>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <Share2 className="h-4 w-4" />
            Compartilhar
          </button>
        </div>

        {/* Comments */}
        {showComments && (
          <CommentsSection
            postId={post.id}
            currentUserId={currentUserId}
            onCountChange={setCommentsCount}
          />
        )}
      </motion.div>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="post" />
    </>
  );
}
