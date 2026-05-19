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
      comedores: {
        Row: {
          activo: boolean
          created_at: string
          empresa_cliente: string
          id: string
          nombre: string
          slug: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          empresa_cliente: string
          id?: string
          nombre: string
          slug: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          empresa_cliente?: string
          id?: string
          nombre?: string
          slug?: string
        }
        Relationships: []
      }
      encuestas: {
        Row: {
          comedor_id: string
          created_at: string
          es_prueba: boolean
          fecha: string
          id: string
        }
        Insert: {
          comedor_id: string
          created_at?: string
          es_prueba?: boolean
          fecha?: string
          id?: string
        }
        Update: {
          comedor_id?: string
          created_at?: string
          es_prueba?: boolean
          fecha?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "encuestas_comedor_id_fkey"
            columns: ["comedor_id"]
            isOneToOne: false
            referencedRelation: "comedores"
            referencedColumns: ["id"]
          },
        ]
      }
      preguntas: {
        Row: {
          activa: boolean
          comedor_id: string | null
          created_at: string
          id: string
          orden: number
          texto: string
          tipo: Database["public"]["Enums"]["pregunta_tipo"]
        }
        Insert: {
          activa?: boolean
          comedor_id?: string | null
          created_at?: string
          id?: string
          orden: number
          texto: string
          tipo: Database["public"]["Enums"]["pregunta_tipo"]
        }
        Update: {
          activa?: boolean
          comedor_id?: string | null
          created_at?: string
          id?: string
          orden?: number
          texto?: string
          tipo?: Database["public"]["Enums"]["pregunta_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "preguntas_comedor_id_fkey"
            columns: ["comedor_id"]
            isOneToOne: false
            referencedRelation: "comedores"
            referencedColumns: ["id"]
          },
        ]
      }
      reportes: {
        Row: {
          analisis_ia: Json | null
          comedor_id: string
          created_at: string
          fecha_desde: string
          fecha_hasta: string
          generado_por: string | null
          id: string
          url_pdf: string | null
        }
        Insert: {
          analisis_ia?: Json | null
          comedor_id: string
          created_at?: string
          fecha_desde: string
          fecha_hasta: string
          generado_por?: string | null
          id?: string
          url_pdf?: string | null
        }
        Update: {
          analisis_ia?: Json | null
          comedor_id?: string
          created_at?: string
          fecha_desde?: string
          fecha_hasta?: string
          generado_por?: string | null
          id?: string
          url_pdf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reportes_comedor_id_fkey"
            columns: ["comedor_id"]
            isOneToOne: false
            referencedRelation: "comedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reportes_generado_por_fkey"
            columns: ["generado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      respuestas: {
        Row: {
          created_at: string
          encuesta_id: string
          id: string
          pregunta_id: string
          valor_booleano: boolean | null
          valor_numerico: number | null
          valor_texto: string | null
        }
        Insert: {
          created_at?: string
          encuesta_id: string
          id?: string
          pregunta_id: string
          valor_booleano?: boolean | null
          valor_numerico?: number | null
          valor_texto?: string | null
        }
        Update: {
          created_at?: string
          encuesta_id?: string
          id?: string
          pregunta_id?: string
          valor_booleano?: boolean | null
          valor_numerico?: number | null
          valor_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "respuestas_encuesta_id_fkey"
            columns: ["encuesta_id"]
            isOneToOne: false
            referencedRelation: "encuestas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respuestas_pregunta_id_fkey"
            columns: ["pregunta_id"]
            isOneToOne: false
            referencedRelation: "preguntas"
            referencedColumns: ["id"]
          },
        ]
      }
      rum_metrics: {
        Row: {
          comedor_id: string | null
          connection_type: string | null
          created_at: string
          device_type: string | null
          dom_interactive_ms: number | null
          fcp_ms: number | null
          id: string
          lcp_ms: number | null
          load_ms: number | null
          slug: string
          ttfb_ms: number | null
          user_agent: string | null
          viewport_h: number | null
          viewport_w: number | null
        }
        Insert: {
          comedor_id?: string | null
          connection_type?: string | null
          created_at?: string
          device_type?: string | null
          dom_interactive_ms?: number | null
          fcp_ms?: number | null
          id?: string
          lcp_ms?: number | null
          load_ms?: number | null
          slug: string
          ttfb_ms?: number | null
          user_agent?: string | null
          viewport_h?: number | null
          viewport_w?: number | null
        }
        Update: {
          comedor_id?: string | null
          connection_type?: string | null
          created_at?: string
          device_type?: string | null
          dom_interactive_ms?: number | null
          fcp_ms?: number | null
          id?: string
          lcp_ms?: number | null
          load_ms?: number | null
          slug?: string
          ttfb_ms?: number | null
          user_agent?: string | null
          viewport_h?: number | null
          viewport_w?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rum_metrics_comedor_id_fkey"
            columns: ["comedor_id"]
            isOneToOne: false
            referencedRelation: "comedores"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          comedor_id: string | null
          created_at: string
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["user_rol"]
        }
        Insert: {
          comedor_id?: string | null
          created_at?: string
          id: string
          nombre?: string
          rol: Database["public"]["Enums"]["user_rol"]
        }
        Update: {
          comedor_id?: string | null
          created_at?: string
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["user_rol"]
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_comedor_id_fkey"
            columns: ["comedor_id"]
            isOneToOne: false
            referencedRelation: "comedores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_comedor: { Args: never; Returns: string }
      current_user_rol: {
        Args: never
        Returns: Database["public"]["Enums"]["user_rol"]
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      pregunta_tipo: "escala_5" | "si_no" | "texto_abierto" | "texto_multiple_3"
      question_kind: "scale_5" | "trend_3" | "recommend_3" | "comment"
      user_rol: "admin" | "operador"
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
      pregunta_tipo: ["escala_5", "si_no", "texto_abierto", "texto_multiple_3"],
      question_kind: ["scale_5", "trend_3", "recommend_3", "comment"],
      user_rol: ["admin", "operador"],
    },
  },
} as const
