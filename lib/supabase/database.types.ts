import type { BudgetLevel, PlanOutput, SceneUnderstanding, ViewerModel } from '@/lib/corner/types';

export interface Database {
  public: {
    Tables: {
      corner_projects: {
        Row: {
          id: string;
          status: 'processing' | 'completed' | 'failed';
          source_image_data: string;
          space_type: string;
          style_tags: string[];
          interest_tags: string[];
          budget_level: BudgetLevel;
          scene_understanding: SceneUnderstanding | null;
          plan_output: PlanOutput | null;
          background_url: string | null;
          viewer_models: ViewerModel[] | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          status?: 'processing' | 'completed' | 'failed';
          source_image_data: string;
          space_type?: string;
          style_tags?: string[];
          interest_tags?: string[];
          budget_level?: BudgetLevel;
          scene_understanding?: SceneUnderstanding | null;
          plan_output?: PlanOutput | null;
          background_url?: string | null;
          viewer_models?: ViewerModel[] | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          status?: 'processing' | 'completed' | 'failed';
          source_image_data?: string;
          space_type?: string;
          style_tags?: string[];
          interest_tags?: string[];
          budget_level?: BudgetLevel;
          scene_understanding?: SceneUnderstanding | null;
          plan_output?: PlanOutput | null;
          background_url?: string | null;
          viewer_models?: ViewerModel[] | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
