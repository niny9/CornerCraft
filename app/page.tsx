'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import CameraCapture from '@/components/CameraCapture';
import ModelViewer, { ModelItem } from '@/components/ModelViewer';

type BudgetLevel = 'low' | 'medium' | 'high';

interface CornerProject {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  space_type: string;
  style_tags: string[];
  interest_tags: string[];
  budget_level: BudgetLevel;
  created_at: string;
  scene_understanding: {
    scene_summary: string;
    existing_objects: string[];
    editable_zones: string[];
    keep_zones: string[];
    problem_tags: string[];
    density_level: string;
    photo_angle_type: string;
  } | null;
  plan_output: {
    diagnosis_text: string;
    strategy_text: string;
    style_summary: string;
    suggested_items: Array<{
      category: string;
      item_name: string;
      reason: string;
      estimated_price: number;
      priority: string;
    }>;
    budget_plan: {
      display: number;
      lighting: number;
      storage: number;
      decoration: number;
      total: number;
    };
    render_instruction: string;
  } | null;
  background_url: string | null;
  viewer_models: ModelItem[] | null;
}

function MiniModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const c = scene.clone();
    const box = new THREE.Box3().setFromObject(c);
    const center = new THREE.Vector3();
    box.getCenter(center);
    c.position.sub(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) c.scale.multiplyScalar(1.2 / maxDim);
    return c;
  }, [scene]);
  return <primitive object={cloned} />;
}

interface RemovedModel extends ModelItem {
  lastPosition: [number, number, number];
}

export default function Home() {
  const [imageData, setImageData] = useState<string | null>(null);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [removedModels, setRemovedModels] = useState<RemovedModel[]>([]);
  const [backgroundUrl, setBackgroundUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [initialModels, setInitialModels] = useState<ModelItem[]>([]);
  const [projects, setProjects] = useState<CornerProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [spaceType, setSpaceType] = useState('desk_corner');
  const [styleTagsInput, setStyleTagsInput] = useState('minimal, cozy');
  const [interestTagsInput, setInterestTagsInput] = useState('gaming, creator');
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel>('medium');
  const draggedPositions = useRef<Map<number, [number, number, number]>>(new Map());
  const modelsRef = useRef<ModelItem[]>([]);
  const removedModelsRef = useRef<RemovedModel[]>([]);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  useEffect(() => {
    modelsRef.current = models;
  }, [models]);

  useEffect(() => {
    removedModelsRef.current = removedModels;
  }, [removedModels]);

  const loadProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/corners', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? '读取历史记录失败');
      }
      setProjects(data.projects);
      setSelectedProjectId((current) => current ?? data.projects?.[0]?.id ?? null);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleImageCapture = async (image: string) => {
    setImageData(image);
    setLoading(true);
    setErrorMessage(null);
    setRemovedModels([]);
    draggedPositions.current.clear();

    try {
      const response = await fetch('/api/corners/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image,
          spaceType,
          styleTags: styleTagsInput.split(',').map((item) => item.trim()).filter(Boolean),
          interestTags: interestTagsInput.split(',').map((item) => item.trim()).filter(Boolean),
          budgetLevel,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? '生成方案失败');
      }

      setBackgroundUrl(data.backgroundUrl);
      const things = data.things ?? [];
      setModels(things);
      setInitialModels(things);
      await loadProjects();
      if (data.project?.id) setSelectedProjectId(data.project.id);
    } catch (error) {
      console.error('生成3D模型失败:', error);
      setErrorMessage(error instanceof Error ? error.message : '生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePositionChange = useCallback((index: number, position: [number, number, number]) => {
    draggedPositions.current.set(index, position);
  }, []);

  const handleRemoveModel = useCallback((index: number) => {
    const item = modelsRef.current[index];
    if (!item) return;
    const pos: [number, number, number] = draggedPositions.current.get(index) ?? item.position ?? [0.5, 0.5, 0];

    setRemovedModels(r => [...r, { ...item, lastPosition: pos }]);
    setModels(prev => prev.filter((_, i) => i !== index));

    // 移除后重建索引映射
    const updated = new Map<number, [number, number, number]>();
    draggedPositions.current.forEach((v, k) => {
      if (k < index) updated.set(k, v);
      else if (k > index) updated.set(k - 1, v);
    });
    draggedPositions.current = updated;
  }, []);

  const handleRestoreModel = useCallback((index: number) => {
    const item = removedModelsRef.current[index];
    if (!item) return;

    setModels(m => [...m, { id: item.id, url: item.url, name: item.name, color: item.color, position: item.lastPosition }]);
    setRemovedModels(prev => prev.filter((_, i) => i !== index));
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setBackgroundUrl(selectedProject.background_url ?? undefined);
    const viewerModels = selectedProject.viewer_models ?? [];
    setModels(viewerModels);
    setInitialModels(viewerModels);
    setRemovedModels([]);
    draggedPositions.current.clear();
  }, [selectedProject]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff9f2,_#f5efe6_45%,_#e7ddd1)] px-4 py-8 text-slate-800 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.3em] text-amber-700">CornerCraft Backend</p>
            <h1 className="text-4xl font-semibold text-slate-900">小空间改造生成工作台</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              当前版本已经把前端接入可持久化后端：生成结果会写入 Supabase，并可直接作为 Render 上线的服务基础。
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.2fr_0.8fr]">
          <section className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-[0_20px_60px_rgba(70,52,24,0.10)] backdrop-blur">
            <h2 className="text-xl font-semibold text-slate-900">生成输入</h2>
            <p className="mt-2 text-sm text-slate-500">上传角落照片，并附上空间类型、风格、兴趣和预算，让后端生成可存档的方案。</p>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm">
                <span className="font-medium text-slate-700">空间类型</span>
                <input
                  value={spaceType}
                  onChange={(event) => setSpaceType(event.target.value)}
                  className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400"
                  placeholder="desk_corner / dorm_corner / vanity_corner"
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-medium text-slate-700">风格标签</span>
                <input
                  value={styleTagsInput}
                  onChange={(event) => setStyleTagsInput(event.target.value)}
                  className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400"
                  placeholder="minimal, cozy"
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-medium text-slate-700">兴趣标签</span>
                <input
                  value={interestTagsInput}
                  onChange={(event) => setInterestTagsInput(event.target.value)}
                  className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400"
                  placeholder="gaming, creator"
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-medium text-slate-700">预算档位</span>
                <select
                  value={budgetLevel}
                  onChange={(event) => setBudgetLevel(event.target.value as BudgetLevel)}
                  className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400"
                >
                  <option value="low">低预算</option>
                  <option value="medium">中预算</option>
                  <option value="high">高预算</option>
                </select>
              </label>
            </div>

            <div className="mt-6 rounded-[24px] bg-stone-50 p-4">
              <CameraCapture onCapture={handleImageCapture} />
              {imageData && (
                <div className="mt-4">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
                    <Image src={imageData} alt="Captured" fill className="object-cover" unoptimized />
                  </div>
                </div>
              )}
              {errorMessage && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/70 bg-[#fffdf9] p-6 shadow-[0_20px_60px_rgba(70,52,24,0.10)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">结果与 3D 预览</h2>
                <p className="mt-1 text-sm text-slate-500">这里展示后端返回的方案结果、预算拆分和桌面模型预览。</p>
              </div>
              {selectedProject && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                  {selectedProject.status}
                </span>
              )}
            </div>

            {loading && (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">正在生成3D模型...</p>
                </div>
              </div>
            )}
            {models.length > 0 && !loading && (
              <ModelViewer
                models={models}
                backgroundUrl={backgroundUrl}
                onRemoveModel={handleRemoveModel}
                onPositionChange={handlePositionChange}
              />
            )}
            {models.length === 0 && !loading && (
              <div className="flex items-center justify-center h-96 text-gray-400">
                请先拍照或上传图片
              </div>
            )}

            {/* 已移除物品列表 */}
            {initialModels.length > 0 && !loading && (
              <div className="mt-3 space-y-2">
                <h3 className="text-sm font-medium text-gray-500">已移除</h3>
                <div className="flex flex-wrap gap-2 min-h-[56px]">
                  {removedModels.map((model, i) => (
                    <button
                      key={model.id}
                      onClick={() => handleRestoreModel(i)}
                      className="w-14 h-14 rounded-lg bg-gray-100 hover:bg-blue-50 transition-colors overflow-hidden"
                      title="点击还原"
                    >
                      <Canvas camera={{ position: [0, 0, 3], fov: 40 }}>
                        <ambientLight intensity={0.8} />
                        <directionalLight position={[2, 2, 2]} intensity={0.6} />
                        <Suspense fallback={null}>
                          <MiniModel url={model.url} />
                        </Suspense>
                        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={4} />
                      </Canvas>
                    </button>
                  ))}
                  {Array.from({ length: initialModels.length - removedModels.length }).map((_, i) => (
                    <div key={`slot-${i}`} className="w-14 h-14 border-2 border-dashed border-gray-200 rounded-lg" />
                  ))}
                </div>
              </div>
            )}

            {selectedProject?.scene_understanding && selectedProject?.plan_output && (
              <div className="mt-6 grid gap-4">
                <div className="rounded-[24px] bg-stone-100/80 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">空间理解</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{selectedProject.scene_understanding.scene_summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedProject.scene_understanding.problem_tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] bg-stone-100/80 p-4">
                    <h3 className="text-sm font-semibold text-slate-900">诊断与策略</h3>
                    <p className="mt-2 text-sm text-slate-600">{selectedProject.plan_output.diagnosis_text}</p>
                    <p className="mt-3 text-sm text-slate-600">{selectedProject.plan_output.strategy_text}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">Style</p>
                    <p className="mt-1 text-sm text-slate-700">{selectedProject.plan_output.style_summary}</p>
                  </div>

                  <div className="rounded-[24px] bg-stone-100/80 p-4">
                    <h3 className="text-sm font-semibold text-slate-900">预算拆分</h3>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600">
                      <div className="flex justify-between"><span>展示</span><span>¥{selectedProject.plan_output.budget_plan.display}</span></div>
                      <div className="flex justify-between"><span>灯光</span><span>¥{selectedProject.plan_output.budget_plan.lighting}</span></div>
                      <div className="flex justify-between"><span>收纳</span><span>¥{selectedProject.plan_output.budget_plan.storage}</span></div>
                      <div className="flex justify-between"><span>装饰</span><span>¥{selectedProject.plan_output.budget_plan.decoration}</span></div>
                      <div className="mt-2 flex justify-between border-t border-stone-300 pt-2 font-semibold text-slate-800"><span>总预算</span><span>¥{selectedProject.plan_output.budget_plan.total}</span></div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] bg-stone-100/80 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">推荐物品</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {selectedProject.plan_output.suggested_items.map((item) => (
                      <article key={item.item_name} className="rounded-2xl bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-900">{item.item_name}</span>
                          <span className="text-amber-700">¥{item.estimated_price}</span>
                        </div>
                        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{item.category} / {item.priority}</p>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{item.reason}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside className="rounded-[28px] border border-white/70 bg-[#2d241f] p-6 text-white shadow-[0_20px_60px_rgba(40,26,10,0.18)]">
            <h2 className="text-xl font-semibold">历史记录</h2>
            <p className="mt-2 text-sm leading-6 text-stone-300">
              这里直接读取 `Supabase` 中的最近项目，方便前后端一起检查存储结果和返回结构。
            </p>

            <div className="mt-5 space-y-3">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    selectedProjectId === project.id
                      ? 'border-amber-300 bg-white/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{project.space_type}</span>
                    <span className="text-xs text-stone-300">{new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-stone-400">
                    {project.style_tags.join(' / ') || 'minimal'}
                  </p>
                  <p className="mt-2 text-sm text-stone-200">
                    {project.plan_output?.diagnosis_text ?? '等待生成结果'}
                  </p>
                </button>
              ))}
              {projects.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-sm text-stone-300">
                  还没有历史项目。上传第一张角落照片后，这里会出现数据库里的记录。
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
