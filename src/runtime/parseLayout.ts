/**
 * Pure parsing utilities for floorplan JSON normalization
 * No external dependencies, no rendering code
 */

import { Cell, Layout } from './types.js';

/**
 * Parse and normalize floorplan JSON to Layout structure
 * Validates basic shape and converts instances to grid-based cell format
 * Uses SW origin coordinate system (grid x,y → world x,0,y)
 * 
 * @param json - Raw JSON object from room-layout.json
 * @returns Layout with normalized cell grid
 * @throws Error if JSON structure is invalid
 */
export function parseLayout(json: any): Layout {
    // Basic validation
    if (!json || typeof json !== 'object') {
        throw new Error('Invalid JSON: must be an object');
    }
    
    if (!json.instances || !Array.isArray(json.instances)) {
        throw new Error('Invalid JSON: missing "instances" array');
    }
    
    // Extract position data from instances
    const instances = json.instances.filter((instance: any) => 
        instance.position && 
        Array.isArray(instance.position) && 
        instance.position.length === 3
    );
    
    if (instances.length === 0) {
        // Return minimal valid layout for empty JSON
        return {
            width: 1,
            height: 1,
            cells: [{ x: 0, y: 0, kind: 'empty' }]
        };
    }
    
    // Determine grid bounds from instances
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    instances.forEach((instance: any) => {
        const [worldX, worldY, worldZ] = instance.position;
        
        // Convert world coordinates to grid coordinates (divide by 2, assuming 2-unit grid spacing)
        const gridX = Math.floor(worldX / 2);
        const gridZ = Math.floor(worldZ / 2);
        
        minX = Math.min(minX, gridX);
        maxX = Math.max(maxX, gridX);
        minZ = Math.min(minZ, gridZ);
        maxZ = Math.max(maxZ, gridZ);
    });
    
    // Handle edge case where all positions are the same
    if (minX === maxX && minZ === maxZ) {
        maxX = minX + 1;
        maxZ = minZ + 1;
    }
    
    // Calculate grid dimensions (SW origin, so include bounds)
    const width = Math.max(1, maxX - minX + 1);
    const height = Math.max(1, maxZ - minZ + 1);
    
    // Initialize empty grid
    const grid: Array<Array<'empty' | 'floor' | 'wall'>> = [];
    for (let y = 0; y < height; y++) {
        grid[y] = [];
        for (let x = 0; x < width; x++) {
            grid[y][x] = 'empty';
        }
    }
    
    // Populate grid from instances
    instances.forEach((instance: any) => {
        const [worldX, worldY, worldZ] = instance.position;
        const gridX = Math.floor(worldX / 2) - minX;
        const gridZ = Math.floor(worldZ / 2) - minZ;
        
        if (gridX >= 0 && gridX < width && gridZ >= 0 && gridZ < height) {
            if (isFloorType(instance.type)) {
                grid[gridZ][gridX] = 'floor';
            } else if (isWallType(instance.type)) {
                grid[gridZ][gridX] = 'wall';
            }
            // Ignore other types (referencePole, debugBall, etc.)
        }
    });
    
    // Convert grid to cell array
    const cells: Cell[] = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            cells.push({
                x,
                y,
                kind: grid[y][x]
            });
        }
    }
    
    return {
        width,
        height,
        cells
    };
}

/**
 * Check if instance type represents a floor
 */
function isFloorType(type: string): boolean {
    return type === 'lobbyFloor' || type.toLowerCase().includes('floor');
}

/**
 * Check if instance type represents a wall
 */
function isWallType(type: string): boolean {
    const wallTypes = [
        'lobbyWall',
        'lobbyNorthWall',
        'lobbySouthWall', 
        'lobbyEastWall',
        'lobbyWestWall'
    ];
    return wallTypes.includes(type) || type.toLowerCase().includes('wall');
}