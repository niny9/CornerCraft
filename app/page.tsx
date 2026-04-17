'use client';

import { useCallback, useRef, useState } from 'react';
import CameraCapture from '@/components/CameraCapture';
import ModelViewer, { ModelItem } from '@/components/ModelViewer';

interface RemovedModel extends ModelItem {
  lastPosition: [number, number, number];
}

export default function Home() {
  const [imageData, setImageData] = useState<string | null>(null);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [removedModels, setRemovedModels] = useState<RemovedModel[]>([]);
  const [backgroundUrl, setBackgroundUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [totalSlots, setTotalSlots] = useState(0);
  const draggedPositions = useRef<Map<number, [number, number, number]>>(new Map());
  const modelsRef = useRef<ModelItem[]>([]);
  modelsRef.current = models;
  const removedModelsRef = useRef<RemovedModel[]>([]);
  removedModelsRef.current = removedModels;

  const handleImageCapture = async (image: string) => {
    setImageData(image);
    setLoading(true);
    setRemovedModels([]);
    draggedPositions.current.clear();

    try {
      const response = await fetch('/api/generate-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });

      const data = await response.json();
      setBackgroundUrl(data.bgUrl);
      const things = data.things ?? [];
      setModels(things);
      setTotalSlots(things.length);
    } catch (error) {
      console.error('生成3D模型失败:', error);
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

    setModels(m => [...m, { id: item.id, url: item.url, position: item.lastPosition }]);
    setRemovedModels(prev => prev.filter((_, i) => i !== index));
  }, []);

  const getModelName = (url: string) => {
    const name = url.split('/').pop()?.replace('.glb', '') ?? url;
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 text-center">
          照片转3D模型
        </h1>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4">拍照或上传图片</h2>
            <CameraCapture onCapture={handleImageCapture} />
            {imageData && (
              <div className="mt-4">
                <img src={imageData} alt="Captured" className="w-full rounded-lg" />
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg p-6 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4">3D模型预览</h2>
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
            {totalSlots > 0 && !loading && (
              <div className="mt-3 space-y-2">
                <h3 className="text-sm font-medium text-gray-500">已移除</h3>
                <div className="flex flex-wrap gap-2 min-h-[40px]">
                  {removedModels.map((model, i) => (
                    <button
                      key={`removed-${i}`}
                      onClick={() => handleRestoreModel(i)}
                      className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      title="点击还原"
                    >
                      <span>{getModelName(model.url)}</span>
                      <span className="text-xs">↩</span>
                    </button>
                  ))}
                  {Array.from({ length: totalSlots - removedModels.length }).map((_, i) => (
                    <div key={`slot-${i}`} className="w-20 h-9 border-2 border-dashed border-gray-200 rounded-lg" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
