import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type {
  TerrainDataset,
  TerrainMode,
  TerrainTool,
  TerrainMeasurement,
  TerrainView,
} from "./terrainTypes";

interface Props {
  terrain: TerrainDataset;
  mode: TerrainMode;
  tool: TerrainTool;
  wireframe: boolean;
  pointSize: number;
  view: TerrainView;
  resetKey: number;
  onMeasure: (value: TerrainMeasurement) => void;
}

export default function RealTerrainViewer(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef(props);
  current.current = props;
  const update = useRef<(() => void) | null>(null);
  const reset = useRef<(() => void) | null>(null);
  const zoom = useRef<((factor: number) => void) | null>(null);
  const [status, setStatus] = useState("Loading measured geometry…");
  const [error, setError] = useState("");
  useEffect(() => {
    update.current?.();
  }, [props.mode, props.wireframe, props.pointSize, props.tool]);
  useEffect(() => {
    reset.current?.();
  }, [props.resetKey, props.view]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const terrain = props.terrain;
    let renderer: THREE.WebGLRenderer;
    setError("");
    setStatus("Loading measured geometry…");
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError(
        "WebGL is unavailable on this device. Source files and metadata can still be downloaded.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x142027);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    element.appendChild(renderer.domElement);
    const controller = new AbortController();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.zoomSpeed = 3;
    controls.zoomToCursor = true;
    controls.dampingFactor = 0.08;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    const width = terrain.extent_m.width,
      depth = terrain.extent_m.depth,
      relief = terrain.extent_m.relief;
    const extent = Math.max(width, depth, relief, 1);
    controls.minDistance = extent * 0.0005;
    controls.maxDistance = extent * 12;
    controls.target.set(0, relief * 0.35, 0);
    const fit = () => {
      const aspect = Math.max(0.25, camera.aspect);
      const distance = extent * (aspect < 1 ? 1.65 / aspect : 1.75);
      const view = current.current.view;
      if (view === "top") camera.position.set(0, relief + distance, 0.01);
      else if (view === "front") camera.position.set(0, relief * 0.5, distance);
      else if (view === "back") camera.position.set(0, relief * 0.5, -distance);
      else if (view === "left") camera.position.set(-distance, relief * 0.5, 0);
      else if (view === "right") camera.position.set(distance, relief * 0.5, 0);
      else if (view === "bottom") camera.position.set(0, -distance, 0.01);
      else
        camera.position.set(
          distance * 0.62,
          relief * 0.35 + distance * 0.48,
          distance * 0.72,
        );
      controls.target.set(0, relief * 0.35, 0);
      controls.update();
    };
    const ambient = new THREE.HemisphereLight(0xffffff, 0x444f61, 0.85);
    scene.add(ambient);
    const undersideFill = new THREE.DirectionalLight(0xbad5ff, 0.85);
    undersideFill.position.set(extent * 0.4, -extent, -extent * 0.5);
    scene.add(undersideFill);
    const sun = new THREE.DirectionalLight(0xfff2dc, 3.0);
    sun.position.set(-extent, extent * 2, extent * 0.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -extent;
    sun.shadow.camera.right = extent;
    sun.shadow.camera.top = extent;
    sun.shadow.camera.bottom = -extent;
    sun.shadow.camera.near = extent * 0.01;
    sun.shadow.camera.far = extent * 5;
    sun.shadow.normalBias = extent * 0.00015;
    scene.add(sun);
    const presentation = new THREE.Group();
    scene.add(presentation);
    const north = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(-width / 2, 0, depth / 2),
      extent * 0.12,
      0x86b9b3,
      extent * 0.025,
      extent * 0.015,
    );
    scene.add(north);
    let geometry: THREE.BufferGeometry | null = null;
    let material: THREE.MeshStandardMaterial | THREE.PointsMaterial | null =
      null;
    let object: THREE.Mesh | THREE.Points | null = null;
    let texture: THREE.Texture | null = null;
    let slope: Float32Array | null = null;
    const markers = new THREE.Group();
    scene.add(markers);
    const markerGeometry = new THREE.SphereGeometry(extent * 0.003, 12, 8);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0x5bf3d4,
      depthTest: false,
    });
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x64f6d6,
      depthTest: false,
    });
    let measurementLine: THREE.Line | null = null;
    let selected: THREE.Vector3[] = [];
    let frame = 0,
      disposed = false,
      needsRender = true;
    const resize = () => {
      const w = element.clientWidth,
        h = element.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      needsRender = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    fit();
    zoom.current = (factor) => {
      const offset = camera.position.clone().sub(controls.target);
      const nextDistance = THREE.MathUtils.clamp(
        offset.length() * factor,
        controls.minDistance,
        controls.maxDistance,
      );
      camera.position.copy(controls.target).add(offset.setLength(nextDistance));
      controls.update();
      needsRender = true;
    };
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: extent * 0.0015 };
    let pointerStart = { x: 0, y: 0 };
    const down = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY };
    };
    const clearMarkers = () => {
      needsRender = true;
      markers.clear();
      selected = [];
      if (measurementLine) {
        measurementLine.geometry.dispose();
        scene.remove(measurementLine);
        measurementLine = null;
      }
    };
    const click = (event: PointerEvent) => {
      if (
        !object ||
        current.current.tool === "orbit" ||
        Math.hypot(
          event.clientX - pointerStart.x,
          event.clientY - pointerStart.y,
        ) > 5
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit = raycaster.intersectObject(object, false)[0];
      if (!hit) return;
      const point = hit.point.clone();
      // For a point cloud use the exact selected source vertex, not the point on the viewing ray.
      const index = object instanceof THREE.Points ? hit.index : hit.face?.a;
      if (object instanceof THREE.Points && index !== undefined)
        point.fromBufferAttribute(geometry!.getAttribute("position"), index);
      if (current.current.tool === "inspect" || selected.length >= 2)
        clearMarkers();
      selected.push(point);
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.copy(point);
      marker.renderOrder = 10;
      markers.add(marker);
      const points = selected.map((p) => ({
        x: p.x + terrain.origin.easting,
        y: -p.z + terrain.origin.northing,
        z: p.y + terrain.origin.elevation,
      }));
      const reading: TerrainMeasurement = { points };
      if (
        points.length === 1 &&
        slope &&
        index !== undefined &&
        Number.isFinite(slope[index])
      )
        reading.points[0].slope = slope[index];
      if (selected.length === 2) {
        reading.distance = selected[0].distanceTo(selected[1]);
        reading.horizontal = Math.hypot(
          selected[0].x - selected[1].x,
          selected[0].z - selected[1].z,
        );
        reading.inclination =
          (Math.atan2(
            Math.abs(selected[0].y - selected[1].y),
            reading.horizontal,
          ) *
            180) /
          Math.PI;
        const g = new THREE.BufferGeometry().setFromPoints(selected);
        measurementLine = new THREE.Line(g, lineMaterial);
        measurementLine.renderOrder = 10;
        scene.add(measurementLine);
      }
      current.current.onMeasure(reading);
      needsRender = true;
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", click);
    const srgb = (v: number) =>
      v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    const colorCache = new Map<string, THREE.BufferAttribute>();
    async function binary(url: string) {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok)
        throw new Error(`Geometry download failed (${response.status})`);
      return response.arrayBuffer();
    }
    async function load() {
      const [positions, colors, indices, slopes] = await Promise.all([
        binary(terrain.assets.positions),
        terrain.assets.colors ? binary(terrain.assets.colors) : null,
        terrain.assets.indices ? binary(terrain.assets.indices) : null,
        terrain.assets.slope ? binary(terrain.assets.slope) : null,
      ]);
      if (disposed) return;
      const p = new Float32Array(positions);
      if (p.length !== terrain.point_count * 3)
        throw new Error("Survey point count does not match geometry asset");
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(p, 3));
      if (indices) {
        geometry.setIndex(
          new THREE.BufferAttribute(new Uint32Array(indices), 1),
        );
        geometry.computeVertexNormals();
      }
      if (slopes) slope = new Float32Array(slopes);
      if (colors) {
        const raw = new Uint8Array(colors);
        const linear = new Float32Array(raw.length);
        for (let i = 0; i < raw.length; i++) linear[i] = srgb(raw[i] / 255);
        colorCache.set("survey", new THREE.BufferAttribute(linear, 3));
      }
      const color = new THREE.Color();
      for (const mode of ["elevation", "slope"]) {
        const array = new Float32Array(p.length);
        for (let i = 0; i < p.length / 3; i++) {
          const t =
            mode === "slope"
              ? Math.min(1, (slope?.[i] ?? 0) / 65)
              : p[i * 3 + 1] / Math.max(1, relief);
          if (!Number.isFinite(t)) color.set(0x8d9695);
          else if (mode === "slope") color.setHSL((1 - t) * 0.38, 0.58, 0.48);
          else color.setHSL(0.51 - t * 0.43, 0.28, 0.35 + t * 0.3);
          array[i * 3] = color.r;
          array[i * 3 + 1] = color.g;
          array[i * 3 + 2] = color.b;
        }
        colorCache.set(mode, new THREE.BufferAttribute(array, 3));
      }
      if (indices) {
        material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          roughness: 0.95,
          metalness: 0,
        });
        object = new THREE.Mesh(geometry, material);
        object.castShadow = true;
        object.receiveShadow = true;
        // Close only a complete rectangular DEM. These display walls are not surveyed geology.
        if (terrain.grid?.valid_fraction === 1) {
          const baseY = -Math.max(80, relief * 0.18);
          const walls: number[] = [];
          const edges = [
            { axis: 0, value: -width / 2, sort: 2 },
            { axis: 0, value: width / 2, sort: 2 },
            { axis: 2, value: -depth / 2, sort: 0 },
            { axis: 2, value: depth / 2, sort: 0 },
          ];
          for (const edge of edges) {
            const boundary: number[] = [];
            for (let i = 0; i < p.length; i += 3)
              if (Math.abs(p[i + edge.axis] - edge.value) < 0.05)
                boundary.push(i);
            boundary.sort((a, b) => p[a + edge.sort] - p[b + edge.sort]);
            for (let j = 1; j < boundary.length; j++) {
              const a = boundary[j - 1],
                b = boundary[j];
              walls.push(
                p[a],
                p[a + 1],
                p[a + 2],
                p[b],
                p[b + 1],
                p[b + 2],
                p[a],
                baseY,
                p[a + 2],
                p[b],
                p[b + 1],
                p[b + 2],
                p[b],
                baseY,
                p[b + 2],
                p[a],
                baseY,
                p[a + 2],
              );
            }
          }
          const wallGeometry = new THREE.BufferGeometry();
          wallGeometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(walls, 3),
          );
          wallGeometry.computeVertexNormals();
          const wall = new THREE.Mesh(
            wallGeometry,
            new THREE.MeshStandardMaterial({
              color: 0x9dbcb8,
              roughness: 1,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.1,
              depthWrite: false,
            }),
          );
          wall.castShadow = false;
          wall.receiveShadow = false;
          presentation.add(wall);
          const base = new THREE.Mesh(
            new THREE.BoxGeometry(width, extent * 0.018, depth),
            new THREE.MeshStandardMaterial({
              color: 0x9dbcb8,
              roughness: 1,
              transparent: true,
              opacity: 0.08,
              depthWrite: false,
            }),
          );
          base.position.y = baseY - extent * 0.009;
          base.receiveShadow = false;
          presentation.add(base);
        }
      } else {
        material = new THREE.PointsMaterial({
          vertexColors: true,
          size: current.current.pointSize,
          sizeAttenuation: false,
        });
        object = new THREE.Points(geometry, material);
      }
      scene.add(object);
      if (terrain.assets.texture && indices) {
        // Map projected XY onto the orthoimage using the same pixel-centre bounds.
        const uv = new Float32Array((p.length / 3) * 2);
        for (let i = 0; i < p.length / 3; i++) {
          uv[i * 2] = (p[i * 3] + width / 2) / width;
          uv[i * 2 + 1] = 1 - (p[i * 3 + 2] + depth / 2) / depth;
        }
        geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        try {
          texture = await new THREE.TextureLoader().loadAsync(
            terrain.assets.texture,
          );
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(
            8,
            renderer.capabilities.getMaxAnisotropy(),
          );
        } catch {
          /* Geometry remains usable if optional orthoimagery is unavailable. */
        }
      }
      const apply = () => {
        if (!geometry || !material) return;
        const settings = current.current;
        const useTexture =
          settings.mode === "survey" &&
          !!texture &&
          material instanceof THREE.MeshStandardMaterial;
        const attr =
          colorCache.get(settings.mode) ?? colorCache.get("elevation")!;
        geometry.setAttribute("color", attr);
        if (material instanceof THREE.MeshStandardMaterial) {
          material.map = useTexture ? texture : null;
          material.vertexColors = !useTexture;
          material.wireframe = settings.wireframe;
          material.needsUpdate = true;
        }
        if (material instanceof THREE.PointsMaterial)
          material.size = settings.pointSize;
        north.visible = true;
        element!.style.cursor =
          settings.tool === "orbit" ? "grab" : "crosshair";
        needsRender = true;
      };
      update.current = apply;
      reset.current = () => {
        fit();
        clearMarkers();
        current.current.onMeasure({ points: [] });
      };
      fit();
      apply();
      setStatus("");
    }
    load().catch((err) => {
      if (!disposed && err.name !== "AbortError") {
        setError(err.message);
        setStatus("");
      }
    });
    const draw = () => {
      const changed = controls.update();
      if (changed || needsRender) {
        renderer.render(scene, camera);
        needsRender = false;
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      disposed = true;
      controller.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      update.current = null;
      reset.current = null;
      zoom.current = null;
      controls.dispose();
      clearMarkers();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", click);
      geometry?.dispose();
      material?.dispose();
      texture?.dispose();
      markerGeometry.dispose();
      markerMaterial.dispose();
      lineMaterial.dispose();
      // ArrowHelper has its own geometry/material resources.
      north.line.geometry.dispose();
      (north.line.material as THREE.Material).dispose();
      north.cone.geometry.dispose();
      (north.cone.material as THREE.Material).dispose();
      presentation.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      sun.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [props.terrain.id]);
  return (
    <div className="real-terrain-stage">
      <div
        className="real-terrain-canvas"
        ref={host}
        aria-label={`Real 3D ${props.terrain.kind} of ${props.terrain.name}`}
      />
      {status && (
        <div className="terrain-loading" role="status">
          <span className="spinner" />
          {status}
        </div>
      )}
      {error && (
        <div className="terrain-error" role="alert">
          {error}
        </div>
      )}
      <div className="terrain-scale">
        Drag to rotate · Scroll to zoom · 1:1 vertical scale ·{" "}
        {props.terrain.georeferenced ? "E / N / elevation" : "Local X / Y / Z"}{" "}
        in metres
      </div>
      {props.terrain.grid?.valid_fraction === 1 && (
        <div className="terrain-solid-note">
          Transparent display sides · subsurface illustrative
        </div>
      )}
      <div className="terrain-zoom-controls">
        <button
          aria-label="Zoom in terrain"
          title="Zoom in"
          onClick={() => zoom.current?.(0.65)}
        >
          +
        </button>
        <button
          aria-label="Zoom out terrain"
          title="Zoom out"
          onClick={() => zoom.current?.(1.5)}
        >
          −
        </button>
        <button
          aria-label="Fullscreen terrain"
          title="Fullscreen"
          onClick={() => {
            const stage = host.current?.parentElement;
            if (document.fullscreenElement) void document.exitFullscreen();
            else if (stage) void stage.requestFullscreen();
          }}
        >
          ⛶
        </button>
      </div>
      <div className="terrain-compass">
        {props.terrain.georeferenced ? "N ↑" : "Local +Y ↑"}
      </div>
    </div>
  );
}
