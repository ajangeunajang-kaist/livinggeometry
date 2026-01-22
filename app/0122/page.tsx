'use client';

import { Canvas, useLoader, useFrame, type ThreeElements } from "@react-three/fiber";
import { OrbitControls, Center } from "@react-three/drei";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { Suspense, useRef, useState, useEffect, useMemo, forwardRef } from "react";
import styled from "styled-components";
import { useControls } from "leva";
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
  | "Programmatic";

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
  layout: LayoutOption;
  wireframe: boolean;
  flattenTextures: boolean;
  flatPaletteColor: string;
};

type CityscapeProps = {
  scale: number;
  explosion: number;
  baseColor: string;
  adjacencyColor: string;
  adjacencyWindow: number;
  layout: LayoutOption;
  wireframe: boolean;
  flattenTextures: boolean;
  flatPaletteColor: string;
};

type AdjacencyLinesProps = {
  fragment: FragmentMesh;
  factor: number;
  adjacencyColor: string;
  layout: LayoutOption;
};

type FragmentProps = {
  fragment: FragmentMesh;
  factor: number;
  baseColor: string;
  layout: LayoutOption;
  wireframe: boolean;
  flattenTextures: boolean;
  flatPaletteColor: string;
};

// Color constants
const COLORS = {
    baseColor: "#0000ff",
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
`;

const CanvasWrapper = styled.div`
  width: 100%;
  height: 100vh;
`;


function Tile({
  modelName,
  explosion,
  baseColor,
  layout,
  wireframe,
  flattenTextures,
  flatPaletteColor,
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
                    layout={layout} 
                    wireframe={wireframe}
                    flattenTextures={flattenTextures}
                    flatPaletteColor={flatPaletteColor}
                />
            ))}
        </group>
    );
}

function Cityscape({ scale, explosion, baseColor, adjacencyColor, adjacencyWindow, layout, wireframe, flattenTextures, flatPaletteColor }: CityscapeProps) {
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
    }, [layout, adjacencyWindow]);

    return (
        <group scale={scale}>
            <group ref={tilesGroupRef}>
                {tiles.map((name) => (
                    <Tile 
                        key={name} 
                        modelName={name} 
                        explosion={explosion} 
                        baseColor={baseColor} 
                        layout={layout}
                        wireframe={wireframe}
                        flattenTextures={flattenTextures}
                        flatPaletteColor={flatPaletteColor} 
                    />
                ))}
            </group>
            
            {allFragments.map((fragment, i) => (
                <AdjacencyLines 
                    key={`adj-${i}`}
                    fragment={fragment} 
                    factor={explosion}
                    adjacencyColor={adjacencyColor}
                    layout={layout}
                />
            ))}
        </group>
    );
}

function AdjacencyLines({ fragment, factor, adjacencyColor, layout }: AdjacencyLinesProps) {
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
                    <lineBasicMaterial color={adjacencyColor} transparent opacity={0.5} />
                </Line3>
            ))}
        </group>
    );
}

function Fragment({ fragment, factor, baseColor, layout, wireframe, flattenTextures, flatPaletteColor }: FragmentProps) {
    const meshRef = useRef<FragmentMesh | null>(null);
    const lineRef = useRef<THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> | null>(null);
    const groupRef = useRef<THREE.Group | null>(null);
    
    const { x, y } = useSpring({
        x: (layout !== 'Original' && fragment.userData.orderedCenter) ? fragment.userData.orderedCenter.x : fragment.userData.baseCenter.x,
        y: (layout !== 'Original' && fragment.userData.orderedCenter) ? fragment.userData.orderedCenter.y : fragment.userData.baseCenter.y,
        config: { mass: 1, tension: 120, friction: 14 }
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
                material.userData.originalMapSaved = true;
            }
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
            material.needsUpdate = true;
        };
        if (Array.isArray(fragment.material)) {
            fragment.material.forEach(applyFlatTexture);
        } else {
            applyFlatTexture(fragment.material);
        }
    }, [fragment, flattenTextures, baseColor, flatPaletteColor]);

    const fragmentPosition = useMemo(() => new THREE.Vector3().copy(fragment.userData.fragmentCenter).multiplyScalar(-1), [fragment]);

    return (
        <animated.group ref={groupRef} position-x={x} position-y={y}>
            <primitive ref={meshRef} object={fragment} position={fragmentPosition} />
            <mesh>
                <boxGeometry args={[fragment.userData.baseSize.x, fragment.userData.baseSize.y, fragment.userData.baseSize.z]} />
                <meshBasicMaterial color={baseColor || "#0000ff"} wireframe />
            </mesh>
            <Line3 ref={lineRef}>
                <bufferGeometry />
                <lineBasicMaterial color={baseColor || "#0000ff"} />
            </Line3>
        </animated.group>
    );
}

export default function App() {
  const { explosion } = useControls({
    explosion: { value: 300, min: 0, max: 400, step: 0.001 },
  });

  const layoutControl = useControls('Collage', {
    layout: {
      value: 'Original',
      options: ['Original', 'Grid', 'Spiral', 'Hurricane', 'Wave', 'Radial', 'Galaxy', 'Tsunami', 'Alternating', 'Deconstruction', 'Metabolism', 'Programmatic'],
      label: 'Layout Style'
    }
  });
  const layout = layoutControl.layout as LayoutOption;

  const { baseColor, adjacencyColor, adjacencyWindow, wireframe, flattenTextures, flatPaletteColor, whiteBg } = useControls('Visual', {
    baseColor: { value: COLORS.baseColor },
    adjacencyColor: { value: COLORS.adjacencyColor },
    adjacencyWindow: { value: 2, min: 1, max: 5, step: 1 },
    wireframe: { value: true, label: 'Wireframe' },
    flattenTextures: { value: false, label: 'Flat Color Only' },
    flatPaletteColor: { value: COLORS.baseColor, label: 'Flat Palette Color' },
    whiteBg: { value: false, label: 'White BG' },
  });
  const scale = INIT.scale;

  return (
    <Container $whiteBg={whiteBg}>
      <CanvasWrapper>
        <Canvas camera={{ fov: 80 }} style={{ width: "100%", height: "100%" }}>
          <color attach="background" args={[whiteBg ? "#ffffff" : "#000000"]} />

          <Suspense fallback={null}>
            <Center rotation={[-Math.PI / 2, 0, 0]}>
              <Cityscape 
                  scale={scale} 
                  explosion={explosion}
                  baseColor={baseColor}
                  adjacencyColor={adjacencyColor}
                  adjacencyWindow={adjacencyWindow}
                  layout={layout}
                  wireframe={wireframe}
                  flattenTextures={flattenTextures}
                  flatPaletteColor={flatPaletteColor}
              />
            </Center>
          </Suspense>
          <ambientLight intensity={2} />
          <pointLight position={[10, 10, 10]} />
          <OrbitControls />
        </Canvas>
      </CanvasWrapper>
    </Container>
  );
}

