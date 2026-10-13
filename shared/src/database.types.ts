
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "courses": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"feedback": {
                  Row: {
                    "category": Database["public"]['Enums']["feedback_category"],"comment": string,"created_at": string,"id": string,"question_id": string | null,"quiz_attempt_question_id": string | null,"quiz_id": string | null,"reviewed_at": string | null,"status": Database["public"]['Enums']["feedback_status"],"submitted_by": string
                  }
                  Insert: {
                    "category": Database["public"]['Enums']["feedback_category"],"comment": string,"created_at"?: string,"id"?: string,"question_id"?: string | null,"quiz_attempt_question_id"?: string | null,"quiz_id"?: string | null,"reviewed_at"?: string | null,"status"?: Database["public"]['Enums']["feedback_status"],"submitted_by": string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["feedback_category"],"comment"?: string,"created_at"?: string,"id"?: string,"question_id"?: string | null,"quiz_attempt_question_id"?: string | null,"quiz_id"?: string | null,"reviewed_at"?: string | null,"status"?: Database["public"]['Enums']["feedback_status"],"submitted_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "feedback_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_quiz_attempt_question_id_fkey"
      columns: ["quiz_attempt_question_id"]
isOneToOne: false
      referencedRelation: "quiz_attempt_questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"lesson_quizzes": {
                  Row: {
                    "lesson_id": string,"position": number,"quiz_id": string
                  }
                  Insert: {
                    "lesson_id": string,"position": number,"quiz_id": string
                  }
                  Update: {
                    "lesson_id"?: string,"position"?: number,"quiz_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_quizzes_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_quizzes_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    }
                  ]
                },"lessons": {
                  Row: {
                    "content": string,"course_id": string,"created_at": string,"description": string | null,"id": string,"position": number,"title": string,"updated_at": string
                  }
                  Insert: {
                    "content"?: string,"course_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"position": number,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "content"?: string,"course_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"position"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lessons_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string,"id": string,"updated_at": string
                  }
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name": string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"question_batch_items": {
                  Row: {
                    "batch_id": string,"created_at": string,"item_key": string,"position": number,"question_id": string
                  }
                  Insert: {
                    "batch_id": string,"created_at"?: string,"item_key": string,"position": number,"question_id": string
                  }
                  Update: {
                    "batch_id"?: string,"created_at"?: string,"item_key"?: string,"position"?: number,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_batch_items_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "question_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_batch_items_question_id_fkey"
      columns: ["question_id"]
isOneToOne: true
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"question_batches": {
                  Row: {
                    "artifact": NonNullable<Json>,"artifact_sha256": string,"batch_key": string,"created_at": string,"id": string,"sponsor_id": string
                  }
                  Insert: {
                    "artifact": NonNullable<Json>,"artifact_sha256": string,"batch_key": string,"created_at"?: string,"id"?: string,"sponsor_id": string
                  }
                  Update: {
                    "artifact"?: NonNullable<Json>,"artifact_sha256"?: string,"batch_key"?: string,"created_at"?: string,"id"?: string,"sponsor_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_batches_sponsor_id_fkey"
      columns: ["sponsor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"question_tags": {
                  Row: {
                    "question_id": string,"tag_id": string
                  }
                  Insert: {
                    "question_id": string,"tag_id": string
                  }
                  Update: {
                    "question_id"?: string,"tag_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_tags_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_tags_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "answer_config": NonNullable<Json>,"content_locked_at": string | null,"created_at": string,"created_by": string,"explanation": string | null,"grading_config": NonNullable<Json>,"id": string,"prompt": string,"question_type": Database["public"]['Enums']["question_type"],"updated_at": string,"visibility": Database["public"]['Enums']["content_visibility"]
                  }
                  Insert: {
                    "answer_config": NonNullable<Json>,"content_locked_at"?: string | null,"created_at"?: string,"created_by": string,"explanation"?: string | null,"grading_config": NonNullable<Json>,"id"?: string,"prompt": string,"question_type": Database["public"]['Enums']["question_type"],"updated_at"?: string,"visibility"?: Database["public"]['Enums']["content_visibility"]
                  }
                  Update: {
                    "answer_config"?: NonNullable<Json>,"content_locked_at"?: string | null,"created_at"?: string,"created_by"?: string,"explanation"?: string | null,"grading_config"?: NonNullable<Json>,"id"?: string,"prompt"?: string,"question_type"?: Database["public"]['Enums']["question_type"],"updated_at"?: string,"visibility"?: Database["public"]['Enums']["content_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "questions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_attempt_questions": {
                  Row: {
                    "answer_snapshot": NonNullable<Json>,"answered_at": string | null,"evaluation_result": Json | null,"grading_snapshot": NonNullable<Json>,"id": string,"points_awarded": number | null,"points_possible": number,"position": number,"question_id": string,"question_snapshot": NonNullable<Json>,"quiz_attempt_id": string,"required": boolean,"started_at": string | null,"time_limit_seconds": number | null,"time_spent_ms": number | null,"user_response": Json | null
                  }
                  Insert: {
                    "answer_snapshot": NonNullable<Json>,"answered_at"?: string | null,"evaluation_result"?: Json | null,"grading_snapshot": NonNullable<Json>,"id"?: string,"points_awarded"?: number | null,"points_possible": number,"position": number,"question_id": string,"question_snapshot": NonNullable<Json>,"quiz_attempt_id": string,"required": boolean,"started_at"?: string | null,"time_limit_seconds"?: number | null,"time_spent_ms"?: number | null,"user_response"?: Json | null
                  }
                  Update: {
                    "answer_snapshot"?: NonNullable<Json>,"answered_at"?: string | null,"evaluation_result"?: Json | null,"grading_snapshot"?: NonNullable<Json>,"id"?: string,"points_awarded"?: number | null,"points_possible"?: number,"position"?: number,"question_id"?: string,"question_snapshot"?: NonNullable<Json>,"quiz_attempt_id"?: string,"required"?: boolean,"started_at"?: string | null,"time_limit_seconds"?: number | null,"time_spent_ms"?: number | null,"user_response"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_attempt_questions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_attempt_questions_quiz_attempt_id_fkey"
      columns: ["quiz_attempt_id"]
isOneToOne: false
      referencedRelation: "quiz_attempts"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_attempts": {
                  Row: {
                    "completed_at": string | null,"id": string,"quiz_id": string,"quiz_title_snapshot": string,"score_summary": Json | null,"settings_snapshot": NonNullable<Json>,"started_at": string,"status": Database["public"]['Enums']["quiz_attempt_status"],"user_id": string
                  }
                  Insert: {
                    "completed_at"?: string | null,"id"?: string,"quiz_id": string,"quiz_title_snapshot": string,"score_summary"?: Json | null,"settings_snapshot": NonNullable<Json>,"started_at"?: string,"status"?: Database["public"]['Enums']["quiz_attempt_status"],"user_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"id"?: string,"quiz_id"?: string,"quiz_title_snapshot"?: string,"score_summary"?: Json | null,"settings_snapshot"?: NonNullable<Json>,"started_at"?: string,"status"?: Database["public"]['Enums']["quiz_attempt_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_attempts_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_attempts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_questions": {
                  Row: {
                    "id": string,"points": number,"position": number,"question_id": string,"quiz_id": string,"required": boolean,"time_limit_seconds": number | null
                  }
                  Insert: {
                    "id"?: string,"points": number,"position": number,"question_id": string,"quiz_id": string,"required"?: boolean,"time_limit_seconds"?: number | null
                  }
                  Update: {
                    "id"?: string,"points"?: number,"position"?: number,"question_id"?: string,"quiz_id"?: string,"required"?: boolean,"time_limit_seconds"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_questions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_questions_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_tags": {
                  Row: {
                    "quiz_id": string,"tag_id": string
                  }
                  Insert: {
                    "quiz_id": string,"tag_id": string
                  }
                  Update: {
                    "quiz_id"?: string,"tag_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_tags_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_tags_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id"]
    }
                  ]
                },"quizzes": {
                  Row: {
                    "created_at": string,"created_by": string,"description": string | null,"id": string,"settings": NonNullable<Json>,"title": string,"updated_at": string,"visibility": Database["public"]['Enums']["content_visibility"]
                  }
                  Insert: {
                    "created_at"?: string,"created_by": string,"description"?: string | null,"id"?: string,"settings": NonNullable<Json>,"title": string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["content_visibility"]
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"description"?: string | null,"id"?: string,"settings"?: NonNullable<Json>,"title"?: string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["content_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "quizzes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tags": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"name": string,"slug": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by": string,"id"?: string,"name": string,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tags_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
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
            "content_visibility": "private"|"public","feedback_category": "incorrect_answer"|"ambiguous_question"|"typo"|"bad_choices"|"unfair_grading"|"too_easy"|"too_hard"|"other","feedback_status": "open"|"reviewed"|"resolved"|"dismissed","question_type": "exact_text"|"multiple_choice_single"|"multiple_choice_multi","quiz_attempt_status": "in_progress"|"completed"|"abandoned"|"expired"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "content_visibility": ["private", "public"],"feedback_category": ["incorrect_answer", "ambiguous_question", "typo", "bad_choices", "unfair_grading", "too_easy", "too_hard", "other"],"feedback_status": ["open", "reviewed", "resolved", "dismissed"],"question_type": ["exact_text", "multiple_choice_single", "multiple_choice_multi"],"quiz_attempt_status": ["in_progress", "completed", "abandoned", "expired"]
          }
        }
} as const

