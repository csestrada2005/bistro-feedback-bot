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
      daily_menus: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          main_dish: string
          notes: string | null
          side_dish: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          main_dish: string
          notes?: string | null
          side_dish?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          main_dish?: string
          notes?: string | null
          side_dish?: string | null
        }
        Relationships: []
      }
      pdf_reports: {
        Row: {
          generated_at: string
          generated_by: string | null
          id: string
          pdf_url: string
          period_end: string
          period_start: string
        }
        Insert: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          pdf_url: string
          period_end: string
          period_start: string
        }
        Update: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          pdf_url?: string
          period_end?: string
          period_start?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          id: string
          is_active: boolean
          order_num: number
          question_text: string
          question_type: Database["public"]["Enums"]["question_kind"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          is_active?: boolean
          order_num: number
          question_text: string
          question_type: Database["public"]["Enums"]["question_kind"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          is_active?: boolean
          order_num?: number
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_kind"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      surveys: {
        Row: {
          comment: string | null
          comment_status: Database["public"]["Enums"]["comment_moderation_status"]
          created_at: string
          daily_menu_id: string | null
          device_fingerprint: string
          id: string
          is_flagged: boolean
          question_1_score: number
          question_2_score: number
          question_3_trend: Database["public"]["Enums"]["trend_answer"]
          question_4_recommend: Database["public"]["Enums"]["recommend_answer"]
          response_time_ms: number
        }
        Insert: {
          comment?: string | null
          comment_status?: Database["public"]["Enums"]["comment_moderation_status"]
          created_at?: string
          daily_menu_id?: string | null
          device_fingerprint: string
          id?: string
          is_flagged?: boolean
          question_1_score: number
          question_2_score: number
          question_3_trend: Database["public"]["Enums"]["trend_answer"]
          question_4_recommend: Database["public"]["Enums"]["recommend_answer"]
          response_time_ms: number
        }
        Update: {
          comment?: string | null
          comment_status?: Database["public"]["Enums"]["comment_moderation_status"]
          created_at?: string
          daily_menu_id?: string | null
          device_fingerprint?: string
          id?: string
          is_flagged?: boolean
          question_1_score?: number
          question_2_score?: number
          question_3_trend?: Database["public"]["Enums"]["trend_answer"]
          question_4_recommend?: Database["public"]["Enums"]["recommend_answer"]
          response_time_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "surveys_daily_menu_id_fkey"
            columns: ["daily_menu_id"]
            isOneToOne: false
            referencedRelation: "daily_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "cafeteria_admin" | "hr_viewer"
      comment_moderation_status: "pending" | "approved" | "archived" | "deleted"
      question_kind: "scale_5" | "trend_3" | "recommend_3" | "comment"
      recommend_answer: "no" | "tal_vez" | "si"
      trend_answer: "peor" | "igual" | "mejor"
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
      app_role: ["cafeteria_admin", "hr_viewer"],
      comment_moderation_status: ["pending", "approved", "archived", "deleted"],
      question_kind: ["scale_5", "trend_3", "recommend_3", "comment"],
      recommend_answer: ["no", "tal_vez", "si"],
      trend_answer: ["peor", "igual", "mejor"],
    },
  },
} as const
