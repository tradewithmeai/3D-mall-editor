/**
 * Floor mesh builder for tile-based layouts
 * Creates merged floor strips from contiguous floor tiles
 */

import * as THREE from 'three';
import { Layout } from './types.js';

/**
 * Build floor meshes from layout, merging contiguous floor tiles into strips
 * @param layout - Layout with normalized cell grid
 * @returns THREE.Group containing floor strip meshes
 */
export function buildFloors(layout: Layout): THREE.Group {
    const { width, height, cells } = layout;
    
    // Create lookup map for fast cell access
    const cellMap = new Map<string, 'empty' | 'floor' | 'wall'>();
    cells.forEach(cell => {
        cellMap.set(`${cell.x},${cell.y}`, cell.kind);
    });
    
    // Helper to get cell kind at position
    function getCellKind(x: number, y: number): 'empty' | 'floor' | 'wall' {
        if (x < 0 || x >= width || y < 0 || y >= height) {
            return 'empty';
        }
        return cellMap.get(`${x},${y}`) || 'empty';
    }
    
    const floorsGroup = new THREE.Group();
    floorsGroup.name = "floors";
    
    // Track processed tiles to avoid duplicates
    const processed = new Set<string>();
    
    // Process each row to find contiguous floor strips
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const key = `${x},${y}`;
            
            // Skip if already processed or not a floor tile
            if (processed.has(key) || getCellKind(x, y) !== 'floor') {
                continue;
            }
            
            // Find the length of contiguous floor tiles in this row
            let stripLength = 0;
            let checkX = x;
            while (checkX < width && getCellKind(checkX, y) === 'floor') {
                processed.add(`${checkX},${y}`);
                stripLength++;
                checkX++;
            }
            
            // Create merged plane geometry for this strip
            const geometry = new THREE.PlaneGeometry(stripLength, 1);
            const material = new THREE.MeshStandardMaterial({ 
                color: 0x8B4513, // Brown color
                roughness: 0.8,
                metalness: 0.0
            });
            
            const plane = new THREE.Mesh(geometry, material);
            
            // Position: tile (x,y) → plane at (x+len/2, 0, y+0.5), rotated flat
            plane.position.set(
                x + stripLength / 2, // Center X of the strip
                0,                   // Ground level
                y + 0.5              // Center Y of the tile
            );
            
            // Rotate to lie flat on the ground (face up)
            plane.rotation.x = -Math.PI / 2;
            
            floorsGroup.add(plane);
        }
    }
    
    return floorsGroup;
}