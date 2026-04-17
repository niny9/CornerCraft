'use client';

import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import CameraCapture from '@/components/CameraCapture';
import ModelViewer, { ModelItem } from '@/components/ModelViewer';

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
      setInitialModels(things);
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

    setModels(m => [...m, { id: item.id, url: item.url, name: item.name, color: item.color, position: item.lastPosition }]);
    setRemovedModels(prev => prev.filter((_, i) => i !== index));
  }, []);


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
          </div>
        </div>
      </div>
    </main>
  );
}
