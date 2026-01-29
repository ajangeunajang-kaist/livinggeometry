'use client';

import { Canvas, useLoader, useFrame, type ThreeElements } from "@react-three/fiber";
import { OrbitControls, Center } from "@react-three/drei";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { Suspense, useRef, useState, useEffect, useMemo, forwardRef } from "react";
import styled from "styled-components";
import { useControls, Leva } from "leva";
import * as THREE from "three";
import { useSpring, animated } from "@react-spring/three";

type LayoutOption =
  | "Original"
  | "Grid"
  | "Spiral"
  | "Hurricane"
  | "Wave"
  | "Radial"
  | "Galaxy"
  | "Tsunami"
  | "Alternating"
  | "Deconstruction"
  | "Metabolism"
  | "Programmatic"
  | "Alphabet";

type AlphabetLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";

// LIVING GEOMETRY 문자 시퀀스
const LIVING_GEOMETRY_SEQUENCE: AlphabetLetter[] = ['L', 'I', 'V', 'I', 'N', 'G', 'G', 'E', 'O', 'M', 'E', 'T', 'R', 'Y'];

// A~Z 알파벳 좌표 데이터 (정규화된 0~1 범위)
const ALPHABET_COORDS: Record<AlphabetLetter, Array<[number, number]>> = {
  A: [[0.5, 0], [0, 1], [0.25, 0.5], [0.75, 0.5], [1, 1], [0.5, 0]],
  B: [[0, 0], [0, 1], [0.7, 1], [0.8, 0.85], [0.8, 0.65], [0.7, 0.5], [0, 0.5], [0.7, 0.5], [0.8, 0.35], [0.8, 0.15], [0.7, 0], [0, 0]],
  C: [[1, 0.15], [0.7, 0], [0.3, 0], [0, 0.15], [0, 0.85], [0.3, 1], [0.7, 1], [1, 0.85]],
  D: [[0, 0], [0, 1], [0.6, 1], [0.9, 0.8], [1, 0.5], [0.9, 0.2], [0.6, 0], [0, 0]],
  E: [[1, 0], [0, 0], [0, 0.5], [0.7, 0.5], [0, 0.5], [0, 1], [1, 1]],
  F: [[0, 1], [0, 0], [1, 0], [0, 0], [0, 0.5], [0.7, 0.5]],
  G: [[1, 0.2], [0.7, 0], [0.3, 0], [0, 0.2], [0, 0.8], [0.3, 1], [0.7, 1], [1, 0.8], [1, 0.5], [0.5, 0.5]],
  H: [[0, 0], [0, 1], [0, 0.5], [1, 0.5], [1, 0], [1, 1]],
  I: [[0.3, 0], [0.7, 0], [0.5, 0], [0.5, 1], [0.3, 1], [0.7, 1]],
  J: [[0.2, 0], [0.8, 0], [0.6, 0], [0.6, 0.8], [0.5, 1], [0.3, 1], [0.1, 0.8], [0.1, 0.6]],
  K: [[0, 0], [0, 1], [0, 0.5], [1, 0], [0, 0.5], [1, 1]],
  L: [[0, 0], [0, 1], [1, 1]],
  M: [[0, 1], [0, 0], [0.5, 0.5], [1, 0], [1, 1]],
  N: [[0, 1], [0, 0], [1, 1], [1, 0]],
  O: [[0.5, 0], [0.15, 0.15], [0, 0.5], [0.15, 0.85], [0.5, 1], [0.85, 0.85], [1, 0.5], [0.85, 0.15], [0.5, 0]],
  P: [[0, 1], [0, 0], [0.7, 0], [1, 0.15], [1, 0.35], [0.7, 0.5], [0, 0.5]],
  Q: [[0.5, 0], [0.15, 0.15], [0, 0.5], [0.15, 0.85], [0.5, 1], [0.85, 0.85], [1, 0.5], [0.85, 0.15], [0.5, 0], [0.6, 0.7], [1, 1]],
  R: [[0, 1], [0, 0], [0.7, 0], [1, 0.15], [1, 0.35], [0.7, 0.5], [0, 0.5], [1, 1]],
  S: [[1, 0.15], [0.7, 0], [0.3, 0], [0, 0.15], [0, 0.35], [0.3, 0.5], [0.7, 0.5], [1, 0.65], [1, 0.85], [0.7, 1], [0.3, 1], [0, 0.85]],
  T: [[0, 0], [1, 0], [0.5, 0], [0.5, 1]],
  U: [[0, 0], [0, 0.8], [0.2, 1], [0.8, 1], [1, 0.8], [1, 0]],
  V: [[0, 0], [0.5, 1], [1, 0]],
  W: [[0, 0], [0.25, 1], [0.5, 0.5], [0.75, 1], [1, 0]],
  X: [[0, 0], [1, 1], [0.5, 0.5], [0, 1], [1, 0]],
  Y: [[0, 0], [0.5, 0.5], [1, 0], [0.5, 0.5], [0.5, 1]],
  Z: [[0, 0], [1, 0], [0, 1], [1, 1]]
};

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
  selectedLetter: AlphabetLetter;
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
    baseColor: "white",
    adjacencyColor: "rgba(255,255,255,0.5)"
};

const INIT = {
    camPos: { x: 111, y: -23, z: -145 },
    camRot: {rotX: 0.00, rotY: 2.35, rotZ: 0.00 },
    scale: 0.05,
}

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

const Line3 = forwardRef<THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>, any>(
  (props, ref) => <line ref={ref as any} {...props} />
);
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
                const material = meshChild.material as FragmentMaterial | FragmentMaterial[];

                geometry.computeBoundingBox();
                const bbox = geometry.boundingBox as THREE.Box3;
                
                const gridSize = 4;
                const chunks: ChunkData[] = Array.from({ length: gridSize * gridSize }, () => ({
                    vertices: [],
                    normals: [],
                    uvs: [],
                }));

                const position = geometry.attributes.position;
                const normal = geometry.attributes.normal;
                const uv = geometry.attributes.uv;

                const cellSizeX = (bbox.max.x - bbox.min.x) / gridSize;
                const cellSizeY = (bbox.max.y - bbox.min.y) / gridSize;

                for (let i = 0; i < position.count; i += 3) {
                    const v1 = new THREE.Vector3().fromBufferAttribute(position, i);
                    const v2 = new THREE.Vector3().fromBufferAttribute(position, i + 1);
                    const v3 = new THREE.Vector3().fromBufferAttribute(position, i + 2);
                    const centroid = new THREE.Vector3().add(v1).add(v2).add(v3).divideScalar(3);

                    let gridX = Math.floor((centroid.x - bbox.min.x) / cellSizeX);
                    let gridY = Math.floor((centroid.y - bbox.min.y) / cellSizeY);
                    gridX = THREE.MathUtils.clamp(gridX, 0, gridSize - 1);
                    gridY = THREE.MathUtils.clamp(gridY, 0, gridSize - 1);

                    const chunkIndex = gridY * gridSize + gridX;

                    for (let j = 0; j < 3; j++) {
                        const index = i + j;
                        chunks[chunkIndex].vertices.push(position.getX(index), position.getY(index), position.getZ(index));
                        if (normal) {
                            chunks[chunkIndex].normals.push(normal.getX(index), normal.getY(index), normal.getZ(index));
                        }
                        if (uv) {
                            chunks[chunkIndex].uvs.push(uv.getX(index), uv.getY(index));
                        }
                    }
                }

                const geometriesWithData = chunks.map((chunk: ChunkData) => {
                    if (chunk.vertices.length === 0) return null;

                    const newGeometry = new THREE.BufferGeometry();
                    newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(chunk.vertices, 3));
                    if (chunk.normals.length > 0) {
                        newGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(chunk.normals, 3));
                    }
                    if (chunk.uvs.length > 0) {
                        newGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(chunk.uvs, 2));
                    }
                    newGeometry.computeBoundingBox();
                    const bbox = newGeometry.boundingBox as THREE.Box3;
                    const height = bbox.max.z - bbox.min.z;
                    return { geometry: newGeometry, height };
                }).filter((entry): entry is { geometry: THREE.BufferGeometry; height: number } => entry !== null);

                const maxHeight = Math.max(...geometriesWithData.map((d) => d.height));

                geometriesWithData.forEach(({ geometry, height }: { geometry: THREE.BufferGeometry; height: number }) => {
                    const normalizedHeight = maxHeight > 0 ? height / maxHeight : 0;
                    
                    const mesh = new THREE.Mesh(geometry, material) as FragmentMesh;
                    mesh.userData.randomness = normalizedHeight;

                    const bbox = geometry.boundingBox as THREE.Box3;
                    const center = new THREE.Vector3();
                    bbox.getCenter(center);
                    mesh.userData.baseCenter = new THREE.Vector3(center.x, center.y, 0);
                    mesh.userData.baseSize = new THREE.Vector3(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y, 0.1);
                    mesh.userData.fragmentCenter = center.clone();
                    mesh.userData.height = normalizedHeight;
                    
                    frags.push(mesh);
                });
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

function Cityscape({ scale, explosion, baseColor, baseOpacity, adjacencyColor, adjacencyOpacity, adjacencyWindow, layout, selectedLetter, wireframe, flattenTextures, flatPaletteColor, flatOpacity }: CityscapeProps) {
    const tiles = [
        'Tile_173078_LD_010_017_L18',
        'Tile_173078_LD_010_018_L18',
        'Tile_173078_LD_010_019_L18',
        'Tile_173078_LD_011_017_L18',
        'Tile_173078_LD_011_018_L18',
        'Tile_173078_LD_011_019_L18',
        'Tile_173078_LD_012_017_L18',
        'Tile_173078_LD_012_018_L18',
        'Tile_173078_LD_012_019_L18'
    ];

    const [allFragments, setAllFragments] = useState<FragmentMesh[]>([]);
    const tilesGroupRef = useRef<THREE.Group | null>(null);

    useEffect(() => {
        if (!tilesGroupRef.current) return;
        
        const fragments: FragmentMesh[] = [];
        tilesGroupRef.current.traverse((child) => {
            if (
                child instanceof THREE.Mesh &&
                typeof child.userData?.randomness === 'number' &&
                child.userData.fragmentCenter
            ) {
                fragments.push(child as FragmentMesh);
            }
        });

        if (fragments.length === 0) return;

        const sortedFragments = [...fragments].sort((a, b) => b.userData.randomness - a.userData.randomness);
        
        const GRID_SIZE = 12;
        const allPositions = fragments.map(f => f.userData.baseCenter);
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

        if (layout === 'Original') {
            sortedFragments.forEach(fragment => {
                fragment.userData.orderedCenter = fragment.userData.baseCenter.clone();
            });
        } else if (layout === 'Grid') {
            const numFragments = sortedFragments.length;
            const fragmentsPerArea = Math.ceil(numFragments / 16);
            sortedFragments.forEach((fragment, index) => {
                const areaIndex = Math.floor(index / fragmentsPerArea);
                const indexInArea = index % fragmentsPerArea;
                const areaX = areaIndex % 4;
                const areaY = Math.floor(areaIndex / 4);
                const subX = indexInArea % 3;
                const subY = Math.floor(indexInArea / 3);
                const finalX = areaX * 3 + subX;
                const finalY = areaY * 3 + subY;
                fragment.userData.orderedCenter = mapGridToWorld(finalX, finalY);
            });
        } else if (layout === 'Spiral') {
            let x = 0, y = 0, dx = 0, dy = -1;
            const centerOffset = Math.floor(GRID_SIZE / 2);
            for (let i = 0; i < sortedFragments.length; i++) {
                if ((-GRID_SIZE/2 < x && x <= GRID_SIZE/2) && (-GRID_SIZE/2 < y && y <= GRID_SIZE/2)) {
                    if (sortedFragments[i]) {
                         sortedFragments[i].userData.orderedCenter = mapGridToWorld(x + centerOffset, y + centerOffset);
                    }
                }
                if (x === y || (x < 0 && x === -y) || (x > 0 && x === 1-y)) {
                    [dx, dy] = [-dy, dx];
                }
                x += dx; y += dy;
            }
        } else if (layout === 'Hurricane') {
            const reversedFragments = [...sortedFragments].reverse();
            let x = 0, y = 0, dx = 0, dy = -1;
            const centerOffset = Math.floor(GRID_SIZE / 2);
             for (let i = 0; i < reversedFragments.length; i++) {
                if ((-GRID_SIZE/2 < x && x <= GRID_SIZE/2) && (-GRID_SIZE/2 < y && y <= GRID_SIZE/2)) {
                    if (reversedFragments[i]) {
                        reversedFragments[i].userData.orderedCenter = mapGridToWorld(x + centerOffset, y + centerOffset);
                    }
                }
                if (x === y || (x < 0 && x === -y) || (x > 0 && x === 1-y)) {
                    [dx, dy] = [-dy, dx];
                }
                x += dx; y += dy;
            }
        } else if (layout === 'Wave') {
            const numFragments = sortedFragments.length;
            const amplitude = size.y / 3;
            const frequency = 3;
            sortedFragments.forEach((fragment, index) => {
                const progress = index / (numFragments - 1);
                const newX = fullBBox.min.x + progress * size.x;
                const newY = fullBBox.min.y + size.y / 2 + amplitude * Math.sin(progress * frequency * Math.PI * 2);
                fragment.userData.orderedCenter = new THREE.Vector3(newX, newY, 0);
            });
        } else if (layout === 'Radial') {
            const numFragments = sortedFragments.length;
            const center = new THREE.Vector3(fullBBox.min.x + size.x / 2, fullBBox.min.y + size.y / 2, 0);
            const maxRadius = Math.min(size.x, size.y) / 2;
            sortedFragments.forEach((fragment, index) => {
                const radius = (index / (numFragments - 1)) * maxRadius;
                const angle = index * Math.PI * (3 - Math.sqrt(5)); // Golden angle
                const newX = center.x + Math.cos(angle) * radius;
                const newY = center.y + Math.sin(angle) * radius;
                fragment.userData.orderedCenter = new THREE.Vector3(newX, newY, 0);
            });
        } else if (layout === 'Galaxy') {
            const numClusters = 5;
            type Cluster = { center: THREE.Vector3; fragments: FragmentMesh[] };
            const clusters: Cluster[] = Array.from({ length: numClusters }, () => ({
                center: new THREE.Vector3(
                    fullBBox.min.x + Math.random() * size.x,
                    fullBBox.min.y + Math.random() * size.y,
                    0
                ),
                fragments: []
            }));

            sortedFragments.forEach((fragment, index) => {
                clusters[index % numClusters].fragments.push(fragment);
            });

            clusters.forEach(cluster => {
                const clusterRadius = size.x / (numClusters * 2);
                cluster.fragments.forEach(fragment => {
                    const angle = Math.random() * 2 * Math.PI;
                    const radius = Math.random() * clusterRadius;
                    const newX = cluster.center.x + Math.cos(angle) * radius;
                    const newY = cluster.center.y + Math.sin(angle) * radius;
                    fragment.userData.orderedCenter = new THREE.Vector3(newX, newY, 0);
                });
            });
        } else if (layout === 'Tsunami') {
            const numFragments = sortedFragments.length;
            const reversedFragments = [...sortedFragments].reverse(); 
            reversedFragments.forEach((fragment, index) => {
                const progress = index / (numFragments - 1);
                const newX = fullBBox.min.x + progress * size.x;
                const scale = size.y / (Math.exp(1) - 1);
                const newY = fullBBox.min.y + (Math.exp(progress) - 1) * scale;
                fragment.userData.orderedCenter = new THREE.Vector3(newX, newY, 0);
            });
        } else if (layout === 'Alternating') {
            const oddFragments = sortedFragments.filter((_, i) => i % 2 !== 0);
            const evenFragments = sortedFragments.filter((_, i) => i % 2 === 0);
            const halfWidth = size.x / 2;
            
            const layoutGroup = (fragments: FragmentMesh[], bbox: THREE.Box3) => {
                const num = fragments.length;
                if (num === 0) return;
                const groupSize = new THREE.Vector3();
                bbox.getSize(groupSize);
                const gridDim = Math.ceil(Math.sqrt(num));
                const cellW = groupSize.x / gridDim;
                const cellH = groupSize.y / gridDim;

                fragments.forEach((fragment: FragmentMesh, i: number) => {
                    const gx = i % gridDim;
                    const gy = Math.floor(i / gridDim);
                    const newX = bbox.min.x + gx * cellW + cellW/2;
                    const newY = bbox.min.y + gy * cellH + cellH/2;
                    fragment.userData.orderedCenter = new THREE.Vector3(newX, newY, 0);
                });
            };

            const leftBBox = new THREE.Box3(
                fullBBox.min.clone(),
                new THREE.Vector3(fullBBox.min.x + halfWidth, fullBBox.max.y, 0)
            );
            const rightBBox = new THREE.Box3(
                new THREE.Vector3(fullBBox.min.x + halfWidth, fullBBox.min.y, 0),
                fullBBox.max.clone()
            );

            layoutGroup(oddFragments, leftBBox);
            layoutGroup(evenFragments, rightBBox);
        } else if (layout === 'Deconstruction') {
            const numFragments = sortedFragments.length;
            const gridDim = Math.ceil(Math.sqrt(numFragments));
            const center = new THREE.Vector3(fullBBox.min.x + size.x / 2, fullBBox.min.y + size.y / 2, 0);

            sortedFragments.forEach((fragment, index) => {
                const gridX = (index % gridDim) - (gridDim -1) / 2;
                const gridY = Math.floor(index / gridDim) - (gridDim -1) / 2;
                
                const basePos = new THREE.Vector3(gridX * (size.x / gridDim), gridY * (size.y / gridDim), 0);
                
                const angle = fragment.userData.randomness * Math.PI / 4; 
                const displacement = fragment.userData.randomness * 50;

                basePos.applyAxisAngle(new THREE.Vector3(0, 0, 1), angle);
                
                const direction = new THREE.Vector3().copy(basePos).normalize();
                basePos.add(direction.multiplyScalar(displacement));

                fragment.userData.orderedCenter = basePos.add(center);
            });
        } else if (layout === 'Metabolism') {
            const numFragments = sortedFragments.length;
            const center = new THREE.Vector3(fullBBox.min.x + size.x / 2, fullBBox.min.y, 0);
            const branchWidth = size.x / 4;
            
            sortedFragments.forEach((fragment, index) => {
                const progress = index / (numFragments - 1);
                const newY = fullBBox.min.y + progress * size.y;
                const offset = (Math.sin(progress * Math.PI * 4) * branchWidth) + (index % 2 === 0 ? -branchWidth/2 : branchWidth/2);
                const newX = center.x + offset;
                fragment.userData.orderedCenter = new THREE.Vector3(newX, newY, 0);
            });
        } else if (layout === 'Programmatic') {
            const topTier = sortedFragments.slice(0, Math.floor(sortedFragments.length * 0.2));
            const midTier = sortedFragments.slice(topTier.length, topTier.length + Math.floor(sortedFragments.length * 0.4));
            const lowTier = sortedFragments.slice(topTier.length + midTier.length);

            // Tallest as a line
            const lineStart = new THREE.Vector3(fullBBox.min.x, fullBBox.max.y, 0);
            const lineEnd = new THREE.Vector3(fullBBox.max.x, fullBBox.max.y, 0);
            topTier.forEach((fragment, i) => {
                fragment.userData.orderedCenter = new THREE.Vector3().lerpVectors(lineStart, lineEnd, i / (topTier.length - 1));
            });

            // Medium as a block
            const blockBBox = new THREE.Box3(
                new THREE.Vector3(fullBBox.min.x, fullBBox.min.y, 0),
                new THREE.Vector3(fullBBox.min.x + size.x / 2, fullBBox.min.y + size.y / 2, 0)
            );
            const gridDim = Math.ceil(Math.sqrt(midTier.length));
            const cellW = (blockBBox.max.x - blockBBox.min.x) / gridDim;
            const cellH = (blockBBox.max.y - blockBBox.min.y) / gridDim;
            midTier.forEach((fragment, i) => {
                const gx = i % gridDim;
                const gy = Math.floor(i / gridDim);
                fragment.userData.orderedCenter = new THREE.Vector3(blockBBox.min.x + gx * cellW, blockBBox.min.y + gy*cellH, 0);
            });

            // Shortest as a circle
            const circleCenter = new THREE.Vector3(fullBBox.max.x - size.x / 4, fullBBox.min.y + size.y / 4, 0);
            const circleRadius = size.x / 5;
            lowTier.forEach((fragment, i) => {
                const angle = (i / lowTier.length) * Math.PI * 2;
                const radius = Math.sqrt(i / lowTier.length) * circleRadius; // Spread them out
                const newX = circleCenter.x + Math.cos(angle) * radius;
                const newY = circleCenter.y + Math.sin(angle) * radius;
                fragment.userData.orderedCenter = new THREE.Vector3(newX, newY, 0);
            });
        } else if (layout === 'Alphabet') {
            const letterCoords = ALPHABET_COORDS[selectedLetter];
            const numFragments = sortedFragments.length;

            // 알파벳 경로의 총 길이 계산
            let totalLength = 0;
            const segmentLengths: number[] = [];
            for (let i = 0; i < letterCoords.length - 1; i++) {
                const dx = letterCoords[i + 1][0] - letterCoords[i][0];
                const dy = letterCoords[i + 1][1] - letterCoords[i][1];
                const len = Math.sqrt(dx * dx + dy * dy);
                segmentLengths.push(len);
                totalLength += len;
            }

            // 각 프래그먼트를 경로를 따라 균등하게 배치
            sortedFragments.forEach((fragment, index) => {
                const targetDist = (index / (numFragments - 1)) * totalLength;

                let accumulatedDist = 0;
                let segmentIndex = 0;

                // 해당 거리가 어느 세그먼트에 있는지 찾기
                for (let i = 0; i < segmentLengths.length; i++) {
                    if (accumulatedDist + segmentLengths[i] >= targetDist) {
                        segmentIndex = i;
                        break;
                    }
                    accumulatedDist += segmentLengths[i];
                }

                // 세그먼트 내에서의 위치 계산
                const segmentProgress = segmentLengths[segmentIndex] > 0
                    ? (targetDist - accumulatedDist) / segmentLengths[segmentIndex]
                    : 0;

                const startCoord = letterCoords[segmentIndex];
                const endCoord = letterCoords[segmentIndex + 1] || startCoord;

                // 정규화된 좌표를 실제 좌표로 변환
                const normalizedX = startCoord[0] + (endCoord[0] - startCoord[0]) * segmentProgress;
                const normalizedY = startCoord[1] + (endCoord[1] - startCoord[1]) * segmentProgress;

                const newX = fullBBox.min.x + normalizedX * size.x;
                const newY = fullBBox.min.y + (1 - normalizedY) * size.y; // Y 뒤집기 (위가 0)

                fragment.userData.orderedCenter = new THREE.Vector3(newX, newY, 0);
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
                    const targetPos = (layout !== 'Original' && adjacentFragment.userData.orderedCenter) 
                        ? adjacentFragment.userData.orderedCenter.clone()
                        : adjacentFragment.userData.baseCenter.clone();
                    fragment.userData.adjacentConnections.push({
                        position: targetPos,
                        height: adjacentFragment.userData.randomness
                    });
                }
            }
        });

        setAllFragments(fragments);
    }, [layout, adjacencyWindow, selectedLetter]);

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

function AdjacencyLines({ fragment, factor, adjacencyColor, adjacencyOpacity, layout }: AdjacencyLinesProps) {
    const adjacencyLinesRef = useRef<(THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> | null)[]>([]);

    const springs = useSpring({
        x: (layout !== 'Original' && fragment.userData.orderedCenter) ? fragment.userData.orderedCenter.x : fragment.userData.baseCenter.x,
        y: (layout !== 'Original' && fragment.userData.orderedCenter) ? fragment.userData.orderedCenter.y : fragment.userData.baseCenter.y,
    });

    useFrame(() => {
        if (!fragment.userData.adjacentConnections || !adjacencyLinesRef.current) return;

        fragment.userData.adjacentConnections.forEach((adjacent, i) => {
            if (adjacencyLinesRef.current[i]) {
                const currentPos = new THREE.Vector3(springs.x.get(), springs.y.get(), 0);
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
                    ref={(el: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> | null) => {
                        if (!adjacencyLinesRef.current) adjacencyLinesRef.current = [];
                        adjacencyLinesRef.current[i] = el;
                    }}
                    geometry={new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])}
                >
                    <lineBasicMaterial color={adjacencyColor} transparent opacity={adjacencyOpacity} />
                </Line3>
            ))}
        </group>
    );
}

function Fragment({ fragment, factor, baseColor, baseOpacity, flatOpacity, layout, wireframe, flattenTextures, flatPaletteColor }: FragmentProps) {
    const meshRef = useRef<FragmentMesh | null>(null);
    const lineRef = useRef<THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> | null>(null);
    const groupRef = useRef<THREE.Group | null>(null);
    
    const { x, y } = useSpring({
        x: (layout !== 'Original' && fragment.userData.orderedCenter) ? fragment.userData.orderedCenter.x : fragment.userData.baseCenter.x,
        y: (layout !== 'Original' && fragment.userData.orderedCenter) ? fragment.userData.orderedCenter.y : fragment.userData.baseCenter.y,
        config: { mass: 1, tension: 100, friction: 8 }
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
                material.userData.originalMap = 'map' in material ? material.map || null : null;
                material.userData.originalColor = 'color' in material && material.color ? material.color.clone() : null;
                material.userData.originalOpacity = material.opacity ?? 1;
                material.userData.originalMapSaved = true;
            }
            const targetOpacity = flattenTextures ? flatOpacity : baseOpacity;
            if ('map' in material) {
                material.map = flattenTextures ? null : material.userData.originalMap;
            }
            if ('color' in material && material.color) {
                if (flattenTextures) {
                    if (paletteColors && paletteColors.length > 0) {
                        const colorIdx = (fragment.userData.rank ?? 0) % paletteColors.length;
                        material.color.set(paletteColors[colorIdx]);
                    } else if (baseColor) {
                        material.color.set(baseColor);
                    }
                } else if (material.userData.originalColor && material.userData.originalColor instanceof THREE.Color) {
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
    }, [fragment, flattenTextures, baseColor, flatPaletteColor, baseOpacity, flatOpacity]);

    const fragmentPosition = useMemo(() => new THREE.Vector3().copy(fragment.userData.fragmentCenter).multiplyScalar(-1), [fragment]);

    return (
      <animated.group ref={groupRef} position-x={x} position-y={y}>
        <primitive
          ref={meshRef}
          object={fragment}
          position={fragmentPosition}
        />
        <mesh>
          <boxGeometry
            args={[
              fragment.userData.baseSize.x,
              fragment.userData.baseSize.y,
              fragment.userData.baseSize.z,
            ]}
          />
          <meshBasicMaterial
            color={baseColor || "white"}
            wireframe={wireframe}
            transparent={baseOpacity < 1}
            opacity={baseOpacity}
            depthWrite={baseOpacity === 1}
          />
        </mesh>
        <Line3 ref={lineRef}>
          <bufferGeometry />
          <lineBasicMaterial
            color={baseColor || "white"}
            transparent={baseOpacity < 1}
            opacity={baseOpacity}
          />
        </Line3>
      </animated.group>
    );
}

export default function App() {
  const [sequenceIndex, setSequenceIndex] = useState(0);

  const { explosion } = useControls({
    explosion: { value: 300, min: 0, max: 400, step: 0.001 },
  });

  const layoutControl = useControls('Collage', {
    layout: {
      value: 'Alphabet',
      options: ['Original', 'Grid', 'Spiral', 'Hurricane', 'Wave', 'Radial', 'Galaxy', 'Tsunami', 'Alternating', 'Deconstruction', 'Metabolism', 'Programmatic', 'Alphabet'],
      label: 'Layout Style'
    },
    autoSequence: {
      value: true,
      label: 'Auto LIVING GEOMETRY'
    },
    sequenceSpeed: {
      value: 2000,
      min: 500,
      max: 10000,
      step: 100,
      label: 'Speed (ms)'
    },
    selectedLetter: {
      value: 'L',
      options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
      label: 'Letter (A~Z)'
    }
  });
  const layout = layoutControl.layout as LayoutOption;
  const autoSequence = layoutControl.autoSequence as boolean;
  const sequenceSpeed = layoutControl.sequenceSpeed as number;
  const manualLetter = layoutControl.selectedLetter as AlphabetLetter;

  // LIVING GEOMETRY 자동 순환
  useEffect(() => {
    if (layout !== 'Alphabet' || !autoSequence) return;

    const interval = setInterval(() => {
      setSequenceIndex((prev) => (prev + 1) % LIVING_GEOMETRY_SEQUENCE.length);
    }, sequenceSpeed);

    return () => clearInterval(interval);
  }, [layout, autoSequence, sequenceSpeed]);

  // 자동 순환이면 시퀀스 문자, 아니면 수동 선택 문자
  const selectedLetter = (layout === 'Alphabet' && autoSequence)
    ? LIVING_GEOMETRY_SEQUENCE[sequenceIndex]
    : manualLetter;

  const { baseColor, baseOpacity, wireframe, whiteBg } = useControls('Base', {
    baseColor: { value: COLORS.baseColor, label: 'Color' },
    baseOpacity: { value: 1, min: 0, max: 1, step: 0.01, label: 'Opacity' },
    wireframe: { value: true, label: 'Wireframe' },
    whiteBg: { value: true, label: 'White BG' },
  });

  const { flattenTextures, flatPaletteColor, flatOpacity } = useControls('Flat', {
    flattenTextures: { value: true, label: 'Flat Color Only' },
    flatPaletteColor: { value: COLORS.baseColor, label: 'Flat Palette Color' },
    flatOpacity: { value: 0.3, min: 0, max: 1, step: 0.01, label: 'Flat Opacity' },
  });

  const { adjacencyColor, adjacencyOpacity, adjacencyWindow } = useControls('Adjacency', {
    adjacencyColor: { value: COLORS.adjacencyColor, label: 'Adjacency Color' },
    adjacencyOpacity: { value: 0.5, min: 0, max: 1, step: 0.01, label: 'Adjacency Opacity' },
    adjacencyWindow: { value: 2, min: 1, max: 5, step: 1 },
  });
  const scale = INIT.scale;

  return (
    <>
      <Leva hidden />
      <Container $whiteBg={whiteBg}>
        <CanvasWrapper>
        <Canvas
          camera={{ fov: 80 }}
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
                selectedLetter={selectedLetter}
                wireframe={wireframe}
                flattenTextures={flattenTextures}
                flatPaletteColor={flatPaletteColor}
                flatOpacity={flatOpacity}
              />
            </Center>
          </Suspense>
          <ambientLight intensity={2} />
          <pointLight position={[10, 10, 10]} />
          <OrbitControls minDistance={20} maxDistance={50} />
        </Canvas>
      </CanvasWrapper>
      <h1 className="fixed w-full flex justify-center align-center text-white p-4">
        <svg
          width="100%"
          height="auto"
          viewBox="0 0 1334 110"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
        >
          <path
            d="M485.84 0C505.79 0 518.09 13.4998 520.49 32.8496H505.79C503.69 20.25 496.04 11.55 485.391 11.5498C466.941 11.5498 458.84 29.25 458.84 55.5C458.84 77.3999 465.44 98.2497 485.09 98.25C498.14 98.25 508.04 87.3 508.04 66V64.0498H483.74V52.5H520.641V107.4H509.24V92.8496C504.89 103.35 495.74 109.65 482.84 109.65C457.94 109.65 444.44 86.2498 444.44 55.5C444.44 20.7002 460.19 0.000197052 485.84 0ZM665.84 0C685.79 0 698.09 13.4998 700.49 32.8496H685.79C683.69 20.25 676.04 11.55 665.391 11.5498C646.941 11.5498 638.84 29.25 638.84 55.5C638.84 77.3999 645.44 98.2497 665.09 98.25C678.14 98.25 688.04 87.3 688.04 66V64.0498H663.74V52.5H700.641V107.4H689.24V92.8496C684.89 103.35 675.74 109.65 662.84 109.65C637.94 109.65 624.44 86.2498 624.44 55.5C624.44 20.7002 640.19 0.000197052 665.84 0ZM842.99 0C866.69 3.45096e-05 881.24 20.1004 881.24 54.9004C881.24 89.7001 866.69 109.65 842.99 109.65C819.29 109.65 804.74 89.7001 804.74 54.9004C804.74 20.1004 819.29 0 842.99 0ZM13.6504 95.8496H74.1006V107.4H0V2.40039H13.6504V95.8496ZM159.15 13.7998H129.75V95.8496H159.15V107.4H86.8506V95.8496H116.101V13.7998H86.8506V2.40039H159.15V13.7998ZM209.55 78.75C210.75 83.4 212.101 88.0502 213.601 92.7002C214.801 88.0502 216.001 83.55 217.351 78.75L238.641 2.40039H252.891L221.54 107.4H204.29L173.4 2.40039H188.101L209.55 78.75ZM339.15 13.7998H309.75V95.8496H339.15V107.4H266.851V95.8496H296.101V13.7998H266.851V2.40039H339.15V13.7998ZM413.99 91.9502V2.40039H427.34V107.4H407.09L371.99 15.5996V107.4H358.641V2.40039H379.79L413.99 91.9502ZM788.69 13.7998H734.84V48.1504H786.141V59.7002H734.84V95.8496H790.49V107.4H721.19V2.40039H788.69V13.7998ZM929.84 54C930.89 58.1999 932.09 62.2497 933.29 66.5996C934.34 62.3998 935.39 58.3499 936.59 54L950.09 2.40039H968.69V107.4H956.69L957.29 32.0996C957.29 25.6499 957.29 19.6501 957.44 15.4502L940.19 81.9004H925.79L908.24 15.5996C908.54 21.5996 908.54 25.6502 908.54 31.2002L909.141 107.4H897.141V2.40039H916.04L929.84 54ZM1058.69 13.7998H1004.84V48.1504H1056.14V59.7002H1004.84V95.8496H1060.49V107.4H991.19V2.40039H1058.69V13.7998ZM1153.94 13.7998H1119.74V107.4H1106.09V13.7998H1071.89V2.40039H1153.94V13.7998ZM1207.94 2.40039C1227.89 2.40047 1240.79 12.3001 1240.79 30C1240.79 43.1999 1230.74 52.65 1221.29 55.5C1231.34 57.15 1238.39 65.7 1238.39 79.5V107.4H1224.74V83.25C1224.74 66.6001 1218.29 61.5001 1202.69 61.5H1181.69V107.4H1168.04V2.40039H1207.94ZM1285.78 36.9004C1288.03 41.2503 1290.58 45.9005 1292.83 50.4004C1295.23 46.0504 1297.78 41.5498 1300.03 37.0498L1318.78 2.40039H1333.48L1299.73 62.0996V107.4H1285.93V62.0996L1252.93 2.40039H1267.93L1285.78 36.9004ZM842.99 11.5498C828.44 11.5498 818.99 27.3004 818.99 54.9004C818.99 82.5001 828.29 98.25 842.99 98.25C857.54 98.25 866.84 82.5001 866.84 54.9004C866.84 27.3004 857.54 11.5498 842.99 11.5498ZM1181.68 49.9502H1204.48C1218.73 49.9501 1226.83 43.5 1226.83 31.6504C1226.83 19.8005 1218.73 13.7999 1204.48 13.7998H1181.68V49.9502Z"
            fill="#898989"
          />
        </svg>
      </h1>
      <h2 className="fixed bottom-0 w-full flex justify-center align-center text-white p-4">
        <svg
          width="auto"
          height="89"
          viewBox="0 0 1655 89"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M246.837 0C264.866 3.48753e-05 276.845 10.6484 277.812 26.7412H264.019C263.414 17.7873 256.758 11.374 246.353 11.374C237.641 11.3741 230.502 16.0929 230.502 23.2314C230.502 30.3703 235.584 33.3956 245.143 35.9365L256.032 38.7197C269.342 42.1077 279.386 49.0048 279.386 62.5566C279.386 77.3182 266.56 88.6922 247.2 88.6924C227.84 88.6924 214.652 76.9552 213.805 58.5635H227.719C228.445 70.5422 236.189 77.4393 247.562 77.4395C258.089 77.4395 265.592 72.2364 265.592 63.8877C265.592 56.6278 260.025 53.3604 249.982 50.9404L239.939 48.3994C227.235 45.2534 216.829 37.7511 216.829 24.4414C216.829 10.2848 230.018 0 246.837 0ZM1553.36 0C1574.05 0 1585.43 17.7868 1585.43 44.4062C1585.43 71.0259 1573.81 88.6924 1553.36 88.6924C1532.91 88.6922 1521.3 71.0258 1521.3 44.4062C1521.3 17.7869 1532.67 0.000144529 1553.36 0ZM13.1885 38.2354C14.5194 36.2994 15.972 34.4849 17.5449 32.6699L43.0752 2.05762H59.0469L27.4668 38.7197L64.0078 86.7559H46.9473L18.7549 48.7627L13.1885 55.2969V86.7559H0V2.05762H13.1885V38.2354ZM136.123 86.7559H121.846L114.948 62.5566H87.1191L80.2217 86.7559H66.6699L92.8057 2.05762H109.866L136.123 86.7559ZM203.398 13.3096H180.771V75.3818H203.398V86.7559H144.714V75.3818H167.22V13.3096H144.714V2.05762H203.398V13.3096ZM352.944 13.3096H325.841V86.7559H312.531V13.3096H285.427V2.05762H352.944V13.3096ZM461.358 26.499L464.868 33.0332C465.957 30.8553 467.046 28.677 468.256 26.499L481.565 2.05762H496.448L473.217 43.0752L498.626 86.7559H482.896L467.409 58.5635C466.199 56.5066 465.11 54.6918 464.263 52.7559C463.295 54.6917 462.206 56.6276 461.117 58.5635L445.629 86.7559H430.504L456.035 42.5918L432.198 2.05762H447.928L461.358 26.499ZM530.449 2.05762C554.649 2.0577 570.016 15.4881 570.016 44.6484C570.016 70.058 556.827 86.7557 531.901 86.7559H509.758V2.05762H530.449ZM668.871 75.3818H715.577V86.7559H655.44V2.05762H668.871V75.3818ZM789.507 86.7559H775.229L768.332 62.5566H740.502L733.605 86.7559H720.054L746.189 2.05762H763.25L789.507 86.7559ZM829.437 2.05762C845.529 2.05772 857.387 8.34914 857.387 23.3525C857.387 33.2744 850.127 39.5664 842.141 41.9863C852.304 44.7693 859.686 51.909 859.686 62.7988C859.685 81.3112 843.834 86.7559 827.137 86.7559H799.671V2.05762H829.437ZM1002.21 13.3096H959.38V37.5098H1000.16V49.0049H959.38V75.3818H1003.79V86.7559H945.949V2.05762H1002.21V13.3096ZM1042.14 26.499L1045.65 33.0332C1046.74 30.8553 1047.83 28.6769 1049.04 26.499L1062.35 2.05762H1077.23L1054 43.0752L1079.41 86.7559H1063.68L1048.19 58.5635C1046.98 56.5066 1045.89 54.6918 1045.05 52.7559C1044.08 54.6917 1042.99 56.6276 1041.9 58.5635L1026.41 86.7559H1011.29L1036.82 42.5918L1012.98 2.05762H1028.71L1042.14 26.499ZM1102.4 37.1465H1133.25V2.05762H1146.69V86.7559H1133.25V48.5205H1102.4V86.7559H1088.97V2.05762H1102.4V37.1465ZM1219.77 13.3096H1197.14V75.3818H1219.77V86.7559H1161.08V75.3818H1183.59V13.3096H1161.08V2.05762H1219.77V13.3096ZM1265.02 2.05762C1281.12 2.05765 1292.97 8.34905 1292.97 23.3525C1292.97 33.2742 1285.71 39.5663 1277.73 41.9863C1287.89 44.7693 1295.27 51.9091 1295.27 62.7988C1295.27 81.3112 1279.42 86.7558 1262.72 86.7559H1235.26V2.05762H1265.02ZM1364.97 13.3096H1342.34V75.3818H1364.97V86.7559H1306.28V75.3818H1328.79V13.3096H1306.28V2.05762H1364.97V13.3096ZM1441.92 13.3096H1414.82V86.7559H1401.51V13.3096H1374.41V2.05762H1441.92V13.3096ZM1510.17 13.3096H1487.54V75.3818H1510.17V86.7559H1451.48V75.3818H1473.99V13.3096H1451.48V2.05762H1510.17V13.3096ZM1642.9 72.5996C1642.66 68.4858 1642.66 64.2507 1642.66 60.2578V2.05762H1655V86.7559H1635.76L1609.02 15.2461C1609.26 19.2389 1609.26 23.1107 1609.26 27.1035V86.7559H1596.92V2.05762H1616.64L1642.9 72.5996ZM1553.36 11.374C1541.75 11.3742 1535.21 24.1999 1535.21 44.4062C1535.21 64.6128 1541.99 77.4393 1553.36 77.4395C1564.61 77.4395 1571.39 64.492 1571.39 44.4062C1571.39 24.3207 1564.98 11.374 1553.36 11.374ZM523.31 75.3818H531.175C546.179 75.3818 556.101 66.065 556.101 44.4062C556.1 24.6838 548.114 13.3096 530.933 13.3096H523.31V75.3818ZM812.973 75.3818H828.218C840.439 75.3818 845.884 70.6629 845.884 61.709C845.884 52.7555 841.044 48.1573 827.977 48.1572H812.973V75.3818ZM1248.57 75.3818H1263.81C1276.03 75.3818 1281.48 70.6628 1281.48 61.709C1281.48 52.7554 1276.64 48.1572 1263.57 48.1572H1248.57V75.3818ZM101.154 12.8262C100.307 16.5771 99.4609 19.9651 98.251 23.958L90.3857 51.3037H111.682L103.938 23.958C102.849 19.9651 102.001 16.5771 101.154 12.8262ZM754.538 12.8262C753.691 16.5771 752.844 19.9651 751.634 23.958L743.77 51.3037H765.064L757.321 23.958C756.232 19.9651 755.385 16.5771 754.538 12.8262ZM812.98 36.9043H827.742C838.39 36.9043 843.593 32.4276 843.593 24.8047C843.593 17.908 839.237 13.3097 828.227 13.3096H812.98V36.9043ZM1248.57 36.9043H1263.33C1273.98 36.9043 1279.18 32.4276 1279.18 24.8047C1279.18 17.9079 1274.82 13.3096 1263.81 13.3096H1248.57V36.9043Z"
            fill="#898989"
          />
        </svg>
      </h2>
      </Container>
    </>
  );
}