export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
          role: "user" | "manager" | "moderator" | "admin";
          xp: number;
          level: number;
          fantasy_points: number;
          favorite_player: string | null;
          supporter_branch: string | null;
          phone: string | null;
          bio: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: "user" | "manager" | "moderator" | "admin";
          xp?: number;
          level?: number;
          fantasy_points?: number;
          phone?: string | null;
          favorite_player?: string | null;
          supporter_branch?: string | null;
          bio?: string | null;
        };
        Update: {
          username?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          // role, level, xp, fantasy_points are locked — only service_role can change them
          favorite_player?: string | null;
          supporter_branch?: string | null;
          bio?: string | null;
        };
      };
      teams: {
        Row: {
          id: string;
          name: string;
          short_name: string;
          city: string | null;
          primary_color: string;
          crest_url: string | null;
          created_at: string;
        };
        Insert: {
          name: string;
          short_name: string;
          city?: string | null;
          primary_color?: string;
          crest_url?: string | null;
        };
        Update: {
          name?: string;
          short_name?: string;
          city?: string | null;
          primary_color?: string;
          crest_url?: string | null;
        };
      };
      players: {
        Row: {
          id: string;
          name: string;
          position: "GK" | "DEF" | "MID" | "FWD";
          club: string;
          price: number;
          image_url: string | null;
          total_points: number;
          goals: number;
          assists: number;
          clean_sheets: number;
          yellow_cards: number;
          red_cards: number;
          minutes_played: number;
          ownership_percent: number;
          form: number;
          is_injured: boolean;
          created_at: string;
        };
        Insert: {
          name: string;
          position: "GK" | "DEF" | "MID" | "FWD";
          club: string;
          price: number;
          image_url?: string | null;
          total_points?: number;
          goals?: number;
          assists?: number;
          clean_sheets?: number;
          yellow_cards?: number;
          red_cards?: number;
          minutes_played?: number;
          ownership_percent?: number;
          form?: number;
          is_injured?: boolean;
        };
        Update: {
          name?: string;
          position?: "GK" | "DEF" | "MID" | "FWD";
          club?: string;
          price?: number;
          image_url?: string | null;
          total_points?: number;
          goals?: number;
          assists?: number;
          clean_sheets?: number;
          yellow_cards?: number;
          red_cards?: number;
          minutes_played?: number;
          ownership_percent?: number;
          form?: number;
          is_injured?: boolean;
        };
      };
      fantasy_teams: {
        Row: {
          id: string;
          user_id: string;
          team_name: string;
          formation: "4-3-3" | "4-4-2" | "3-5-2" | "5-3-2";
          total_points: number;
          weekly_points: number;
          budget_remaining: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          team_name: string;
          formation?: "4-3-3" | "4-4-2" | "3-5-2" | "5-3-2";
          total_points?: number;
          weekly_points?: number;
          budget_remaining?: number;
        };
        Update: {
          team_name?: string;
          formation?: "4-3-3" | "4-4-2" | "3-5-2" | "5-3-2";
          total_points?: number;
          weekly_points?: number;
          budget_remaining?: number;
        };
      };
      fantasy_team_players: {
        Row: {
          id: string;
          fantasy_team_id: string;
          player_id: string;
          is_captain: boolean;
          is_vice_captain: boolean;
          is_starting: boolean;
          bench_order: number | null;
          created_at: string;
        };
        Insert: {
          fantasy_team_id: string;
          player_id: string;
          is_captain?: boolean;
          is_vice_captain?: boolean;
          is_starting?: boolean;
          bench_order?: number | null;
        };
        Update: {
          is_captain?: boolean;
          is_vice_captain?: boolean;
          is_starting?: boolean;
          bench_order?: number | null;
        };
      };
      leagues: {
        Row: {
          id: string;
          name: string;
          type: "public" | "private";
          invite_code: string | null;
          owner_id: string;
          description: string | null;
          max_members: number;
          prizes: Json | null;
          created_at: string;
        };
        Insert: {
          name: string;
          type?: "public" | "private";
          invite_code?: string | null;
          owner_id: string;
          description?: string | null;
          max_members?: number;
          prizes?: Json | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          max_members?: number;
          prizes?: Json | null;
        };
      };
      league_members: {
        Row: {
          id: string;
          league_id: string;
          user_id: string;
          points: number;
          weekly_points: number;
          rank: number;
          joined_at: string;
        };
        Insert: {
          league_id: string;
          user_id: string;
          points?: number;
          weekly_points?: number;
          rank?: number;
        };
        Update: {
          points?: number;
          weekly_points?: number;
          rank?: number;
        };
      };
      matches: {
        Row: {
          id: string;
          home_team: string;
          away_team: string;
          home_score: number | null;
          away_score: number | null;
          kickoff_time: string;
          status: "scheduled" | "live" | "finished" | "postponed";
          matchday: number;
          season: string;
          created_at: string;
        };
        Insert: {
          home_team: string;
          away_team: string;
          kickoff_time: string;
          status?: "scheduled" | "live" | "finished" | "postponed";
          matchday?: number;
          season?: string;
        };
        Update: {
          home_score?: number | null;
          away_score?: number | null;
          status?: "scheduled" | "live" | "finished" | "postponed";
        };
      };
      player_match_stats: {
        Row: {
          id: string;
          player_id: string;
          match_id: string;
          goals: number;
          assists: number;
          yellow_cards: number;
          red_cards: number;
          clean_sheet: boolean;
          minutes_played: number;
          fantasy_points: number;
          created_at: string;
        };
        Insert: {
          player_id: string;
          match_id: string;
          goals?: number;
          assists?: number;
          yellow_cards?: number;
          red_cards?: number;
          clean_sheet?: boolean;
          minutes_played?: number;
          fantasy_points?: number;
        };
        Update: {
          goals?: number;
          assists?: number;
          yellow_cards?: number;
          red_cards?: number;
          clean_sheet?: boolean;
          minutes_played?: number;
          fantasy_points?: number;
        };
      };
      match_events: {
        Row: {
          id: string;
          match_id: string;
          player_id: string | null;
          player_name: string;
          event_type: "goal" | "own_goal" | "assist" | "yellow_card" | "red_card";
          side: "home" | "away";
          minute: number;
          created_at: string;
        };
        Insert: {
          match_id: string;
          player_id?: string | null;
          player_name: string;
          event_type: "goal" | "own_goal" | "assist" | "yellow_card" | "red_card";
          side: "home" | "away";
          minute?: number;
        };
        Update: Record<string, never>;
      };
      chat_messages: {
        Row: {
          id: string;
          user_id: string;
          league_id: string | null;
          match_id: string | null;
          message: string;
          reactions: Json;
          created_at: string;
        };
        Insert: {
          user_id: string;
          league_id?: string | null;
          match_id?: string | null;
          message: string;
        };
        Update: {
          message?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          type: "match" | "transfer" | "goal" | "league" | "reward" | "system";
          read: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          title: string;
          body: string;
          type?: "match" | "transfer" | "goal" | "league" | "reward" | "system";
          read?: boolean;
        };
        Update: {
          read?: boolean;
        };
      };
      achievements: {
        Row: {
          id: string;
          user_id: string;
          badge_key: string;
          badge_name: string;
          badge_description: string;
          badge_icon: string;
          unlocked_at: string;
        };
        Insert: {
          user_id: string;
          badge_key: string;
          badge_name: string;
          badge_description: string;
          badge_icon: string;
        };
        Update: Record<string, never>;
      };
      polls: {
        Row: {
          id: string;
          question: string;
          options: Json;
          votes: Json;
          match_id: string | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          question: string;
          options: Json;
          votes?: Json;
          match_id?: string | null;
          expires_at?: string | null;
        };
        Update: {
          votes?: Json;
        };
      };
      poll_votes: {
        Row: {
          id: string;
          poll_id: string;
          user_id: string;
          option: string;
          created_at: string;
        };
        Insert: {
          poll_id: string;
          user_id: string;
          option: string;
        };
        Update: Record<string, never>;
      };
      app_config: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
        };
        Update: {
          value?: Json;
        };
      };
      user_settings: {
        Row: {
          user_id: string;
          email_notifications: boolean;
          push_notifications: boolean;
          marketing_emails: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email_notifications?: boolean;
          push_notifications?: boolean;
          marketing_emails?: boolean;
        };
        Update: {
          email_notifications?: boolean;
          push_notifications?: boolean;
          marketing_emails?: boolean;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Profile = Tables<"profiles">;
export type Team = Tables<"teams">;
export type Player = Tables<"players">;
export type FantasyTeam = Tables<"fantasy_teams">;
export type FantasyTeamPlayer = Tables<"fantasy_team_players">;
export type League = Tables<"leagues">;
export type LeagueMember = Tables<"league_members">;
export type Match = Tables<"matches">;
export type PlayerMatchStats = Tables<"player_match_stats">;
export type MatchEvent = Tables<"match_events">;
export type ChatMessage = Tables<"chat_messages">;
export type Notification = Tables<"notifications">;
export type Achievement = Tables<"achievements">;
export type Poll = Tables<"polls">;
export type PollVote = Tables<"poll_votes">;
