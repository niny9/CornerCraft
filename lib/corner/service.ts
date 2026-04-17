import {
  CornerProjectRecord,
  GeneratePlanInput,
  GeneratePlanResult,
  PlanOutput,
  SceneUnderstanding,
  ViewerModel,
} from '@/lib/corner/types';
import { getSupabaseAdmin } from '@/lib/supabase/server';

const DEFAULT_SPACE_TYPE = 'desk_corner';
const DEFAULT_STYLE_TAGS = ['minimal'];
const DEFAULT_INTEREST_TAGS = ['productivity'];
const DEFAULT_BUDGET_LEVEL = 'medium';

function normalizeTags(value: string[] | undefined, fallback: string[]) {
  if (!value || value.length === 0) return fallback;
  return value.map((item) => item.trim()).filter(Boolean).slice(0, 5);
}

function buildSceneUnderstanding(input: Required<Omit<GeneratePlanInput, 'image'>>) {
  const densityLevel: SceneUnderstanding['density_level'] = input.budgetLevel === 'low' ? 'medium' : 'high';

  return {
    scene_summary: `这是一个以 ${input.spaceType} 为主的小空间角落，当前适合做轻量软装和收纳优化。`,
    existing_objects: ['desk', 'wall', 'daily_items'],
    editable_zones: ['wall', 'desktop_back', 'desktop_left', 'desktop_right'],
    keep_zones: ['main_work_surface', 'chair_area'],
    problem_tags: ['cluttered_surface', 'weak_lighting', 'lack_of_display'],
    density_level: densityLevel,
    photo_angle_type: 'angled',
  } satisfies SceneUnderstanding;
}

function buildSuggestedItems(input: Required<Omit<GeneratePlanInput, 'image'>>) {
  const budgetFactor = input.budgetLevel === 'low' ? 0.75 : input.budgetLevel === 'high' ? 1.35 : 1;

  return [
    {
      category: 'lighting',
      item_name: '暖光氛围台灯',
      reason: '补足角落纵深和夜间层次，让空间更适合拍照和日常使用。',
      estimated_price: Math.round(129 * budgetFactor),
      priority: 'high' as const,
    },
    {
      category: 'storage',
      item_name: '双层桌面收纳架',
      reason: '把零散物件抬高分层，释放主操作区。',
      estimated_price: Math.round(99 * budgetFactor),
      priority: 'high' as const,
    },
    {
      category: 'display',
      item_name: `${input.styleTags[0]} 风格桌面摆件`,
      reason: `强化 ${input.styleTags.join(' / ')} 的视觉记忆点，让角落更完整。`,
      estimated_price: Math.round(79 * budgetFactor),
      priority: 'medium' as const,
    },
    {
      category: 'decoration',
      item_name: `${input.interestTags[0]} 主题墙面海报`,
      reason: `把 ${input.interestTags.join(' / ')} 兴趣标签转成结果页可感知的风格元素。`,
      estimated_price: Math.round(49 * budgetFactor),
      priority: 'medium' as const,
    },
  ];
}

function buildPlanOutput(
  input: Required<Omit<GeneratePlanInput, 'image'>>,
  scene: SceneUnderstanding,
): PlanOutput {
  const suggestedItems = buildSuggestedItems(input);
  const total = suggestedItems.reduce((sum, item) => sum + item.estimated_price, 0);
  const budgetPlan = {
    display: suggestedItems.filter((item) => item.category === 'display').reduce((sum, item) => sum + item.estimated_price, 0),
    lighting: suggestedItems.filter((item) => item.category === 'lighting').reduce((sum, item) => sum + item.estimated_price, 0),
    storage: suggestedItems.filter((item) => item.category === 'storage').reduce((sum, item) => sum + item.estimated_price, 0),
    decoration: suggestedItems.filter((item) => item.category === 'decoration').reduce((sum, item) => sum + item.estimated_price, 0),
    total,
  };

  return {
    diagnosis_text: `当前角落存在 ${scene.problem_tags.slice(0, 2).join('、')} 的问题，视觉焦点和功能分区都还不够明确。`,
    strategy_text: '优先清理桌面主操作区，再通过灯光、层架和轻装饰建立一个可拍照也可日常使用的稳定角落。',
    style_summary: `${input.styleTags.join(' / ')}，并融入 ${input.interestTags.join(' / ')} 的个性表达。`,
    suggested_items: suggestedItems,
    budget_plan: budgetPlan,
    render_instruction: `保留原空间结构和视角，在 ${scene.editable_zones.join('、')} 区域加入 ${suggestedItems.map((item) => item.item_name).join('、')}，风格为 ${input.styleTags.join(' / ')}，预算档位 ${input.budgetLevel}。`,
  };
}

function buildViewerModels(plan: PlanOutput): ViewerModel[] {
  const tableSurface: [number, number, number, number] = [0.25, 0.3, 0.75, 0.45];
  const accents = ['#f5b971', '#79c2d0', '#f28c8c'];

  return [
    { id: 'table-1', name: '桌面', url: '/table.glb', position: [0.5, 0.35, 0], fixed: true },
    ...plan.suggested_items.slice(0, 3).map((item, index) => ({
      id: `item-${index + 1}`,
      name: item.item_name,
      url: '/cup.glb',
      color: accents[index],
      position: [0.38 + index * 0.12, 0.38, 0] as [number, number, number],
      bounds: tableSurface,
    })),
  ];
}

function buildStoredRecord(
  base: Omit<CornerProjectRecord, 'id' | 'created_at' | 'updated_at'>,
  overrides?: Partial<CornerProjectRecord>,
): Omit<CornerProjectRecord, 'id' | 'created_at' | 'updated_at'> {
  return {
    status: base.status,
    source_image_data: base.source_image_data,
    space_type: base.space_type,
    style_tags: base.style_tags,
    interest_tags: base.interest_tags,
    budget_level: base.budget_level,
    scene_understanding: base.scene_understanding,
    plan_output: base.plan_output,
    background_url: base.background_url,
    viewer_models: base.viewer_models,
    error_message: base.error_message,
    ...overrides,
  };
}

function projectRowSelect() {
  return 'id,status,source_image_data,space_type,style_tags,interest_tags,budget_level,scene_understanding,plan_output,background_url,viewer_models,error_message,created_at,updated_at';
}

function normalizeInput(input: GeneratePlanInput) {
  return {
    image: input.image,
    spaceType: input.spaceType?.trim() || DEFAULT_SPACE_TYPE,
    styleTags: normalizeTags(input.styleTags, DEFAULT_STYLE_TAGS),
    interestTags: normalizeTags(input.interestTags, DEFAULT_INTEREST_TAGS),
    budgetLevel: input.budgetLevel || DEFAULT_BUDGET_LEVEL,
  } as const;
}

export function validateGenerateInput(input: unknown): GeneratePlanInput {
  if (!input || typeof input !== 'object') {
    throw new Error('请求体必须是对象。');
  }

  const record = input as Record<string, unknown>;
  if (typeof record.image !== 'string' || record.image.length < 20) {
    throw new Error('缺少有效图片数据。');
  }

  const budget = record.budgetLevel;
  if (budget && budget !== 'low' && budget !== 'medium' && budget !== 'high') {
    throw new Error('budgetLevel 必须是 low、medium 或 high。');
  }

  return {
    image: record.image,
    spaceType: typeof record.spaceType === 'string' ? record.spaceType : undefined,
    styleTags: Array.isArray(record.styleTags) ? record.styleTags.filter((item): item is string => typeof item === 'string') : undefined,
    interestTags: Array.isArray(record.interestTags) ? record.interestTags.filter((item): item is string => typeof item === 'string') : undefined,
    budgetLevel: budget as GeneratePlanInput['budgetLevel'],
  };
}

export async function generateCornerPlan(input: GeneratePlanInput): Promise<GeneratePlanResult> {
  const normalized = normalizeInput(input);
  const supabase = getSupabaseAdmin();

  const baseRecord = buildStoredRecord({
    status: 'processing',
    source_image_data: normalized.image,
    space_type: normalized.spaceType,
    style_tags: normalized.styleTags,
    interest_tags: normalized.interestTags,
    budget_level: normalized.budgetLevel,
    scene_understanding: null,
    plan_output: null,
    background_url: null,
    viewer_models: null,
    error_message: null,
  });

  const inserted = await supabase
    .from('corner_projects')
    .insert(baseRecord)
    .select(projectRowSelect())
    .single();

  if (inserted.error || !inserted.data) {
    throw new Error(`创建项目失败: ${inserted.error?.message ?? 'unknown'}`);
  }
  const createdProject = inserted.data as unknown as CornerProjectRecord;

  const sceneUnderstanding = buildSceneUnderstanding(normalized);
  const plan = buildPlanOutput(normalized, sceneUnderstanding);
  const viewerModels = buildViewerModels(plan);
  const backgroundUrl = '/bg.glb';

  const updated = await supabase
    .from('corner_projects')
    .update(buildStoredRecord(baseRecord, {
      status: 'completed',
      scene_understanding: sceneUnderstanding,
      plan_output: plan,
      background_url: backgroundUrl,
      viewer_models: viewerModels,
    }))
    .eq('id', createdProject.id)
    .select(projectRowSelect())
    .single();

  if (updated.error || !updated.data) {
    throw new Error(`更新项目失败: ${updated.error?.message ?? 'unknown'}`);
  }

  return {
    project: updated.data as unknown as CornerProjectRecord,
    sceneUnderstanding,
    plan,
    backgroundUrl,
    things: viewerModels,
  };
}

export async function markProjectFailed(projectId: string, message: string) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from('corner_projects')
    .update({ status: 'failed', error_message: message })
    .eq('id', projectId);
}

export async function listCornerProjects(limit = 10) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from('corner_projects')
    .select(projectRowSelect())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (result.error) {
    throw new Error(`读取项目列表失败: ${result.error.message}`);
  }

  return result.data as unknown as CornerProjectRecord[];
}

export async function getCornerProjectById(id: string) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from('corner_projects')
    .select(projectRowSelect())
    .eq('id', id)
    .single();

  if (result.error) {
    throw new Error(`读取项目详情失败: ${result.error.message}`);
  }

  return result.data as unknown as CornerProjectRecord;
}
