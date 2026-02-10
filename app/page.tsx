"use client";

import {
  Canvas,
  useLoader,
  useFrame,
  useThree,
  type ThreeElements,
} from "@react-three/fiber";
import { OrbitControls, Center } from "@react-three/drei";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { SVGRenderer } from "three/examples/jsm/renderers/SVGRenderer.js";
import {
  Suspense,
  useRef,
  useState,
  useEffect,
  useMemo,
  forwardRef,
  useCallback,
} from "react";
import styled from "styled-components";
import { useControls } from "leva";
import * as THREE from "three";
import { useSpring, animated } from "@react-spring/three";

type LayoutOption = "Original" | string;

const ALPHABET = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
];

// Generate points from letter shape using canvas
function getLetterPoints(
  letter: string,
  numPoints: number,
): { x: number; y: number }[] {
  if (typeof window === "undefined") return [];

  const canvas = document.createElement("canvas");
  const size = 512; // Higher resolution for more points
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "white";
  ctx.font = `bold ${size * 0.85}px var(--font-noto-serif), "Noto Serif", Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, size / 2, size / 2);

  const imageData = ctx.getImageData(0, 0, size, size);
  const pixels = imageData.data;

  const whitePixels: { x: number; y: number }[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (pixels[i] > 128) {
        whitePixels.push({ x: x / size, y: 1 - y / size });
      }
    }
  }

  if (whitePixels.length === 0) return [];

  // Shuffle pixels for better distribution when selecting subset
  for (let i = whitePixels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [whitePixels[i], whitePixels[j]] = [whitePixels[j], whitePixels[i]];
  }

  // Return all points if we have fewer than needed, otherwise sample evenly
  if (whitePixels.length <= numPoints) {
    return whitePixels;
  }

  const step = whitePixels.length / numPoints;
  const result: { x: number; y: number }[] = [];
  for (let i = 0; i < numPoints; i++) {
    const index = Math.floor(i * step);
    result.push(whitePixels[index]);
  }

  return result;
}

type FragmentUserData = {
  randomness: number;
  baseCenter: THREE.Vector3;
  baseSize: THREE.Vector3;
  fragmentCenter: THREE.Vector3;
  orderedCenter?: THREE.Vector3;
  adjacentConnections?: Array<{ position: THREE.Vector3; height: number }>;
  rank?: number;
  height?: number;
};

type FragmentMaterial = THREE.Material & {
  map?: THREE.Texture | null;
  color?: THREE.Color;
  wireframe?: boolean;
  userData: Record<string, any>;
};

type FragmentMesh = THREE.Mesh<
  THREE.BufferGeometry,
  FragmentMaterial | FragmentMaterial[]
> & {
  userData: FragmentUserData;
  material: FragmentMaterial | FragmentMaterial[];
};

type TileProps = {
  modelName: string;
  explosion: number;
  baseColor: string;
  baseOpacity: number;
  layout: LayoutOption;
  wireframe: boolean;
  flattenTextures: boolean;
  flatPaletteColor: string;
  flatOpacity: number;
};

type CityscapeProps = {
  scale: number;
  explosion: number;
  baseColor: string;
  baseOpacity: number;
  adjacencyColor: string;
  adjacencyOpacity: number;
  adjacencyWindow: number;
  layout: LayoutOption;
  letterScale: number;
  letterAspect: number;
  letterSpacing: number;
  letterJitter: number;
  wireframe: boolean;
  flattenTextures: boolean;
  flatPaletteColor: string;
  flatOpacity: number;
};

type AdjacencyLinesProps = {
  fragment: FragmentMesh;
  factor: number;
  adjacencyColor: string;
  layout: LayoutOption;
  adjacencyOpacity: number;
};

type FragmentProps = {
  fragment: FragmentMesh;
  factor: number;
  baseColor: string;
  baseOpacity: number;
  flatOpacity: number;
  layout: LayoutOption;
  wireframe: boolean;
  flattenTextures: boolean;
  flatPaletteColor: string;
};

// Color constants
const COLORS = {
  baseColor: "#ffffffff",
  adjacencyColor: "rgba(255, 255, 255, 0)",
};

const INIT = {
  camPos: { x: 111, y: -23, z: -145 },
  camRot: { rotX: 0.0, rotY: 2.35, rotZ: 0.0 },
  scale: 0.05,
};

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

const Line3 = forwardRef<
  THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>,
  any
>((props, ref) => <line ref={ref as any} {...props} />);
Line3.displayName = "Line3";

const Container = styled.div<{ $whiteBg?: boolean }>`
  ${({ theme }) => (theme as any).WholeContainer}
  background: ${({ $whiteBg }) => ($whiteBg ? "#ffffff" : "black")};
  min-height: 100vh;
  width: 100vw;
  display: flex;
`;

const CanvasWrapper = styled.div`
  width: 100%;
  height: 100vh;
  position: relative;
  flex: 1;
`;

const ExportButton = styled.button`
  position: absolute;
  bottom: 20px;
  right: 20px;
  padding: 10px 20px;
  background: #333;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  z-index: 100;
  &:hover {
    background: #555;
  }
`;

type SVGExporterProps = {
  onExportReady: (exportFn: () => void) => void;
  whiteBg: boolean;
};

type PNGExporterProps = {
  onExportReady: (exportFn: () => void) => void;
  layout: string;
};


function PNGExporter({ onExportReady, layout }: PNGExporterProps) {
  const { gl, scene, camera } = useThree();

  const exportPNG = useCallback(() => {
    // Save original background
    const originalBackground = scene.background;
    const originalClearColor = gl.getClearColor(new THREE.Color());
    const originalClearAlpha = gl.getClearAlpha();

    // Set transparent background
    scene.background = null;
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(scene, camera);

    const dataURL = gl.domElement.toDataURL("image/png");

    // Restore original background
    scene.background = originalBackground;
    gl.setClearColor(originalClearColor, originalClearAlpha);
    gl.render(scene, camera);

    const link = document.createElement("a");
    link.href = dataURL;
    link.download = `living-geometry-${layout}-${Date.now()}.png`;
    link.click();
  }, [gl, scene, camera, layout]);

  useEffect(() => {
    onExportReady(exportPNG);
  }, [exportPNG, onExportReady]);

  return null;
}

function SVGExporter({ onExportReady, whiteBg }: SVGExporterProps) {
  const { scene, camera, size } = useThree();

  const exportSVG = useCallback(() => {
    const svgRenderer = new SVGRenderer();
    svgRenderer.setSize(size.width, size.height);
    svgRenderer.render(scene, camera);

    const svgElement = svgRenderer.domElement;

    // Add background rect
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("width", "100%");
    bgRect.setAttribute("height", "100%");
    bgRect.setAttribute("fill", whiteBg ? "#ffffff" : "#000000");
    svgElement.insertBefore(bgRect, svgElement.firstChild);

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `living-geometry-${Date.now()}.svg`;
    link.click();

    URL.revokeObjectURL(url);
  }, [scene, camera, size, whiteBg]);

  useEffect(() => {
    onExportReady(exportSVG);
  }, [exportSVG, onExportReady]);

  return null;
}

function Tile({
  modelName,
  explosion,
  baseColor,
  baseOpacity,
  layout,
  wireframe,
  flattenTextures,
  flatPaletteColor,
  flatOpacity,
}: TileProps) {
  const modelPath = `/3d-shibuya/${modelName}`;
  const materials = useLoader(MTLLoader, `${modelPath}.mtl`, (loader) => {
    loader.setResourcePath("/3d-shibuya/");
  }) as MTLLoader.MaterialCreator;
  const obj = useLoader(OBJLoader, `${modelPath}.obj`) as THREE.Group;

  const finalObj = useMemo<THREE.Group>(() => {
    const clonedObj = obj.clone();
    materials.preload();
    clonedObj.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
        const meshChild = child as THREE.Mesh;
        if (Array.isArray(meshChild.material)) {
          const matArray = meshChild.material as FragmentMaterial[];
          matArray.forEach((mat, i) => {
            const newMat = materials.create(mat.name);
            if (newMat) {
              matArray[i] = newMat as FragmentMaterial;
            }
          });
        } else {
          const newMat = materials.create(meshChild.material.name);
          if (newMat) {
            meshChild.material = newMat;
          }
        }
      }
    });
    return clonedObj as THREE.Group;
  }, [obj, materials]);

  const pieces = useMemo<FragmentMesh[]>(() => {
    const frags: FragmentMesh[] = [];
    if (!finalObj) return frags;

    type ChunkData = { vertices: number[]; normals: number[]; uvs: number[] };

    finalObj.traverse(function (child: THREE.Object3D) {
      if ((child as THREE.Mesh).isMesh) {
        const meshChild = child as THREE.Mesh;
        const geometry = meshChild.geometry as THREE.BufferGeometry;
        const material = meshChild.material as
          | FragmentMaterial
          | FragmentMaterial[];

        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox as THREE.Box3;

        const gridSize = 4;
        const chunks: ChunkData[] = Array.from(
          { length: gridSize * gridSize },
          () => ({
            vertices: [],
            normals: [],
            uvs: [],
          }),
        );

        const position = geometry.attributes.position;
        const normal = geometry.attributes.normal;
        const uv = geometry.attributes.uv;

        const cellSizeX = (bbox.max.x - bbox.min.x) / gridSize;
        const cellSizeY = (bbox.max.y - bbox.min.y) / gridSize;

        for (let i = 0; i < position.count; i += 3) {
          const v1 = new THREE.Vector3().fromBufferAttribute(position, i);
          const v2 = new THREE.Vector3().fromBufferAttribute(position, i + 1);
          const v3 = new THREE.Vector3().fromBufferAttribute(position, i + 2);
          const centroid = new THREE.Vector3()
            .add(v1)
            .add(v2)
            .add(v3)
            .divideScalar(3);

          let gridX = Math.floor((centroid.x - bbox.min.x) / cellSizeX);
          let gridY = Math.floor((centroid.y - bbox.min.y) / cellSizeY);
          gridX = THREE.MathUtils.clamp(gridX, 0, gridSize - 1);
          gridY = THREE.MathUtils.clamp(gridY, 0, gridSize - 1);

          const chunkIndex = gridY * gridSize + gridX;

          for (let j = 0; j < 3; j++) {
            const index = i + j;
            chunks[chunkIndex].vertices.push(
              position.getX(index),
              position.getY(index),
              position.getZ(index),
            );
            if (normal) {
              chunks[chunkIndex].normals.push(
                normal.getX(index),
                normal.getY(index),
                normal.getZ(index),
              );
            }
            if (uv) {
              chunks[chunkIndex].uvs.push(uv.getX(index), uv.getY(index));
            }
          }
        }

        const geometriesWithData = chunks
          .map((chunk: ChunkData) => {
            if (chunk.vertices.length === 0) return null;

            const newGeometry = new THREE.BufferGeometry();
            newGeometry.setAttribute(
              "position",
              new THREE.Float32BufferAttribute(chunk.vertices, 3),
            );
            if (chunk.normals.length > 0) {
              newGeometry.setAttribute(
                "normal",
                new THREE.Float32BufferAttribute(chunk.normals, 3),
              );
            }
            if (chunk.uvs.length > 0) {
              newGeometry.setAttribute(
                "uv",
                new THREE.Float32BufferAttribute(chunk.uvs, 2),
              );
            }
            newGeometry.computeBoundingBox();
            const bbox = newGeometry.boundingBox as THREE.Box3;
            const height = bbox.max.z - bbox.min.z;
            return { geometry: newGeometry, height };
          })
          .filter(
            (
              entry,
            ): entry is { geometry: THREE.BufferGeometry; height: number } =>
              entry !== null,
          );

        const maxHeight = Math.max(...geometriesWithData.map((d) => d.height));

        geometriesWithData.forEach(
          ({
            geometry,
            height,
          }: {
            geometry: THREE.BufferGeometry;
            height: number;
          }) => {
            const normalizedHeight = maxHeight > 0 ? height / maxHeight : 0;

            const mesh = new THREE.Mesh(geometry, material) as FragmentMesh;
            mesh.userData.randomness = normalizedHeight;

            const bbox = geometry.boundingBox as THREE.Box3;
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            mesh.userData.baseCenter = new THREE.Vector3(center.x, center.y, 0);
            mesh.userData.baseSize = new THREE.Vector3(
              bbox.max.x - bbox.min.x,
              bbox.max.y - bbox.min.y,
              0.1,
            );
            mesh.userData.fragmentCenter = center.clone();
            mesh.userData.height = normalizedHeight;

            frags.push(mesh);
          },
        );
      }
    });

    return frags;
  }, [finalObj]);

  return (
    <group>
      {pieces.map((p, i) => (
        <Fragment
          key={`tile-fragment-${i}`}
          fragment={p}
          factor={explosion}
          baseColor={baseColor}
          baseOpacity={baseOpacity}
          layout={layout}
          wireframe={wireframe}
          flattenTextures={flattenTextures}
          flatPaletteColor={flatPaletteColor}
          flatOpacity={flatOpacity}
        />
      ))}
    </group>
  );
}

function Cityscape({
  scale,
  explosion,
  baseColor,
  baseOpacity,
  adjacencyColor,
  adjacencyOpacity,
  adjacencyWindow,
  layout,
  letterScale,
  letterAspect,
  letterSpacing,
  letterJitter,
  wireframe,
  flattenTextures,
  flatPaletteColor,
  flatOpacity,
}: CityscapeProps) {
  const tiles = [
    "Tile_173078_LD_010_017_L18",
    "Tile_173078_LD_010_018_L18",
    "Tile_173078_LD_010_019_L18",
    "Tile_173078_LD_011_017_L18",
    "Tile_173078_LD_011_018_L18",
    "Tile_173078_LD_011_019_L18",
    "Tile_173078_LD_012_017_L18",
    "Tile_173078_LD_012_018_L18",
    "Tile_173078_LD_012_019_L18",
  ];

  const [allFragments, setAllFragments] = useState<FragmentMesh[]>([]);
  const tilesGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!tilesGroupRef.current) return;

    const fragments: FragmentMesh[] = [];
    tilesGroupRef.current.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        typeof child.userData?.randomness === "number" &&
        child.userData.fragmentCenter
      ) {
        fragments.push(child as FragmentMesh);
      }
    });

    if (fragments.length === 0) return;

    const sortedFragments = [...fragments].sort(
      (a, b) => b.userData.randomness - a.userData.randomness,
    );

    const GRID_SIZE = 12;
    const allPositions = fragments.map((f) => f.userData.baseCenter);
    const fullBBox = new THREE.Box3().setFromPoints(allPositions);
    const size = new THREE.Vector3();
    fullBBox.getSize(size);
    const cellWidth = size.x / GRID_SIZE;
    const cellHeight = size.y / GRID_SIZE;

    const mapGridToWorld = (gx: number, gy: number) => {
      const newX = fullBBox.min.x + gx * cellWidth + cellWidth / 2;
      const newY = fullBBox.min.y + gy * cellHeight + cellHeight / 2;
      return new THREE.Vector3(newX, newY, 0);
    };

    if (layout === "Original") {
      sortedFragments.forEach((fragment) => {
        fragment.userData.orderedCenter = fragment.userData.baseCenter.clone();
      });
    } else {
      // Multi-letter or single letter layout
      const letters = layout.split("");
      const fragmentsPerLetter = Math.floor(
        sortedFragments.length / letters.length,
      );
      const remainder = sortedFragments.length % letters.length;

      const centerX = fullBBox.min.x + size.x / 2;
      const centerY = fullBBox.min.y + size.y / 2;
      const scaledSizeX = size.x * letterScale * letterAspect;
      const scaledSizeY = size.y * letterScale;

      // Total width of all letters side by side (with spacing)
      const letterGap = scaledSizeX * letterSpacing;
      const totalWidth = letters.length * scaledSizeX + (letters.length - 1) * letterGap;
      const startOffsetX = -totalWidth / 2 + scaledSizeX / 2;

      let fragmentIndex = 0;

      letters.forEach((letter, letterIdx) => {
        // Distribute remainder fragments to first letters
        const count = fragmentsPerLetter + (letterIdx < remainder ? 1 : 0);
        const letterFragments = sortedFragments.slice(
          fragmentIndex,
          fragmentIndex + count,
        );
        fragmentIndex += count;

        const letterPoints = getLetterPoints(letter, letterFragments.length);
        if (letterPoints.length > 0) {
          const xOffset = startOffsetX + letterIdx * (scaledSizeX + letterGap);

          letterFragments.forEach((fragment, index) => {
            const pointIndex = index % letterPoints.length;
            const point = letterPoints[pointIndex];
            const jitter = cellWidth * letterJitter;
            const newX =
              centerX +
              xOffset +
              (point.x - 0.5) * scaledSizeX +
              Math.random() * jitter;
            const newY =
              centerY + (point.y - 0.5) * scaledSizeY + Math.random() * jitter;
            fragment.userData.orderedCenter = new THREE.Vector3(newX, newY, 0);
          });
        } else {
          letterFragments.forEach((fragment) => {
            fragment.userData.orderedCenter =
              fragment.userData.baseCenter.clone();
          });
        }
      });
    }

    sortedFragments.forEach((fragment, index) => {
      fragment.userData.rank = index;
      fragment.userData.adjacentConnections = [];
      for (let offset = -adjacencyWindow; offset <= adjacencyWindow; offset++) {
        if (offset === 0) continue;
        const adjacentIndex = index + offset;
        if (adjacentIndex >= 0 && adjacentIndex < sortedFragments.length) {
          const adjacentFragment = sortedFragments[adjacentIndex];
          const targetPos =
            layout !== "Original" && adjacentFragment.userData.orderedCenter
              ? adjacentFragment.userData.orderedCenter.clone()
              : adjacentFragment.userData.baseCenter.clone();
          fragment.userData.adjacentConnections.push({
            position: targetPos,
            height: adjacentFragment.userData.randomness,
          });
        }
      }
    });

    setAllFragments(fragments);
  }, [layout, adjacencyWindow, letterScale, letterAspect, letterSpacing, letterJitter]);

  return (
    <group scale={scale}>
      <group ref={tilesGroupRef}>
        {tiles.map((name) => (
          <Tile
            key={name}
            modelName={name}
            explosion={explosion}
            baseColor={baseColor}
            baseOpacity={baseOpacity}
            layout={layout}
            wireframe={wireframe}
            flattenTextures={flattenTextures}
            flatPaletteColor={flatPaletteColor}
            flatOpacity={flatOpacity}
          />
        ))}
      </group>

      {allFragments.map((fragment, i) => (
        <AdjacencyLines
          key={`adj-${i}`}
          fragment={fragment}
          factor={explosion}
          adjacencyColor={adjacencyColor}
          adjacencyOpacity={adjacencyOpacity}
          layout={layout}
        />
      ))}
    </group>
  );
}

function AdjacencyLines({
  fragment,
  factor,
  adjacencyColor,
  adjacencyOpacity,
  layout,
}: AdjacencyLinesProps) {
  const adjacencyLinesRef = useRef<
    (THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> | null)[]
  >([]);

  const springs = useSpring({
    x:
      layout !== "Original" && fragment.userData.orderedCenter
        ? fragment.userData.orderedCenter.x
        : fragment.userData.baseCenter.x,
    y:
      layout !== "Original" && fragment.userData.orderedCenter
        ? fragment.userData.orderedCenter.y
        : fragment.userData.baseCenter.y,
  });

  useFrame(() => {
    if (!fragment.userData.adjacentConnections || !adjacencyLinesRef.current)
      return;

    fragment.userData.adjacentConnections.forEach((adjacent, i) => {
      if (adjacencyLinesRef.current[i]) {
        const currentPos = new THREE.Vector3(
          springs.x.get(),
          springs.y.get(),
          0,
        );
        currentPos.z = -fragment.userData.randomness * factor;

        const adjacentPos = new THREE.Vector3().copy(adjacent.position);
        adjacentPos.z = -adjacent.height * factor;

        const points = [currentPos, adjacentPos];
        adjacencyLinesRef.current[i].geometry.setFromPoints(points);
      }
    });
  });

  if (!fragment.userData.adjacentConnections) return null;

  return (
    <group>
      {fragment.userData.adjacentConnections.map((_, i) => (
        <Line3
          key={i}
          ref={(
            el: THREE.Line<
              THREE.BufferGeometry,
              THREE.LineBasicMaterial
            > | null,
          ) => {
            if (!adjacencyLinesRef.current) adjacencyLinesRef.current = [];
            adjacencyLinesRef.current[i] = el;
          }}
          geometry={new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(),
            new THREE.Vector3(),
          ])}
        >
          <lineBasicMaterial
            color={adjacencyColor}
            transparent
            opacity={adjacencyOpacity}
          />
        </Line3>
      ))}
    </group>
  );
}

function Fragment({
  fragment,
  factor,
  baseColor,
  baseOpacity,
  flatOpacity,
  layout,
  wireframe,
  flattenTextures,
  flatPaletteColor,
}: FragmentProps) {
  const meshRef = useRef<FragmentMesh | null>(null);
  const lineRef = useRef<THREE.Line<
    THREE.BufferGeometry,
    THREE.LineBasicMaterial
  > | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);

  const { x, y } = useSpring({
    x:
      layout !== "Original" && fragment.userData.orderedCenter
        ? fragment.userData.orderedCenter.x
        : fragment.userData.baseCenter.x,
    y:
      layout !== "Original" && fragment.userData.orderedCenter
        ? fragment.userData.orderedCenter.y
        : fragment.userData.baseCenter.y,
    config: { mass: 1, tension: 120, friction: 14 },
  });

  useFrame(() => {
    const zPos = fragment.userData.randomness * factor;
    if (meshRef.current) {
      // This position is relative to the animated group
      meshRef.current.position.z = zPos;
    }

    if (lineRef.current) {
      const points = [
        new THREE.Vector3(0, 0, -zPos),
        new THREE.Vector3(0, 0, zPos),
      ];
      lineRef.current.geometry.setFromPoints(points);
    }
  });

  useEffect(() => {
    if (!fragment || !fragment.material) return;
    const applyWireframe = (material: FragmentMaterial) => {
      if (!material) return;
      material.wireframe = wireframe;
      material.needsUpdate = true;
    };
    if (Array.isArray(fragment.material)) {
      fragment.material.forEach(applyWireframe);
    } else {
      applyWireframe(fragment.material);
    }
  }, [fragment, wireframe]);

  useEffect(() => {
    if (!fragment || !fragment.material) return;
    const paletteColors = flatPaletteColor ? [flatPaletteColor] : null;
    const applyFlatTexture = (material: FragmentMaterial) => {
      if (!material) return;
      if (!material.userData) material.userData = {};
      if (!material.userData.originalMapSaved) {
        material.userData.originalMap =
          "map" in material ? material.map || null : null;
        material.userData.originalColor =
          "color" in material && material.color ? material.color.clone() : null;
        material.userData.originalOpacity = material.opacity ?? 1;
        material.userData.originalMapSaved = true;
      }
      const targetOpacity = flattenTextures ? flatOpacity : baseOpacity;
      if ("map" in material) {
        material.map = flattenTextures ? null : material.userData.originalMap;
      }
      if ("color" in material && material.color) {
        if (flattenTextures) {
          if (paletteColors && paletteColors.length > 0) {
            const colorIdx =
              (fragment.userData.rank ?? 0) % paletteColors.length;
            material.color.set(paletteColors[colorIdx]);
          } else if (baseColor) {
            material.color.set(baseColor);
          }
        } else if (
          material.userData.originalColor &&
          material.userData.originalColor instanceof THREE.Color
        ) {
          material.color.copy(material.userData.originalColor);
        }
      }
      material.opacity = targetOpacity;
      material.transparent = targetOpacity < 1;
      material.needsUpdate = true;
    };
    if (Array.isArray(fragment.material)) {
      fragment.material.forEach(applyFlatTexture);
    } else {
      applyFlatTexture(fragment.material);
    }
  }, [
    fragment,
    flattenTextures,
    baseColor,
    flatPaletteColor,
    baseOpacity,
    flatOpacity,
  ]);

  const fragmentPosition = useMemo(
    () =>
      new THREE.Vector3()
        .copy(fragment.userData.fragmentCenter)
        .multiplyScalar(-1),
    [fragment],
  );

  return (
    <animated.group ref={groupRef} position-x={x} position-y={y}>
      <primitive ref={meshRef} object={fragment} position={fragmentPosition} />
      <mesh>
        <boxGeometry
          args={[
            fragment.userData.baseSize.x,
            fragment.userData.baseSize.y,
            fragment.userData.baseSize.z,
          ]}
        />
        <meshBasicMaterial
          color={baseColor || "#aaaaaa"}
          wireframe={wireframe}
          transparent={baseOpacity < 1}
          opacity={baseOpacity}
          depthWrite={baseOpacity === 1}
        />
      </mesh>
      <Line3 ref={lineRef}>
        <bufferGeometry />
        <lineBasicMaterial
          color={baseColor || "#aaaaaa"}
          transparent={baseOpacity < 1}
          opacity={baseOpacity}
        />
      </Line3>
    </animated.group>
  );
}

export default function App() {
  const { explosion } = useControls({
    explosion: { value: 0, min: 0, max: 400, step: 0.001 },
  });

  const [typedText, setTypedText] = useState<string>("");
  const [exportPNG, setExportPNG] = useState<(() => void) | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea (e.g. Leva controls)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        setTypedText("");
        return;
      }
      if (e.key === "Backspace") {
        setTypedText((prev) => prev.slice(0, -1));
        return;
      }
      const upper = e.key.toUpperCase();
      if (/^[A-Z]$/.test(upper)) {
        setTypedText((prev) => prev + upper);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const layoutControl = useControls("Collage", {
    letters: {
      value: "LG",
      label: "Letters",
    },
    letterScale: {
      value: 50,
      min: 1,
      max: 100,
      step: 1,
      label: "Letter Scale",
    },
    letterAspect: {
      value: 1.0,
      min: 0.2,
      max: 3.0,
      step: 0.01,
      label: "Letter Aspect (Width)",
    },
    letterSpacing: {
      value: -1,
      min: -2,
      max: 2.0,
      step: 0.01,
      label: "Letter Spacing",
    },
    letterJitter: {
      value: 0.9,
      min: 0,
      max: 3,
      step: 0.01,
      label: "Letter Jitter",
    },
  });
  // Keyboard typedText overrides text input
  // Filter to only valid A-Z letters and convert to uppercase
  const inputLetters = (layoutControl.letters as string)
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  const layout: LayoutOption =
    typedText.length > 0
      ? typedText
      : inputLetters.length > 0
        ? inputLetters
        : "Original";
  const letterScale = layoutControl.letterScale as number;
  const letterAspect = layoutControl.letterAspect as number;
  const letterSpacing = layoutControl.letterSpacing as number;
  const letterJitter = layoutControl.letterJitter as number;

  const { baseColor, baseOpacity, wireframe, whiteBg } = useControls("Base", {
    baseColor: { value: COLORS.baseColor, label: "Color" },
    baseOpacity: { value: 1, min: 0, max: 1, step: 0.01, label: "Opacity" },
    wireframe: { value: true, label: "Wireframe" },
    whiteBg: { value: true, label: "White BG" },
  });

  const { flattenTextures, flatPaletteColor, flatOpacity } = useControls(
    "Flat",
    {
      flattenTextures: { value: true, label: "Flat Color Only" },
      flatPaletteColor: {
        value: COLORS.baseColor,
        label: "Flat Palette Color",
      },
      flatOpacity: {
        value: 0.15,
        min: 0,
        max: 1,
        step: 0.01,
        label: "Flat Opacity",
      },
    },
  );

  const { adjacencyColor, adjacencyOpacity, adjacencyWindow } = useControls(
    "Adjacency",
    {
      adjacencyColor: {
        value: COLORS.adjacencyColor,
        label: "Adjacency Color",
      },
      adjacencyOpacity: {
        value: 0,
        min: 0,
        max: 1,
        step: 0.01,
        label: "Adjacency Opacity",
      },
      adjacencyWindow: { value: 2, min: 1, max: 5, step: 1 },
    },
  );
  const scale = INIT.scale;

  return (
    <Container $whiteBg={whiteBg}>
      <CanvasWrapper>
        <Canvas
          camera={{ fov: 80 }}
          gl={{ alpha: true, preserveDrawingBuffer: true }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          }}
        >
          <color attach="background" args={[whiteBg ? "#ffffff" : "#000000"]} />

          <Suspense fallback={null}>
            <Center rotation={[-Math.PI / 2, 0, 0]}>
              <Cityscape
                scale={scale}
                explosion={explosion}
                baseColor={baseColor}
                baseOpacity={baseOpacity}
                adjacencyColor={adjacencyColor}
                adjacencyOpacity={adjacencyOpacity}
                adjacencyWindow={adjacencyWindow}
                layout={layout}
                letterScale={letterScale}
                letterAspect={letterAspect}
                letterSpacing={letterSpacing}
                letterJitter={letterJitter}
                wireframe={wireframe}
                flattenTextures={flattenTextures}
                flatPaletteColor={flatPaletteColor}
                flatOpacity={flatOpacity}
              />
            </Center>
          </Suspense>
          <ambientLight intensity={2} />
          <pointLight position={[10, 10, 10]} />
          <OrbitControls />
          <PNGExporter
            onExportReady={(fn) => setExportPNG(() => fn)}
            layout={layout}
          />
        </Canvas>
        <ExportButton onClick={() => exportPNG?.()}>
          Export PNG
        </ExportButton>
      </CanvasWrapper>
    </Container>
  );
}
