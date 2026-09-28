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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      feedback: {
        Row: {
          category: Database["public"]["Enums"]["feedback_category"]
          comment: string
          created_at: string
          id: string
          question_id: string | null
          quiz_attempt_question_id: string | null
          quiz_id: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["feedback_status"]
          submitted_by: string
        }
        Insert: {
          category: Database["public"]["Enums"]["feedback_category"]
          comment: string
          created_at?: string
          id?: string
          question_id?: string | null
          quiz_attempt_question_id?: string | null
          quiz_id?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["feedback_status"]
          submitted_by: string
        }
        Update: {
          category?: Database["public"]["Enums"]["feedback_category"]
          comment?: string
          created_at?: string
          id?: string
          question_id?: string | null
          quiz_attempt_question_id?: string | null
          quiz_id?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["feedback_status"]
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_quiz_attempt_question_id_fkey"
            columns: ["quiz_attempt_question_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempt_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_tags: {
        Row: {
          question_id: string
          tag_id: string
        }
        Insert: {
          question_id: string
          tag_id: string
        }
        Update: {
          question_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_tags_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      question_versions: {
        Row: {
          answer_config: Json
          created_at: string
          created_by: string
          explanation: string | null
          grading_config: Json
          id: string
          prompt: string
          question_id: string
          question_type: Database["public"]["Enums"]["question_type"]
          version_number: number
        }
        Insert: {
          answer_config: Json
          created_at?: string
          created_by: string
          explanation?: string | null
          grading_config: Json
          id?: string
          prompt: string
          question_id: string
          question_type: Database["public"]["Enums"]["question_type"]
          version_number: number
        }
        Update: {
          answer_config?: Json
          created_at?: string
          created_by?: string
          explanation?: string | null
          grading_config?: Json
          id?: string
          prompt?: string
          question_id?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_versions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          created_at: string
          created_by: string
          current_version_id: string | null
          id: string
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
          visibility: Database["public"]["Enums"]["content_visibility"]
        }
        Insert: {
          created_at?: string
          created_by: string
          current_version_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Update: {
          created_at?: string
          created_by?: string
          current_version_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_current_version_fkey"
            columns: ["id", "current_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["question_id", "id"]
          },
        ]
      }
      quiz_attempt_questions: {
        Row: {
          answer_snapshot: Json
          answered_at: string | null
          evaluation_result: Json | null
          grading_snapshot: Json
          id: string
          points_awarded: number | null
          points_possible: number
          position: number
          question_snapshot: Json
          quiz_attempt_id: string
          quiz_version_question_id: string
          started_at: string | null
          time_spent_ms: number | null
          user_response: Json | null
        }
        Insert: {
          answer_snapshot: Json
          answered_at?: string | null
          evaluation_result?: Json | null
          grading_snapshot: Json
          id?: string
          points_awarded?: number | null
          points_possible: number
          position: number
          question_snapshot: Json
          quiz_attempt_id: string
          quiz_version_question_id: string
          started_at?: string | null
          time_spent_ms?: number | null
          user_response?: Json | null
        }
        Update: {
          answer_snapshot?: Json
          answered_at?: string | null
          evaluation_result?: Json | null
          grading_snapshot?: Json
          id?: string
          points_awarded?: number | null
          points_possible?: number
          position?: number
          question_snapshot?: Json
          quiz_attempt_id?: string
          quiz_version_question_id?: string
          started_at?: string | null
          time_spent_ms?: number | null
          user_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempt_questions_quiz_attempt_id_fkey"
            columns: ["quiz_attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempt_questions_quiz_version_question_id_fkey"
            columns: ["quiz_version_question_id"]
            isOneToOne: false
            referencedRelation: "quiz_version_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          completed_at: string | null
          id: string
          quiz_version_id: string
          score_summary: Json | null
          settings_snapshot: Json
          started_at: string
          status: Database["public"]["Enums"]["quiz_attempt_status"]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          quiz_version_id: string
          score_summary?: Json | null
          settings_snapshot: Json
          started_at?: string
          status?: Database["public"]["Enums"]["quiz_attempt_status"]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          quiz_version_id?: string
          score_summary?: Json | null
          settings_snapshot?: Json
          started_at?: string
          status?: Database["public"]["Enums"]["quiz_attempt_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_version_id_fkey"
            columns: ["quiz_version_id"]
            isOneToOne: false
            referencedRelation: "quiz_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_tags: {
        Row: {
          quiz_id: string
          tag_id: string
        }
        Insert: {
          quiz_id: string
          tag_id: string
        }
        Update: {
          quiz_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_tags_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_version_questions: {
        Row: {
          id: string
          points: number
          position: number
          question_id: string
          question_version_id: string
          quiz_version_id: string
          required: boolean
          time_limit_seconds: number | null
        }
        Insert: {
          id?: string
          points: number
          position: number
          question_id: string
          question_version_id: string
          quiz_version_id: string
          required?: boolean
          time_limit_seconds?: number | null
        }
        Update: {
          id?: string
          points?: number
          position?: number
          question_id?: string
          question_version_id?: string
          quiz_version_id?: string
          required?: boolean
          time_limit_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_version_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_version_questions_question_version_fkey"
            columns: ["question_id", "question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["question_id", "id"]
          },
          {
            foreignKeyName: "quiz_version_questions_quiz_version_id_fkey"
            columns: ["quiz_version_id"]
            isOneToOne: false
            referencedRelation: "quiz_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_versions: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          quiz_id: string
          settings: Json
          title: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          quiz_id: string
          settings: Json
          title: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          quiz_id?: string
          settings?: Json
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_versions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          created_by: string
          current_version_id: string | null
          id: string
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
          visibility: Database["public"]["Enums"]["content_visibility"]
        }
        Insert: {
          created_at?: string
          created_by: string
          current_version_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Update: {
          created_at?: string
          created_by?: string
          current_version_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_current_version_fkey"
            columns: ["id", "current_version_id"]
            isOneToOne: false
            referencedRelation: "quiz_versions"
            referencedColumns: ["quiz_id", "id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      content_status: "draft" | "published" | "archived"
      content_visibility: "private" | "unlisted" | "public"
      feedback_category:
        | "incorrect_answer"
        | "ambiguous_question"
        | "typo"
        | "bad_choices"
        | "unfair_grading"
        | "too_easy"
        | "too_hard"
        | "other"
      feedback_status: "open" | "reviewed" | "resolved" | "dismissed"
      question_type:
        | "exact_text"
        | "multiple_choice_single"
        | "multiple_choice_multi"
      quiz_attempt_status: "in_progress" | "completed" | "abandoned" | "expired"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      content_status: ["draft", "published", "archived"],
      content_visibility: ["private", "unlisted", "public"],
      feedback_category: [
        "incorrect_answer",
        "ambiguous_question",
        "typo",
        "bad_choices",
        "unfair_grading",
        "too_easy",
        "too_hard",
        "other",
      ],
      feedback_status: ["open", "reviewed", "resolved", "dismissed"],
      question_type: [
        "exact_text",
        "multiple_choice_single",
        "multiple_choice_multi",
      ],
      quiz_attempt_status: ["in_progress", "completed", "abandoned", "expired"],
    },
  },
} as const
