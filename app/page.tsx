'use client';

import { useState } from 'react';
import CameraCapture from '@/components/CameraCapture';
import ModelViewer, { ModelItem } from '@/components/ModelViewer';

export default function Home() {
  const [imageData, setImageData] = useState<string | null>(null);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [backgroundUrl, setBackgroundUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const handleImageCapture = async (image: string) => {
    setImageData(image);
    setLoading(true);

    try {
      const response = await fetch('/api/generate-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });

      const data = await response.json();
      setBackgroundUrl(data.bgUrl);
      setModels(data.things ?? []);
    } catch (error) {
      console.error('生成3D模型失败:', error);
    } finally {
      setLoading(false);
    }
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
            {models.length > 0 && !loading && <ModelViewer models={models} backgroundUrl={backgroundUrl} />}
            {models.length === 0 && !loading && (
              <div className="flex items-center justify-center h-96 text-gray-400">
                请先拍照或上传图片
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
