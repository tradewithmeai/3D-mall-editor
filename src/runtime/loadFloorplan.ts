/**
 * Runtime floorplan loader - integrates all phases into single async function
 * Loads JSON, parses layout, generates edges, builds meshes, returns complete group
 */

import * as THREE from 'three';
import { parseLayout } from './parseLayout.js';
import { tilesToEdges } from './wallEdges.js';
import { buildFloors } from './floors.js';
import { buildWalls } from './walls.js';

/**
 * Load and render a floorplan from JSON file
 * @param path - Path to floorplan JSON file
 * @returns THREE.Group containing complete floorplan geometry
 */
export async function loadFloorplan(path: string): Promise<THREE.Group> {
    const res = await fetch(path);
    const json = await res.json();
    const layout = parseLayout(json);
    const edges = tilesToEdges(layout);
    const floorsGroup = buildFloors(layout);
    const wallsGroup = buildWalls(edges);
    const group = new THREE.Group();
    group.name = 'floorplan';
    group.add(floorsGroup, wallsGroup);
    return group;
}