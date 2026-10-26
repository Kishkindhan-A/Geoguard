import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Assessment } from "./assessmentTypes";

export default function AssessmentTerrain({ result }: { result: Assessment }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError(
        "3D rendering is unavailable on this device. The image grid and geographic map remain available.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xf2f6f1);
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
    camera.position.set(22, 22, 28);
    const controls = new OrbitControls(camera, renderer.domElement);
    const n = result.parameters.grid_size;
    const height = result.parameters.bench_height;
    const run =
      height / Math.tan((result.parameters.slope_angle * Math.PI) / 180);
    const width = 22;
    const extent = Math.max(height, run, width);
    controls.target.set(0, height / 2, 0);
    camera.position.set(extent, height + extent * 0.6, extent * 1.3);
    camera.far = extent * 20;
    camera.updateProjectionMatrix();
    controls.enableDamping = true;
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    for (const b of result.blocks) {
      const x1 = -width / 2 + (b.col / n) * width;
      const x2 = -width / 2 + ((b.col + 1) / n) * width;
      const y1 = height * (1 - b.row / n);
      const y2 = height * (1 - (b.row + 1) / n);
      const z1 = -run / 2 + (run * b.row) / n;
      const z2 = -run / 2 + (run * (b.row + 1)) / n;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [
            x1,
            y1,
            z1,
            x1,
            y2,
            z2,
            x2,
            y2,
            z2,
            x1,
            y1,
            z1,
            x2,
            y2,
            z2,
            x2,
            y1,
            z1,
          ],
          3,
        ),
      );
      geometry.computeVertexNormals();
      const material = new THREE.MeshBasicMaterial({
        color: b.color,
        side: THREE.DoubleSide,
      });
      scene.add(new THREE.Mesh(geometry, material));
      const lines = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.65,
      });
      scene.add(new THREE.LineSegments(lines, lineMaterial));
      geometries.push(geometry, lines);
      materials.push(material, lineMaterial);
    }
    const grid = new THREE.GridHelper(extent * 2, 22, 0xc2d5be, 0xdde6d6);
    scene.add(grid);
    const resize = () => {
      const w = element.clientWidth,
        h = element.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let frame = 0;
    const draw = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [result.id]);
  return (
    <>
      <div
        className="terrain-canvas"
        ref={host}
        aria-label="Schematic 3D slope coloured by image-block screening index"
      />
      {error && (
        <p role="alert" className="helper padded">
          {error}
        </p>
      )}
    </>
  );
}
