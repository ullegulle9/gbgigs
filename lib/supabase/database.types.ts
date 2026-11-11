export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          user_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          venue_id: string;
          title: string;
          description: string | null;
          start_at: string;
          end_at: string | null;
          ticket_url: string | null;
          source_url: string | null;
          source_provider: string | null;
          source_event_id: string | null;
          status: "draft" | "published" | "cancelled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          title: string;
          description?: string | null;
          start_at: string;
          end_at?: string | null;
          ticket_url?: string | null;
          source_url?: string | null;
          source_provider?: string | null;
          source_event_id?: string | null;
          status?: "draft" | "published" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          title?: string;
          description?: string | null;
          start_at?: string;
          end_at?: string | null;
          ticket_url?: string | null;
          source_url?: string | null;
          source_provider?: string | null;
          source_event_id?: string | null;
          status?: "draft" | "published" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      venues: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          website_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          website_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string | null;
          website_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
