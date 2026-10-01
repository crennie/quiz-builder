
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "agent_actors": {
                  Row: {
                    "code": string,"created_at": string,"id": string
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"id": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string
                  }
                  Relationships: [

                  ]
                },"agent_execution_runs": {
                  Row: {
                    "agent_actor_id": string,"created_at": string,"id": string,"metadata": NonNullable<Json>,"model": string,"provider": string,"work_item_id": string
                  }
                  Insert: {
                    "agent_actor_id": string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"model": string,"provider": string,"work_item_id": string
                  }
                  Update: {
                    "agent_actor_id"?: string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"model"?: string,"provider"?: string,"work_item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_execution_runs_agent_actor_id_fkey"
      columns: ["agent_actor_id"]
isOneToOne: false
      referencedRelation: "agent_actors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_execution_runs_work_item_id_fkey"
      columns: ["work_item_id"]
isOneToOne: true
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_generation_runs": {
                  Row: {
                    "agent_actor_id": string,"created_at": string,"id": string,"metadata": NonNullable<Json>,"model": string,"provider": string,"sponsor_id": string,"work_item_id": string
                  }
                  Insert: {
                    "agent_actor_id": string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"model": string,"provider": string,"sponsor_id": string,"work_item_id": string
                  }
                  Update: {
                    "agent_actor_id"?: string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"model"?: string,"provider"?: string,"sponsor_id"?: string,"work_item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_generation_runs_agent_actor_id_fkey"
      columns: ["agent_actor_id"]
isOneToOne: false
      referencedRelation: "agent_actors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_generation_runs_sponsor_id_fkey"
      columns: ["sponsor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_generation_runs_work_item_id_fkey"
      columns: ["work_item_id"]
isOneToOne: true
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    }
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
                    "batch_id": string,"created_at": string,"item_key": string,"position": number,"question_id": string,"question_version_id": string
                  }
                  Insert: {
                    "batch_id": string,"created_at"?: string,"item_key": string,"position": number,"question_id": string,"question_version_id": string
                  }
                  Update: {
                    "batch_id"?: string,"created_at"?: string,"item_key"?: string,"position"?: number,"question_id"?: string,"question_version_id"?: string
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
    },{
      foreignKeyName: "question_batch_items_version_fkey"
      columns: ["question_id","question_version_id"]
isOneToOne: false
      referencedRelation: "question_versions"
      referencedColumns: ["question_id","id"]
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
                },"question_publication_events": {
                  Row: {
                    "actor_id": string | null,"agent_actor_id": string | null,"created_at": string,"event_type": string,"id": string,"policy_snapshot": Json | null,"question_id": string,"question_version_id": string | null
                  }
                  Insert: {
                    "actor_id"?: string | null,"agent_actor_id"?: string | null,"created_at"?: string,"event_type": string,"id"?: string,"policy_snapshot"?: Json | null,"question_id": string,"question_version_id"?: string | null
                  }
                  Update: {
                    "actor_id"?: string | null,"agent_actor_id"?: string | null,"created_at"?: string,"event_type"?: string,"id"?: string,"policy_snapshot"?: Json | null,"question_id"?: string,"question_version_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_publication_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_publication_events_agent_actor_id_fkey"
      columns: ["agent_actor_id"]
isOneToOne: false
      referencedRelation: "agent_actors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_publication_events_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_publication_events_version_fkey"
      columns: ["question_id","question_version_id"]
isOneToOne: false
      referencedRelation: "question_versions"
      referencedColumns: ["question_id","id"]
    }
                  ]
                },"question_publication_gate_decisions": {
                  Row: {
                    "actor_id": string | null,"agent_actor_id": string | null,"agent_execution_run_id": string | null,"created_at": string,"decision": string,"findings": string,"id": string,"policy_snapshot": NonNullable<Json>,"review_decision_id": string,"submission_id": string,"work_item_id": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"agent_actor_id"?: string | null,"agent_execution_run_id"?: string | null,"created_at"?: string,"decision": string,"findings"?: string,"id"?: string,"policy_snapshot": NonNullable<Json>,"review_decision_id": string,"submission_id": string,"work_item_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"agent_actor_id"?: string | null,"agent_execution_run_id"?: string | null,"created_at"?: string,"decision"?: string,"findings"?: string,"id"?: string,"policy_snapshot"?: NonNullable<Json>,"review_decision_id"?: string,"submission_id"?: string,"work_item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_publication_gate_decisions_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_publication_gate_decisions_agent_actor_id_fkey"
      columns: ["agent_actor_id"]
isOneToOne: false
      referencedRelation: "agent_actors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_publication_gate_decisions_agent_execution_run_id_fkey"
      columns: ["agent_execution_run_id"]
isOneToOne: true
      referencedRelation: "agent_execution_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_publication_gate_decisions_review_decision_id_fkey"
      columns: ["review_decision_id"]
isOneToOne: true
      referencedRelation: "question_review_decisions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_publication_gate_decisions_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: true
      referencedRelation: "question_review_submissions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_publication_gate_decisions_work_item_id_fkey"
      columns: ["work_item_id"]
isOneToOne: true
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    }
                  ]
                },"question_review_decisions": {
                  Row: {
                    "actor_id": string | null,"agent_actor_id": string | null,"agent_execution_run_id": string | null,"created_at": string,"decision": string,"findings": string,"id": string,"submission_id": string,"work_item_id": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"agent_actor_id"?: string | null,"agent_execution_run_id"?: string | null,"created_at"?: string,"decision": string,"findings"?: string,"id"?: string,"submission_id": string,"work_item_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"agent_actor_id"?: string | null,"agent_execution_run_id"?: string | null,"created_at"?: string,"decision"?: string,"findings"?: string,"id"?: string,"submission_id"?: string,"work_item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_review_decisions_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_review_decisions_agent_actor_id_fkey"
      columns: ["agent_actor_id"]
isOneToOne: false
      referencedRelation: "agent_actors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_review_decisions_agent_execution_run_id_fkey"
      columns: ["agent_execution_run_id"]
isOneToOne: true
      referencedRelation: "agent_execution_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_review_decisions_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: true
      referencedRelation: "question_review_submissions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_review_decisions_work_item_id_fkey"
      columns: ["work_item_id"]
isOneToOne: true
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    }
                  ]
                },"question_review_submissions": {
                  Row: {
                    "created_at": string,"id": string,"policy_snapshot": NonNullable<Json>,"question_id": string,"question_version_id": string,"submitted_by": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"policy_snapshot": NonNullable<Json>,"question_id": string,"question_version_id": string,"submitted_by": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"policy_snapshot"?: NonNullable<Json>,"question_id"?: string,"question_version_id"?: string,"submitted_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_review_submissions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_review_submissions_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_review_submissions_version_fkey"
      columns: ["question_id","question_version_id"]
isOneToOne: false
      referencedRelation: "question_versions"
      referencedColumns: ["question_id","id"]
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
                },"question_versions": {
                  Row: {
                    "agent_run_id": string | null,"answer_config": NonNullable<Json>,"created_at": string,"created_by": string,"explanation": string | null,"grading_config": NonNullable<Json>,"id": string,"prompt": string,"question_id": string,"question_type": Database["public"]['Enums']["question_type"],"version_number": number
                  }
                  Insert: {
                    "agent_run_id"?: string | null,"answer_config": NonNullable<Json>,"created_at"?: string,"created_by": string,"explanation"?: string | null,"grading_config": NonNullable<Json>,"id"?: string,"prompt": string,"question_id": string,"question_type": Database["public"]['Enums']["question_type"],"version_number": number
                  }
                  Update: {
                    "agent_run_id"?: string | null,"answer_config"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string,"explanation"?: string | null,"grading_config"?: NonNullable<Json>,"id"?: string,"prompt"?: string,"question_id"?: string,"question_type"?: Database["public"]['Enums']["question_type"],"version_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_versions_agent_run_id_fkey"
      columns: ["agent_run_id"]
isOneToOne: true
      referencedRelation: "agent_generation_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_versions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "agent_origin_run_id": string | null,"created_at": string,"created_by": string,"current_version_id": string | null,"default_published_version_id": string | null,"id": string,"status": Database["public"]['Enums']["content_status"],"updated_at": string,"visibility": Database["public"]['Enums']["content_visibility"]
                  }
                  Insert: {
                    "agent_origin_run_id"?: string | null,"created_at"?: string,"created_by": string,"current_version_id"?: string | null,"default_published_version_id"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["content_status"],"updated_at"?: string,"visibility"?: Database["public"]['Enums']["content_visibility"]
                  }
                  Update: {
                    "agent_origin_run_id"?: string | null,"created_at"?: string,"created_by"?: string,"current_version_id"?: string | null,"default_published_version_id"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["content_status"],"updated_at"?: string,"visibility"?: Database["public"]['Enums']["content_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "questions_agent_origin_run_id_fkey"
      columns: ["agent_origin_run_id"]
isOneToOne: true
      referencedRelation: "agent_generation_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "questions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "questions_current_version_fkey"
      columns: ["id","current_version_id"]
isOneToOne: false
      referencedRelation: "question_versions"
      referencedColumns: ["question_id","id"]
    },{
      foreignKeyName: "questions_default_published_version_fkey"
      columns: ["id","default_published_version_id"]
isOneToOne: false
      referencedRelation: "question_versions"
      referencedColumns: ["question_id","id"]
    }
                  ]
                },"quiz_attempt_questions": {
                  Row: {
                    "answer_snapshot": NonNullable<Json>,"answered_at": string | null,"evaluation_result": Json | null,"grading_snapshot": NonNullable<Json>,"id": string,"points_awarded": number | null,"points_possible": number,"position": number,"question_snapshot": NonNullable<Json>,"quiz_attempt_id": string,"quiz_version_question_id": string,"started_at": string | null,"time_spent_ms": number | null,"user_response": Json | null
                  }
                  Insert: {
                    "answer_snapshot": NonNullable<Json>,"answered_at"?: string | null,"evaluation_result"?: Json | null,"grading_snapshot": NonNullable<Json>,"id"?: string,"points_awarded"?: number | null,"points_possible": number,"position": number,"question_snapshot": NonNullable<Json>,"quiz_attempt_id": string,"quiz_version_question_id": string,"started_at"?: string | null,"time_spent_ms"?: number | null,"user_response"?: Json | null
                  }
                  Update: {
                    "answer_snapshot"?: NonNullable<Json>,"answered_at"?: string | null,"evaluation_result"?: Json | null,"grading_snapshot"?: NonNullable<Json>,"id"?: string,"points_awarded"?: number | null,"points_possible"?: number,"position"?: number,"question_snapshot"?: NonNullable<Json>,"quiz_attempt_id"?: string,"quiz_version_question_id"?: string,"started_at"?: string | null,"time_spent_ms"?: number | null,"user_response"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_attempt_questions_quiz_attempt_id_fkey"
      columns: ["quiz_attempt_id"]
isOneToOne: false
      referencedRelation: "quiz_attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_attempt_questions_quiz_version_question_id_fkey"
      columns: ["quiz_version_question_id"]
isOneToOne: false
      referencedRelation: "quiz_version_questions"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_attempts": {
                  Row: {
                    "completed_at": string | null,"id": string,"quiz_version_id": string,"score_summary": Json | null,"settings_snapshot": NonNullable<Json>,"started_at": string,"status": Database["public"]['Enums']["quiz_attempt_status"],"user_id": string
                  }
                  Insert: {
                    "completed_at"?: string | null,"id"?: string,"quiz_version_id": string,"score_summary"?: Json | null,"settings_snapshot": NonNullable<Json>,"started_at"?: string,"status"?: Database["public"]['Enums']["quiz_attempt_status"],"user_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"id"?: string,"quiz_version_id"?: string,"score_summary"?: Json | null,"settings_snapshot"?: NonNullable<Json>,"started_at"?: string,"status"?: Database["public"]['Enums']["quiz_attempt_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_attempts_quiz_version_id_fkey"
      columns: ["quiz_version_id"]
isOneToOne: false
      referencedRelation: "quiz_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_attempts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
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
                },"quiz_version_questions": {
                  Row: {
                    "id": string,"points": number,"position": number,"question_id": string,"question_version_id": string,"quiz_version_id": string,"required": boolean,"time_limit_seconds": number | null
                  }
                  Insert: {
                    "id"?: string,"points": number,"position": number,"question_id": string,"question_version_id": string,"quiz_version_id": string,"required"?: boolean,"time_limit_seconds"?: number | null
                  }
                  Update: {
                    "id"?: string,"points"?: number,"position"?: number,"question_id"?: string,"question_version_id"?: string,"quiz_version_id"?: string,"required"?: boolean,"time_limit_seconds"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_version_questions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_version_questions_question_version_fkey"
      columns: ["question_id","question_version_id"]
isOneToOne: false
      referencedRelation: "question_versions"
      referencedColumns: ["question_id","id"]
    },{
      foreignKeyName: "quiz_version_questions_quiz_version_id_fkey"
      columns: ["quiz_version_id"]
isOneToOne: false
      referencedRelation: "quiz_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_versions": {
                  Row: {
                    "created_at": string,"created_by": string,"description": string | null,"id": string,"quiz_id": string,"settings": NonNullable<Json>,"title": string,"version_number": number
                  }
                  Insert: {
                    "created_at"?: string,"created_by": string,"description"?: string | null,"id"?: string,"quiz_id": string,"settings": NonNullable<Json>,"title": string,"version_number": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"description"?: string | null,"id"?: string,"quiz_id"?: string,"settings"?: NonNullable<Json>,"title"?: string,"version_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_versions_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    }
                  ]
                },"quizzes": {
                  Row: {
                    "created_at": string,"created_by": string,"current_version_id": string | null,"id": string,"status": Database["public"]['Enums']["content_status"],"updated_at": string,"visibility": Database["public"]['Enums']["content_visibility"]
                  }
                  Insert: {
                    "created_at"?: string,"created_by": string,"current_version_id"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["content_status"],"updated_at"?: string,"visibility"?: Database["public"]['Enums']["content_visibility"]
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"current_version_id"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["content_status"],"updated_at"?: string,"visibility"?: Database["public"]['Enums']["content_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "quizzes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quizzes_current_version_fkey"
      columns: ["id","current_version_id"]
isOneToOne: false
      referencedRelation: "quiz_versions"
      referencedColumns: ["quiz_id","id"]
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
                },"work_item_events": {
                  Row: {
                    "actor_id": string | null,"agent_actor_id": string | null,"claim_generation": number,"created_at": string,"details": NonNullable<Json>,"event_type": string,"id": string,"work_item_id": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"agent_actor_id"?: string | null,"claim_generation": number,"created_at"?: string,"details"?: NonNullable<Json>,"event_type": string,"id"?: string,"work_item_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"agent_actor_id"?: string | null,"claim_generation"?: number,"created_at"?: string,"details"?: NonNullable<Json>,"event_type"?: string,"id"?: string,"work_item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_item_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_item_events_agent_actor_id_fkey"
      columns: ["agent_actor_id"]
isOneToOne: false
      referencedRelation: "agent_actors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_item_events_work_item_id_fkey"
      columns: ["work_item_id"]
isOneToOne: false
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    }
                  ]
                },"work_items": {
                  Row: {
                    "assigned_agent_actor_id": string | null,"assigned_to": string,"attempts": number,"claim_generation": number,"claim_token": string | null,"claimed_agent_actor_id": string | null,"claimed_by": string | null,"created_at": string,"id": string,"input": NonNullable<Json>,"item_type": string,"lease_until": string | null,"operation_key": string,"question_id": string | null,"question_version_id": string | null,"queue_name": string,"status": string,"submission_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "assigned_agent_actor_id"?: string | null,"assigned_to": string,"attempts"?: number,"claim_generation"?: number,"claim_token"?: string | null,"claimed_agent_actor_id"?: string | null,"claimed_by"?: string | null,"created_at"?: string,"id"?: string,"input": NonNullable<Json>,"item_type": string,"lease_until"?: string | null,"operation_key": string,"question_id"?: string | null,"question_version_id"?: string | null,"queue_name": string,"status"?: string,"submission_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "assigned_agent_actor_id"?: string | null,"assigned_to"?: string,"attempts"?: number,"claim_generation"?: number,"claim_token"?: string | null,"claimed_agent_actor_id"?: string | null,"claimed_by"?: string | null,"created_at"?: string,"id"?: string,"input"?: NonNullable<Json>,"item_type"?: string,"lease_until"?: string | null,"operation_key"?: string,"question_id"?: string | null,"question_version_id"?: string | null,"queue_name"?: string,"status"?: string,"submission_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_items_assigned_agent_actor_id_fkey"
      columns: ["assigned_agent_actor_id"]
isOneToOne: false
      referencedRelation: "agent_actors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_items_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_items_claimed_agent_actor_id_fkey"
      columns: ["claimed_agent_actor_id"]
isOneToOne: false
      referencedRelation: "agent_actors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_items_claimed_by_fkey"
      columns: ["claimed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_items_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_items_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "question_review_submissions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_items_version_fkey"
      columns: ["question_id","question_version_id"]
isOneToOne: false
      referencedRelation: "question_versions"
      referencedColumns: ["question_id","id"]
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
            "content_status": "draft"|"published"|"archived","content_visibility": "private"|"unlisted"|"public","feedback_category": "incorrect_answer"|"ambiguous_question"|"typo"|"bad_choices"|"unfair_grading"|"too_easy"|"too_hard"|"other","feedback_status": "open"|"reviewed"|"resolved"|"dismissed","question_type": "exact_text"|"multiple_choice_single"|"multiple_choice_multi","quiz_attempt_status": "in_progress"|"completed"|"abandoned"|"expired"
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
            "content_status": ["draft", "published", "archived"],"content_visibility": ["private", "unlisted", "public"],"feedback_category": ["incorrect_answer", "ambiguous_question", "typo", "bad_choices", "unfair_grading", "too_easy", "too_hard", "other"],"feedback_status": ["open", "reviewed", "resolved", "dismissed"],"question_type": ["exact_text", "multiple_choice_single", "multiple_choice_multi"],"quiz_attempt_status": ["in_progress", "completed", "abandoned", "expired"]
          }
        }
} as const

