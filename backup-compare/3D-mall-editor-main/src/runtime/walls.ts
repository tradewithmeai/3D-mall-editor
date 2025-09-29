/**
 * Wall mesh builder for edge-based wall systems
 * Creates wall boxes from edge positions
 */

import * as THREE from 'three';
import { Edge } from './types.js';

/**
 * Build wall meshes from edges array
 * @param edges - Array of wall edges with positions and directions
 * @returns THREE.Group containing wall box meshes
 */
export function buildWalls(edges: Edge[]): THREE.Group {
    const wallsGroup = new THREE.Group();
    wallsGroup.name = "walls";
    
    // Single material for all walls
    const material = new THREE.MeshStandardMaterial({
        color: 0x808080, // Gray color
        roughness: 0.7,
        metalness: 0.0
    });
    
    // Process each edge in deterministic order (edges should already be sorted)
    edges.forEach(edge => {
        let geometry: THREE.BoxGeometry;
        let position: THREE.Vector3;
        
        if (edge.dir === 'H') {
            // Horizontal edge: BoxGeometry (width=1, depth=0.1, height=3)
            // Position: center (x+0.5, 1.5, y)
            geometry = new THREE.BoxGeometry(1, 3, 0.1);
            position = new THREE.Vector3(edge.x + 0.5, 1.5, edge.y);
        } else {
            // Vertical edge: BoxGeometry (width=0.1, depth=1, height=3) 
            // Position: center (x, 1.5, y+0.5)
            geometry = new THREE.BoxGeometry(0.1, 3, 1);
            position = new THREE.Vector3(edge.x, 1.5, edge.y + 0.5);
        }
        
        const wall = new THREE.Mesh(geometry, material);
        wall.position.copy(position);
        
        wallsGroup.add(wall);
    });
    
    return wallsGroup;
}