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
    
    // Parse units if present (units tolerance)
    if (json.units && Array.isArray(json.units)) {
        console.info(`Units scaffold detected: ${json.units.length} units`);
    }
    
    const layout = parseLayout(json);
    const edges = tilesToEdges(layout);
    const floorsGroup = buildFloors(layout);
    const wallsGroup = buildWalls(edges);
    const group = new THREE.Group();
    group.name = 'floorplan';
    
    // Store units data on the group for future access
    if (json.units) {
        (group as any).units = json.units;
    }
    
    group.add(floorsGroup, wallsGroup);
    return group;
}