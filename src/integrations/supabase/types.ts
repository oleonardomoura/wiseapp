export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_history: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          user_id: string
          xp_earned: number
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id: string
          xp_earned?: number
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string
          xp_earned?: number
        }
        Relationships: []
      }
      audio_sessions: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          final_score: number | null
          id: string
          initial_score: number | null
          text_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          final_score?: number | null
          id?: string
          initial_score?: number | null
          text_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          final_score?: number | null
          id?: string
          initial_score?: number | null
          text_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_sessions_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "audio_texts"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_text_sentences: {
        Row: {
          en: string
          id: string
          pt: string
          seq: number
          text_id: string
        }
        Insert: {
          en: string
          id?: string
          pt: string
          seq?: number
          text_id: string
        }
        Update: {
          en?: string
          id?: string
          pt?: string
          seq?: number
          text_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_text_sentences_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "audio_texts"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_text_vocabulary: {
        Row: {
          explanation: string | null
          id: string
          sentence_id: string
          translation: string
          word: string
        }
        Insert: {
          explanation?: string | null
          id?: string
          sentence_id: string
          translation: string
          word: string
        }
        Update: {
          explanation?: string | null
          id?: string
          sentence_id?: string
          translation?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_text_vocabulary_sentence_id_fkey"
            columns: ["sentence_id"]
            isOneToOne: false
            referencedRelation: "audio_text_sentences"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_texts: {
        Row: {
          created_at: string
          duration: string
          id: string
          level: string
          seq: number
          theme: string
          title: string
          title_pt: string
        }
        Insert: {
          created_at?: string
          duration?: string
          id?: string
          level?: string
          seq?: number
          theme?: string
          title: string
          title_pt: string
        }
        Update: {
          created_at?: string
          duration?: string
          id?: string
          level?: string
          seq?: number
          theme?: string
          title?: string
          title_pt?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_groups: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string
          day_of_week: string
          description: string | null
          emoji: string | null
          id: string
          level: string
          max_members: number | null
          meeting_url: string | null
          name: string
          next_session_at: string | null
          teacher_id: string | null
          time_slot: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by: string
          day_of_week?: string
          description?: string | null
          emoji?: string | null
          id?: string
          level?: string
          max_members?: number | null
          meeting_url?: string | null
          name: string
          next_session_at?: string | null
          teacher_id?: string | null
          time_slot?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string
          day_of_week?: string
          description?: string | null
          emoji?: string | null
          id?: string
          level?: string
          max_members?: number | null
          meeting_url?: string | null
          name?: string
          next_session_at?: string | null
          teacher_id?: string | null
          time_slot?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_groups_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_notifications: {
        Row: {
          class_id: string
          created_at: string
          id: string
          message: string
          teacher_id: string
          title: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          message: string
          teacher_id: string
          title: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          message?: string
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_notifications_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      course_progress: {
        Row: {
          completed: boolean
          consolidation_completed: boolean
          created_at: string
          id: string
          lesson_id: number
          module_id: number
          oral_practice_completed: boolean
          score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          consolidation_completed?: boolean
          created_at?: string
          id?: string
          lesson_id: number
          module_id: number
          oral_practice_completed?: boolean
          score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          consolidation_completed?: boolean
          created_at?: string
          id?: string
          lesson_id?: number
          module_id?: number
          oral_practice_completed?: boolean
          score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcard_collections: {
        Row: {
          created_at: string
          id: string
          level: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          name?: string
        }
        Relationships: []
      }
      flashcard_progress: {
        Row: {
          correct_reviews: number
          created_at: string
          due_at: string
          easiness_factor: number
          flashcard_id: string
          id: string
          interval: number
          last_reviewed_at: string | null
          repetitions: number
          total_reviews: number
          updated_at: string
          user_id: string
        }
        Insert: {
          correct_reviews?: number
          created_at?: string
          due_at?: string
          easiness_factor?: number
          flashcard_id: string
          id?: string
          interval?: number
          last_reviewed_at?: string | null
          repetitions?: number
          total_reviews?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          correct_reviews?: number
          created_at?: string
          due_at?: string
          easiness_factor?: number
          flashcard_id?: string
          id?: string
          interval?: number
          last_reviewed_at?: string | null
          repetitions?: number
          total_reviews?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_progress_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          collection_id: string
          created_at: string
          front: string
          id: string
        }
        Insert: {
          back: string
          collection_id: string
          created_at?: string
          front: string
          id?: string
        }
        Update: {
          back?: string
          collection_id?: string
          created_at?: string
          front?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "flashcard_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "conversation_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "conversation_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      live_registrations: {
        Row: {
          created_at: string
          id: string
          live_session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          live_session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          live_session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_registrations_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          class_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          host_id: string
          id: string
          level: string | null
          max_participants: number | null
          meeting_url: string | null
          scheduled_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          host_id: string
          id?: string
          level?: string | null
          max_participants?: number | null
          meeting_url?: string | null
          scheduled_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          host_id?: string
          id?: string
          level?: string | null
          max_participants?: number | null
          meeting_url?: string | null
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string
          email_notifications: boolean
          id: string
          push_notifications: boolean
          study_reminders: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          push_notifications?: boolean
          study_reminders?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          push_notifications?: boolean
          study_reminders?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cefr_level: string | null
          created_at: string
          full_name: string | null
          username: string | null
          id: string
          last_active_at: string | null
          streak: number | null
          updated_at: string
          xp: number | null
        }
        Insert: {
          avatar_url?: string | null
          cefr_level?: string | null
          created_at?: string
          full_name?: string | null
          username?: string | null
          id: string
          last_active_at?: string | null
          streak?: number | null
          updated_at?: string
          xp?: number | null
        }
        Update: {
          avatar_url?: string | null
          cefr_level?: string | null
          created_at?: string
          full_name?: string | null
          username?: string | null
          id?: string
          last_active_at?: string | null
          streak?: number | null
          updated_at?: string
          xp?: number | null
        }
        Relationships: []
      }
      recorded_lives: {
        Row: {
          created_at: string
          description: string | null
          duration: string | null
          host_id: string
          id: string
          level: string | null
          live_session_id: string | null
          thumbnail_url: string | null
          title: string
          video_url: string | null
          views: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration?: string | null
          host_id: string
          id?: string
          level?: string | null
          live_session_id?: string | null
          thumbnail_url?: string | null
          title: string
          video_url?: string | null
          views?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration?: string | null
          host_id?: string
          id?: string
          level?: string | null
          live_session_id?: string | null
          thumbnail_url?: string | null
          title?: string
          video_url?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recorded_lives_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      study_preferences: {
        Row: {
          created_at: string
          daily_goal_minutes: number
          daily_reviews: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_goal_minutes?: number
          daily_reviews?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_goal_minutes?: number
          daily_reviews?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      teacher_classes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          level: string
          name: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          level?: string
          name: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          level?: string
          name?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      class_enrollments: {
        Row: {
          class_id: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_key: string
          id: string
          tier: string
          unlocked_at: string
          user_id: string
          xp_earned: number
        }
        Insert: {
          achievement_key: string
          id?: string
          tier?: string
          unlocked_at?: string
          user_id: string
          xp_earned?: number
        }
        Update: {
          achievement_key?: string
          id?: string
          tier?: string
          unlocked_at?: string
          user_id?: string
          xp_earned?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_demo_role: {
        Args: { _email: string; _user_id: string }
        Returns: undefined
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "teacher", "student"],
    },
  },
} as const
