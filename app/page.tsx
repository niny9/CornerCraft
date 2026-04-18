'use client';

import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import CameraCapture, { CameraCaptureRef } from '@/components/CameraCapture';
import ModelViewer, { ModelItem } from '@/components/ModelViewer';
import RoomViewerTry from '@/components/RoomViewerTry';

const STYLE_KEYWORDS = ['Japandi', 'Minimalist', 'Bohemian', 'Industrial', 'Mid-Century'];

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
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [vision, setVision] = useState('');
  const draggedPositions = useRef<Map<number, [number, number, number]>>(new Map());
  const modelsRef = useRef<ModelItem[]>([]);
  modelsRef.current = models;
  const removedModelsRef = useRef<RemovedModel[]>([]);
  removedModelsRef.current = removedModels;
  const cameraRef = useRef<CameraCaptureRef>(null);

  const handleImageCapture = (image: string) => {
    setImageData(image);
  };

  const handleGenerate = async () => {
    if (!imageData) return;
    setLoading(true);
    setRemovedModels([]);
    draggedPositions.current.clear();

    try {
      const response = await fetch('/api/generate-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData, keywords: selectedKeywords, vision }),
      });

      const data = await response.json();
      setBackgroundUrl(data.bgUrl);
      const things = data.things ?? [];
      setModels(things);
      setInitialModels(things);
    } catch (error) {
      console.error('Failed to generate 3D model:', error);
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

  const toggleKeyword = (kw: string) => {
    setSelectedKeywords(prev =>
      prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw]
    );
  };

  const showPreview = loading || models.length > 0;

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <CameraCapture ref={cameraRef} onCapture={handleImageCapture} />

      <div className="max-w-md mx-auto px-5 py-8">
        {/* Upload page */}
        {!showPreview && (
          <>
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-[var(--foreground)] leading-tight mb-1">
                Design Your<br />Sanctuary
              </h1>
              <p className="text-sm text-gray-400">
                Upload your space and let the curator transform it.
              </p>
            </div>

            {/* Photo / Upload cards */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {/* Take a Photo card */}
              <button
                onClick={() => cameraRef.current?.openCamera()}
                className="card p-5 flex flex-col items-center gap-3 text-center cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="w-12 h-12 rounded-xl bg-[#f0ecff] flex items-center justify-center">
                  <svg className="w-6 h-6 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Take a Photo</p>
                  <p className="text-xs text-gray-400 mt-0.5">Capture your current room layout</p>
                </div>
              </button>

              {/* Upload card */}
              <button
                onClick={() => cameraRef.current?.openFilePicker()}
                className="card p-3 flex flex-col items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-transform overflow-hidden relative"
              >
                {imageData ? (
                  <img src={imageData} alt="Preview" className="absolute inset-0 w-full h-full object-cover rounded-[15px]" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-[#f0ecff] flex items-center justify-center">
                      <svg className="w-6 h-6 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">Upload Image</p>
                  </div>
                )}
              </button>
            </div>

            {/* Style Keywords */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-[var(--foreground)]">Style Keywords</h2>
                <span className="text-xs font-medium text-gray-400 tracking-wider uppercase">Pick 1 or more</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {STYLE_KEYWORDS.map(kw => (
                  <button
                    key={kw}
                    onClick={() => toggleKeyword(kw)}
                    className={`keyword-pill ${selectedKeywords.includes(kw) ? 'selected' : ''}`}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>

            {/* Vision textarea */}
            <div className="mb-8">
              <h2 className="text-base font-semibold text-[var(--foreground)] mb-3">What&apos;s your vision?</h2>
              <textarea
                value={vision}
                onChange={e => setVision(e.target.value)}
                placeholder="Describe textures, moods, or specific requirements..."
                rows={3}
                className="w-full input-field p-4 text-sm text-[var(--foreground)] placeholder:text-gray-300 resize-none"
              />
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!imageData}
              className="w-full btn-primary py-4 text-base flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Generate 3D Model
            </button>
          </>
        )}

        {/* Preview page */}
        {showPreview && (
          <div className="preview-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[var(--foreground)] flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
                3D Preview
              </h2>
              {!loading && (
                <button
                  onClick={() => { setModels([]); setInitialModels([]); setRemovedModels([]); setImageData(null); setSelectedKeywords([]); setVision(''); }}
                  className="text-xs text-gray-400 hover:text-[var(--primary)] transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  Back
                </button>
              )}
            </div>

            {loading && (
              <div className="flex items-center justify-center h-64 rounded-xl bg-gray-50">
                <div className="text-center">
                  <div className="loading-ring rounded-full h-12 w-12 border-[3px] border-purple-100 border-t-[var(--primary)] mx-auto mb-3"></div>
                  <p className="text-gray-400 text-sm">Generating 3D model...</p>
                </div>
              </div>
            )}
            {models.length > 0 && !loading && (
              <>
                <ModelViewer
                  models={models}
                  backgroundUrl={backgroundUrl}
                  onRemoveModel={handleRemoveModel}
                  onPositionChange={handlePositionChange}
                />

                <div className="mt-4 space-y-3">
                  <div className="divider" />
                  <h3 className="text-xs font-medium text-gray-400 tracking-wider uppercase">Study Room Demo (Try)</h3>
                  <RoomViewerTry />
                </div>
              </>
            )}

            {/* Removed items */}
            {initialModels.length > 0 && !loading && (
              <div className="mt-4 space-y-3">
                <div className="divider" />
                <h3 className="text-xs font-medium text-gray-400 tracking-wider uppercase">Removed Items</h3>
                <div className="flex flex-wrap gap-2 min-h-[56px]">
                  {removedModels.map((model, i) => (
                    <button
                      key={model.id}
                      onClick={() => handleRestoreModel(i)}
                      className="w-14 h-14 rounded-xl bg-gray-50 border border-purple-100 overflow-hidden slot-hover cursor-pointer"
                      title="Click to restore"
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
                    <div key={`slot-${i}`} className="w-14 h-14 border border-dashed border-purple-100 rounded-xl bg-gray-50/50" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
