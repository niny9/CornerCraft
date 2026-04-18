'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Bounds, Environment, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

const MODEL_URL = '/study_room_no_desk.glb';

function getMovableRoot(hit: THREE.Object3D, root: THREE.Object3D) {
  let cur: THREE.Object3D | null = hit;
  while (cur && cur.parent && cur.parent !== root) cur = cur.parent;
  return cur ?? hit;
}

function RoomModel({ controlsRef }: { controlsRef: React.RefObject<OrbitControlsImpl | null> }) {
  const { scene } = useGLTF(MODEL_URL);
  const { camera, gl } = useThree();

  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  const dragState = useRef<{
    object: THREE.Object3D;
    parent: THREE.Object3D;
    offset: THREE.Vector3;
    plane: THREE.Plane;
  } | null>(null);

  const cloned = useMemo(() => {
    const c = scene.clone();

    // Ensure meshes can cast/receive shadows without mutating original scene
    c.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    return c;
  }, [scene]);

  const sceneMetrics = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    return { maxDim };
  }, [cloned]);

  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerMove = (e: PointerEvent) => {
      const state = dragState.current;
      if (!state) return;

      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(state.plane, hit)) return;

      const nextWorld = hit.add(state.offset);
      const nextLocal = state.parent.worldToLocal(nextWorld.clone());
      state.object.position.copy(nextLocal);
    };

    const onPointerUp = () => {
      if (!dragState.current) return;
      dragState.current = null;
      if (controlsRef.current) controlsRef.current.enabled = true;
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);

    return () => {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
    };
  }, [camera, gl, raycaster, controlsRef]);

  return (
    <primitive
      object={cloned}
      onPointerDown={(e: any) => {
        if (e.nativeEvent.button !== 0) return;

        // Hit object is the mesh; move its top-level child under the glTF scene
        const root = getMovableRoot(e.object, cloned);
        if (!root.parent) return;

        // Prevent dragging giant room meshes: only allow smaller sub-objects
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        box.getSize(size);
        const rootMaxDim = Math.max(size.x, size.y, size.z) || 0;
        if (rootMaxDim >= sceneMetrics.maxDim * 0.65) return;

        e.stopPropagation();
        if (controlsRef.current) controlsRef.current.enabled = false;

        const worldPos = new THREE.Vector3();
        root.getWorldPosition(worldPos);

        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          new THREE.Vector3(0, 1, 0),
          worldPos,
        );

        // Compute offset so object doesn't jump to cursor
        const offset = new THREE.Vector3();
        offset.copy(worldPos).sub(e.point);

        dragState.current = {
          object: root,
          parent: root.parent,
          offset,
          plane,
        };
      }}
    />
  );
}

export default function RoomViewerTry() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <div className="w-full aspect-square rounded-xl overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [2.5, 2.0, 2.5], fov: 45 }}>
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[6, 8, 6]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        <Suspense fallback={null}>
          <Bounds fit clip margin={1.15}>
            <RoomModel controlsRef={controlsRef} />
          </Bounds>
          <Environment preset="warehouse" />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          enablePan
          enableZoom
          enableDamping
          dampingFactor={0.08}
          minDistance={1.5}
          maxDistance={20}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
