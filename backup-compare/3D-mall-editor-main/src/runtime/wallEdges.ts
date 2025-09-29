/**
 * Wall edge extraction from tile-based layouts
 * Pure, deterministic edge detection algorithm
 */

import { Layout, Edge, Cell } from './types.js';

/**
 * Extract wall edges from a tile-based layout
 * Emits edges when wall tiles border non-wall tiles or map boundaries
 * 
 * Algorithm:
 * - For each wall tile at (x,y):
 *   - Check 4 neighbors (up, down, left, right)
 *   - If neighbor is non-wall or out-of-bounds, emit corresponding edge
 * - Stable ordering: row-major traversal, H edges before V edges per position
 * - Deduplication: use Set with string keys
 * 
 * @param layout - Layout with normalized cell grid
 * @returns Array of edges in stable order
 */
export function tilesToEdges(layout: Layout): Edge[] {
    const { width, height, cells } = layout;
    
    // Create lookup map for fast cell access
    const cellMap = new Map<string, Cell>();
    cells.forEach(cell => {
        cellMap.set(`${cell.x},${cell.y}`, cell);
    });
    
    // Helper to get cell kind at position (returns 'empty' for out-of-bounds)
    function getCellKind(x: number, y: number): 'empty' | 'floor' | 'wall' {
        if (x < 0 || x >= width || y < 0 || y >= height) {
            return 'empty';
        }
        const cell = cellMap.get(`${x},${y}`);
        return cell ? cell.kind : 'empty';
    }
    
    // Collect edges with deduplication
    const edgeSet = new Set<string>();
    
    // Row-major traversal of all positions
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const currentKind = getCellKind(x, y);
            
            // Only process wall tiles
            if (currentKind !== 'wall') {
                continue;
            }
            
            // Check 4 neighbors and emit edges where wall borders non-wall
            
            // Top neighbor: if non-wall, emit horizontal edge H(x,y)
            const topKind = getCellKind(x, y - 1);
            if (topKind !== 'wall') {
                edgeSet.add(`H,${x},${y}`);
            }
            
            // Bottom neighbor: if non-wall, emit horizontal edge H(x,y+1)
            const bottomKind = getCellKind(x, y + 1);
            if (bottomKind !== 'wall') {
                edgeSet.add(`H,${x},${y + 1}`);
            }
            
            // Left neighbor: if non-wall, emit vertical edge V(x,y)
            const leftKind = getCellKind(x - 1, y);
            if (leftKind !== 'wall') {
                edgeSet.add(`V,${x},${y}`);
            }
            
            // Right neighbor: if non-wall, emit vertical edge V(x+1,y)
            const rightKind = getCellKind(x + 1, y);
            if (rightKind !== 'wall') {
                edgeSet.add(`V,${x + 1},${y}`);
            }
        }
    }
    
    // Convert to Edge objects and sort for stable ordering
    const edges: Edge[] = [];
    for (const edgeKey of edgeSet) {
        const [dir, xStr, yStr] = edgeKey.split(',');
        edges.push({
            x: parseInt(xStr),
            y: parseInt(yStr),
            dir: dir as 'H' | 'V'
        });
    }
    
    // Stable ordering: H edges before V edges globally, then row-major within each type
    edges.sort((a, b) => {
        // First, H edges before V edges globally  
        if (a.dir !== b.dir) {
            return a.dir === 'H' ? -1 : 1;
        }
        // Then sort by y coordinate (row-major)
        if (a.y !== b.y) return a.y - b.y;
        // Finally by x coordinate
        if (a.x !== b.x) return a.x - b.x;
        return 0;
    });
    
    return edges;
}

/**
 * Self-check: 3×3 grid with single wall at (1,1)
 * Expected output: H(1,1), H(1,2), V(1,1), V(2,1)
 */
export function selfCheck(): boolean {
    // Create 3×3 layout with single wall at (1,1)
    const layout: Layout = {
        width: 3,
        height: 3,
        cells: [
            // Row 0
            { x: 0, y: 0, kind: 'empty' },
            { x: 1, y: 0, kind: 'empty' },
            { x: 2, y: 0, kind: 'empty' },
            // Row 1 
            { x: 0, y: 1, kind: 'empty' },
            { x: 1, y: 1, kind: 'wall' },  // Single wall
            { x: 2, y: 1, kind: 'empty' },
            // Row 2
            { x: 0, y: 2, kind: 'empty' },
            { x: 1, y: 2, kind: 'empty' },
            { x: 2, y: 2, kind: 'empty' }
        ]
    };
    
    const edges = tilesToEdges(layout);
    
    // Expected: H(1,1), H(1,2), V(1,1), V(2,1) in that order
    const expected = [
        { x: 1, y: 1, dir: 'H' as const },  // Top edge of wall
        { x: 1, y: 2, dir: 'H' as const },  // Bottom edge of wall  
        { x: 1, y: 1, dir: 'V' as const },  // Left edge of wall
        { x: 2, y: 1, dir: 'V' as const }   // Right edge of wall
    ];
    
    if (edges.length !== expected.length) {
        console.error(`Self-check failed: expected ${expected.length} edges, got ${edges.length}`);
        return false;
    }
    
    for (let i = 0; i < expected.length; i++) {
        const edge = edges[i];
        const exp = expected[i];
        if (edge.x !== exp.x || edge.y !== exp.y || edge.dir !== exp.dir) {
            console.error(`Self-check failed at index ${i}: expected ${exp.dir}(${exp.x},${exp.y}), got ${edge.dir}(${edge.x},${edge.y})`);
            return false;
        }
    }
    
    console.log('Self-check passed: 3×3 single wall produces expected 4 edges');
    return true;
}