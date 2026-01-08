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
      focus_goals: {
        Row: {
          achieved_qty: number
          date: string
          description: string
          id: string
          store_id: string
          target_qty: number
        }
        Insert: {
          achieved_qty?: number
          date: string
          description: string
          id?: string
          store_id: string
          target_qty: number
        }
        Update: {
          achieved_qty?: number
          date?: string
          description?: string
          id?: string
          store_id?: string
          target_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "focus_goals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string | null
          id: string
          read_at: string | null
          requires_ack: boolean | null
          sender_name: string
          sender_role: string
          sent_at: string | null
          store_id: string
          subject: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          read_at?: string | null
          requires_ack?: boolean | null
          sender_name: string
          sender_role: string
          sent_at?: string | null
          store_id: string
          subject: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          read_at?: string | null
          requires_ack?: boolean | null
          sender_name?: string
          sender_role?: string
          sent_at?: string | null
          store_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          name: string
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          name: string
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_actuals: {
        Row: {
          amount: number
          date: string
          id: string
          store_id: string
        }
        Insert: {
          amount?: number
          date: string
          id?: string
          store_id: string
        }
        Update: {
          amount?: number
          date?: string
          id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_actuals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_targets: {
        Row: {
          date: string
          id: string
          store_daily_target_amount: number
          store_id: string
        }
        Insert: {
          date: string
          id?: string
          store_daily_target_amount: number
          store_id: string
        }
        Update: {
          date?: string
          id?: string
          store_daily_target_amount?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_targets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      salesperson_actuals: {
        Row: {
          amount: number
          date: string
          id: string
          salesperson_name: string
          store_id: string
        }
        Insert: {
          amount?: number
          date: string
          id?: string
          salesperson_name: string
          store_id: string
        }
        Update: {
          amount?: number
          date?: string
          id?: string
          salesperson_name?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salesperson_actuals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      salesperson_targets: {
        Row: {
          date: string
          id: string
          salesperson_name: string
          store_id: string
          target_amount: number
        }
        Insert: {
          date: string
          id?: string
          salesperson_name: string
          store_id: string
          target_amount: number
        }
        Update: {
          date?: string
          id?: string
          salesperson_name?: string
          store_id?: string
          target_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "salesperson_targets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          city: string
          closing_time: string | null
          code: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          city: string
          closing_time?: string | null
          code: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          city?: string
          closing_time?: string | null
          code?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          file_url: string
          id: string
          task_id: string
          type: string
          uploaded_at: string | null
        }
        Insert: {
          file_url: string
          id?: string
          task_id: string
          type: string
          uploaded_at?: string | null
        }
        Update: {
          file_url?: string
          id?: string
          task_id?: string
          type?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string
          description: string | null
          due_at: string
          id: string
          is_recurring: boolean | null
          priority: Database["public"]["Enums"]["task_priority"]
          recurrence_type: Database["public"]["Enums"]["recurrence_type"] | null
          requires_proof: boolean | null
          status: Database["public"]["Enums"]["task_status"]
          store_id: string
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          due_at: string
          id?: string
          is_recurring?: boolean | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence_type?:
            | Database["public"]["Enums"]["recurrence_type"]
            | null
          requires_proof?: boolean | null
          status?: Database["public"]["Enums"]["task_status"]
          store_id: string
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_at?: string
          id?: string
          is_recurring?: boolean | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence_type?:
            | Database["public"]["Enums"]["recurrence_type"]
            | null
          requires_proof?: boolean | null
          status?: Database["public"]["Enums"]["task_status"]
          store_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
      get_user_store_id: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "store_manager" | "area_manager" | "hq_admin"
      recurrence_type: "daily_opening" | "daily_closing" | "weekly"
      task_priority: "critical" | "high" | "medium" | "low"
      task_status: "pending" | "in_progress" | "completed" | "overdue"
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
      app_role: ["store_manager", "area_manager", "hq_admin"],
      recurrence_type: ["daily_opening", "daily_closing", "weekly"],
      task_priority: ["critical", "high", "medium", "low"],
      task_status: ["pending", "in_progress", "completed", "overdue"],
    },
  },
} as const
