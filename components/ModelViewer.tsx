'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { Suspense, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export interface ModelItem {
  id: string;
  url: string;
  name?: string;
  color?: string;
  /** 归一化坐标，0~1 表示背景内的相对位置，(0.5, 0.5) 为中心 */
  position?: [number, number, number];
}

interface ModelViewerProps {
  models: ModelItem[];
  backgroundUrl?: string;
  onRemoveModel?: (index: number) => void;
  onPositionChange?: (index: number, position: [number, number, number]) => void;
}

// 全局存储，供缩放和碰撞检测使用
let bgSceneRef: THREE.Object3D | null = null;
let bgBaseScale = 1;
let bgCenterX = 0;
let bgCenterY = 0;
let itemsGroupRef: THREE.Group | null = null;
let currentZoom = 1;

function BackgroundModel({ url, onLoaded }: { url: string; onLoaded: () => void }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(), [scene]);
  const { camera, size } = useThree();
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  // 只计算一次原始 bounding box，缓存起来
  const originalMetrics = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const modelSize = new THREE.Vector3();
    box.getSize(modelSize);
    const center = new THREE.Vector3();
    box.getCenter(center);
    return { modelSize, center };
  }, [cloned]);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const dist = 4;
    const aspect = size.width / size.height;
    const vFov = (cam.fov * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(vFov / 2) * dist;
    const visibleWidth = visibleHeight * aspect;

    const { modelSize, center } = originalMetrics;

    const scale = Math.max(visibleWidth / modelSize.x, visibleHeight / modelSize.y);
    bgBaseScale = scale;
    bgCenterX = center.x;
    bgCenterY = center.y;
    cloned.scale.setScalar(scale * currentZoom);
    cloned.position.set(-center.x * scale * currentZoom, -center.y * scale * currentZoom, -dist);

    camera.add(cloned);
    bgSceneRef = cloned;
    onLoadedRef.current();
    return () => {
      camera.remove(cloned);
      bgSceneRef = null;
    };
  }, [cloned, camera, size, originalMetrics]);

  return null;
}

function ItemModel({ url, position, controlsRef, index, onRemoveModel, onPositionChange, onContextMenu }: ModelItem & { controlsRef: React.RefObject<OrbitControlsImpl | null>; index: number; onRemoveModel?: (index: number) => void; onPositionChange?: (index: number, position: [number, number, number]) => void; onContextMenu?: (index: number, x: number, y: number) => void }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(), [scene]);
  const { camera, size, gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const isDragging = useRef(false);
  const dragOffset = useMemo(() => new THREE.Vector3(), []);
  const raycasterRef = useMemo(() => new THREE.Raycaster(), []);
  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1)), []);

  const limits = useMemo(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const dist = 3;
    const aspect = size.width / size.height;
    const vFov = (cam.fov * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(vFov / 2) * dist;
    const visibleWidth = visibleHeight * aspect;
    return { hw: visibleWidth / 2, hh: visibleHeight / 2, visibleWidth, visibleHeight };
  }, [camera, size]);

  const limitsRef = useRef(limits);
  useEffect(() => { limitsRef.current = limits; }, [limits]);

  const isPositioned = useRef(false);

  useEffect(() => {
    if (!groupRef.current || isPositioned.current) return;
    isPositioned.current = true;
    const { hw, hh, visibleWidth, visibleHeight } = limits;
    const [nx = 0.5, ny = 0.5] = position ?? [0.5, 0.5];
    const x = (nx - 0.5) * visibleWidth;
    const y = (ny - 0.5) * visibleHeight;

    const box = new THREE.Box3().setFromObject(cloned);
    const modelSize = new THREE.Vector3();
    box.getSize(modelSize);
    const scaleX = modelSize.x > visibleWidth ? visibleWidth / modelSize.x : 1;
    const scaleY = modelSize.y > visibleHeight ? visibleHeight / modelSize.y : 1;
    cloned.scale.setScalar(Math.min(scaleX, scaleY));

    groupRef.current.position.set(
      Math.max(-hw, Math.min(hw, x)),
      Math.max(-hh, Math.min(hh, y)),
      camera.position.z - 3,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned, camera, size, limits]);

  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current || !groupRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.setFromCamera(new THREE.Vector2(nx, ny), camera);

      // 优先用背景网格碰撞检测
      if (bgSceneRef) {
        const hits = raycasterRef.intersectObject(bgSceneRef, true);
        if (hits.length > 0) {
          // 交点是相机空间坐标，转换到世界空间
          const worldPoint = hits[0].point.clone();
          groupRef.current.position.set(worldPoint.x, worldPoint.y, groupRef.current.position.z);
          return;
        }
        // 没有打到背景，不更新位置（物品不能超出背景）
        return;
      }

      // 无背景时退回平面约束
      const hit = new THREE.Vector3();
      if (raycasterRef.ray.intersectPlane(dragPlane, hit)) {
        const { hw, hh } = limitsRef.current;
        groupRef.current.position.set(
          Math.max(-hw, Math.min(hw, hit.x - dragOffset.x)),
          Math.max(-hh, Math.min(hh, hit.y - dragOffset.y)),
          groupRef.current.position.z,
        );
      }
    };

    const onPointerUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        if (controlsRef.current) controlsRef.current.enabled = true;
        if (onPositionChange && groupRef.current) {
          const p = groupRef.current.position;
          const { visibleWidth, visibleHeight } = limitsRef.current;
          const nx = p.x / visibleWidth + 0.5;
          const ny = p.y / visibleHeight + 0.5;
          onPositionChange(index, [nx, ny, 0]);
        }
      }
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    return () => {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
    };
  }, [camera, gl, dragPlane, dragOffset, raycasterRef, controlsRef, onPositionChange, index]);

  return (
    <group
      ref={groupRef}
      onContextMenu={(e) => {
        e.stopPropagation();
        if (onContextMenu) {
          const rect = gl.domElement.getBoundingClientRect();
          const x = e.nativeEvent.clientX - rect.left;
          const y = e.nativeEvent.clientY - rect.top;
          onContextMenu(index, x, y);
        }
      }}
      onPointerDown={(e) => {
        if (e.nativeEvent.button === 2) return; // 右键不启动拖拽
        e.stopPropagation();
        isDragging.current = true;
        dragPlane.setFromNormalAndCoplanarPoint(
          new THREE.Vector3(0, 0, 1),
          groupRef.current!.position,
        );
        const rect = gl.domElement.getBoundingClientRect();
        const nx = ((e.nativeEvent.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -((e.nativeEvent.clientY - rect.top) / rect.height) * 2 + 1;
        raycasterRef.setFromCamera(new THREE.Vector2(nx, ny), camera);
        const hit = new THREE.Vector3();
        raycasterRef.ray.intersectPlane(dragPlane, hit);
        dragOffset.copy(hit).sub(groupRef.current!.position);
        if (controlsRef.current) controlsRef.current.enabled = false;
      }}
    >
      <primitive object={cloned} />
    </group>
  );
}

function ZoomHandler() {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      currentZoom = Math.max(0.5, Math.min(3, currentZoom - e.deltaY * 0.001));
      // 缩放背景（含位置偏移同步缩放，保持居中）
      if (bgSceneRef) {
        const s = bgBaseScale * currentZoom;
        bgSceneRef.scale.setScalar(s);
        bgSceneRef.position.x = -bgCenterX * s;
        bgSceneRef.position.y = -bgCenterY * s;
      }
      // 缩放物品组（位置和模型大小一起等比缩放）
      if (itemsGroupRef) {
        itemsGroupRef.scale.setScalar(currentZoom);
      }
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [gl]);
  return null;
}

function LoadingSpinner() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  );
}

function SceneItems({ models, backgroundUrl, controlsRef, onRemoveModel, onPositionChange, onContextMenu }: ModelViewerProps & { controlsRef: React.RefObject<OrbitControlsImpl | null>; onContextMenu?: (index: number, x: number, y: number) => void }) {
  const [bgLoaded, setBgLoaded] = useState(!backgroundUrl);
  const handleBgLoaded = useCallback(() => setBgLoaded(true), []);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    itemsGroupRef = groupRef.current;
    return () => { itemsGroupRef = null; };
  }, []);

  return (
    <>
      {backgroundUrl && (
        <Suspense fallback={null}>
          <BackgroundModel url={backgroundUrl} onLoaded={handleBgLoaded} />
        </Suspense>
      )}
      <group ref={groupRef}>
        {bgLoaded && models.map((model, i) => (
          <Suspense key={model.id} fallback={null}>
            <ItemModel id={model.id} url={model.url} position={model.position} controlsRef={controlsRef} index={i} onRemoveModel={onRemoveModel} onPositionChange={onPositionChange} onContextMenu={onContextMenu} />
          </Suspense>
        ))}
      </group>
    </>
  );
}

interface SceneCanvasProps {
  models: ModelItem[];
  backgroundUrl?: string;
  onPositionChange?: (index: number, position: [number, number, number]) => void;
  onContextMenu?: (index: number, x: number, y: number) => void;
}

const SceneCanvas = memo(function SceneCanvas({ models, backgroundUrl, onPositionChange, onContextMenu }: SceneCanvasProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <Canvas>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Suspense fallback={<LoadingSpinner />}>
        <SceneItems
          models={models}
          backgroundUrl={backgroundUrl}
          controlsRef={controlsRef}
          onPositionChange={onPositionChange}
          onContextMenu={onContextMenu}
        />
      </Suspense>
      <OrbitControls ref={controlsRef} enableZoom={false} />
      <ZoomHandler />
    </Canvas>
  );
});

export default function ModelViewer({ models, backgroundUrl, onRemoveModel, onPositionChange }: ModelViewerProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const handleContextMenu = useCallback((index: number, x: number, y: number) => setContextMenu({ index, x, y }), []);

  return (
    <div
      className="w-full h-96 bg-gray-100 rounded-lg relative"
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => setContextMenu(null)}
    >
      <SceneCanvas
        models={models}
        backgroundUrl={backgroundUrl}
        onPositionChange={onPositionChange}
        onContextMenu={handleContextMenu}
      />

      {/* 右键删除图标 */}
      {contextMenu && (
        <button
          className="absolute flex items-center justify-center w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full shadow-lg z-50 transition-colors"
          style={{ left: contextMenu.x - 16, top: contextMenu.y - 16 }}
          onClick={(e) => {
            e.stopPropagation();
            onRemoveModel?.(contextMenu.index);
            setContextMenu(null);
          }}
          title="删除"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
}
