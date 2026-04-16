'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export interface ModelItem {
  url: string;
  /** 归一化坐标，0~1 表示背景内的相对位置，(0.5, 0.5) 为中心 */
  position?: [number, number, number];
}

interface ModelViewerProps {
  models: ModelItem[];
  backgroundUrl?: string;
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

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const dist = 4;
    const aspect = size.width / size.height;
    const vFov = (cam.fov * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(vFov / 2) * dist;
    const visibleWidth = visibleHeight * aspect;

    const box = new THREE.Box3().setFromObject(cloned);
    const modelSize = new THREE.Vector3();
    box.getSize(modelSize);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const scale = Math.max(visibleWidth / modelSize.x, visibleHeight / modelSize.y);
    bgBaseScale = scale;
    bgCenterX = center.x;
    bgCenterY = center.y;
    cloned.scale.setScalar(scale * currentZoom);
    cloned.position.set(-center.x * scale * currentZoom, -center.y * scale * currentZoom, -dist);

    camera.add(cloned);
    bgSceneRef = cloned;
    onLoaded();
    return () => {
      camera.remove(cloned);
      bgSceneRef = null;
    };
  }, [cloned, camera, size, onLoaded]);

  return null;
}

function ItemModel({ url, position, controlsRef }: ModelItem & { controlsRef: React.RefObject<OrbitControlsImpl | null> }) {
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

  useEffect(() => {
    if (!groupRef.current) return;
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
  }, [cloned, camera, size, position, limits]);

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
      }
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    return () => {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
    };
  }, [camera, gl, dragPlane, dragOffset, raycasterRef, controlsRef]);

  return (
    <group
      ref={groupRef}
      onPointerDown={(e) => {
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

function SceneItems({ models, backgroundUrl, controlsRef }: ModelViewerProps & { controlsRef: React.RefObject<OrbitControlsImpl | null> }) {
  const [bgLoaded, setBgLoaded] = useState(!backgroundUrl);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    itemsGroupRef = groupRef.current;
    return () => { itemsGroupRef = null; };
  }, []);

  return (
    <>
      {backgroundUrl && (
        <Suspense fallback={null}>
          <BackgroundModel url={backgroundUrl} onLoaded={() => setBgLoaded(true)} />
        </Suspense>
      )}
      <group ref={groupRef}>
        {bgLoaded && models.map((model, i) => (
          <Suspense key={`${model.url}-${i}`} fallback={null}>
            <ItemModel url={model.url} position={model.position} controlsRef={controlsRef} />
          </Suspense>
        ))}
      </group>
    </>
  );
}

export default function ModelViewer({ models, backgroundUrl }: ModelViewerProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <div className="w-full h-96 bg-gray-100 rounded-lg">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Suspense fallback={<LoadingSpinner />}>
          <SceneItems models={models} backgroundUrl={backgroundUrl} controlsRef={controlsRef} />
        </Suspense>
        <OrbitControls ref={controlsRef} enableZoom={false} />
        <ZoomHandler />
      </Canvas>
    </div>
  );
}
