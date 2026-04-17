export type BudgetLevel = 'low' | 'medium' | 'high';

export interface GeneratePlanInput {
  image: string;
  spaceType?: string;
  styleTags?: string[];
  interestTags?: string[];
  budgetLevel?: BudgetLevel;
}

export interface SceneUnderstanding {
  scene_summary: string;
  existing_objects: string[];
  editable_zones: string[];
  keep_zones: string[];
  problem_tags: string[];
  density_level: 'low' | 'medium' | 'high';
  photo_angle_type: 'front' | 'side' | 'top_down' | 'angled';
}

export interface SuggestedItem {
  category: string;
  item_name: string;
  reason: string;
  estimated_price: number;
  priority: 'high' | 'medium' | 'low';
}

export interface BudgetPlan {
  display: number;
  lighting: number;
  storage: number;
  decoration: number;
  total: number;
}

export interface PlanOutput {
  diagnosis_text: string;
  strategy_text: string;
  style_summary: string;
  suggested_items: SuggestedItem[];
  budget_plan: BudgetPlan;
  render_instruction: string;
}

export interface ViewerModel {
  id: string;
  url: string;
  name: string;
  color?: string;
  position: [number, number, number];
  fixed?: boolean;
  bounds?: [number, number, number, number];
}

export interface CornerProjectRecord {
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
}

export interface GeneratePlanResult {
  project: CornerProjectRecord;
  sceneUnderstanding: SceneUnderstanding;
  plan: PlanOutput;
  backgroundUrl: string;
  things: ViewerModel[];
}
