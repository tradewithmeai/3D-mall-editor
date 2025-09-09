/**
 * Browser-compatible floorplan loader (IIFE)
 * Works with global window.THREE from CDN
 * Includes all Phase 1-3 logic without ES modules
 */

(function() {
    'use strict';
    
    // Ensure THREE.js is available
    if (typeof window.THREE === 'undefined') {
        throw new Error('THREE.js must be loaded before loadFloorplan');
    }
    
    const THREE = window.THREE;
    
    /**
     * Parse JSON to normalized Layout structure
     * @param {Object} json - Raw JSON from file
     * @returns {Object} { width, height, cells[] }
     */
    function parseLayout(json) {
        if (!json.instances || !Array.isArray(json.instances)) {
            throw new Error('Invalid JSON: missing instances array');
        }
        
        const instances = json.instances;
        const cells = [];
        
        let minX = 0, maxX = 0, minY = 0, maxY = 0;
        
        // Process each instance
        instances.forEach(instance => {
            if (!instance.position || !Array.isArray(instance.position) || instance.position.length < 3) {
                return; // Skip invalid instances
            }
            
            const [worldX, worldY, worldZ] = instance.position;
            
            // Convert world coordinates to grid coordinates using Math.floor(worldPos / 2)
            const gridX = Math.floor(worldX / 2);
            const gridY = Math.floor(worldZ / 2); // Z maps to grid Y
            
            // Determine cell kind based on instance type
            let kind = 'empty';
            if (instance.type && instance.type.includes('Floor')) {
                kind = 'floor';
            } else if (instance.type && instance.type.includes('Wall')) {
                kind = 'wall';
            }
            
            // Skip empty cells
            if (kind === 'empty') {
                return;
            }
            
            cells.push({ x: gridX, y: gridY, kind });
            
            // Track bounds
            minX = Math.min(minX, gridX);
            maxX = Math.max(maxX, gridX);
            minY = Math.min(minY, gridY);
            maxY = Math.max(maxY, gridY);
        });
        
        // Calculate layout dimensions
        const width = Math.max(maxX - minX + 1, 1);
        const height = Math.max(maxY - minY + 1, 1);
        
        // Normalize cells to start from (0,0)
        const normalizedCells = cells.map(cell => ({
            x: cell.x - minX,
            y: cell.y - minY,
            kind: cell.kind
        }));
        
        return { width, height, cells: normalizedCells };
    }
    
    /**
     * Extract wall edges from layout
     * @param {Object} layout - { width, height, cells[] }
     * @returns {Array} Array of edges { x, y, dir }
     */
    function tilesToEdges(layout) {
        const { width, height, cells } = layout;
        
        // Create lookup map for fast cell access
        const cellMap = new Map();
        cells.forEach(cell => {
            cellMap.set(`${cell.x},${cell.y}`, cell);
        });
        
        // Helper to get cell kind at position
        function getCellKind(x, y) {
            if (x < 0 || x >= width || y < 0 || y >= height) {
                return 'empty';
            }
            const cell = cellMap.get(`${x},${y}`);
            return cell ? cell.kind : 'empty';
        }
        
        // Collect edges with deduplication
        const edgeSet = new Set();
        
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
        
        // Convert to edge objects and sort for stable ordering
        const edges = [];
        for (const edgeKey of edgeSet) {
            const [dir, xStr, yStr] = edgeKey.split(',');
            edges.push({
                x: parseInt(xStr),
                y: parseInt(yStr),
                dir: dir
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
     * Build floor meshes from layout, merging contiguous tiles into strips
     * @param {Object} layout - { width, height, cells[] }
     * @returns {THREE.Group} Group containing floor meshes
     */
    function buildFloors(layout) {
        const { width, height, cells } = layout;
        
        // Create lookup map for fast cell access
        const cellMap = new Map();
        cells.forEach(cell => {
            cellMap.set(`${cell.x},${cell.y}`, cell.kind);
        });
        
        // Helper to get cell kind at position
        function getCellKind(x, y) {
            if (x < 0 || x >= width || y < 0 || y >= height) {
                return 'empty';
            }
            return cellMap.get(`${x},${y}`) || 'empty';
        }
        
        const floorsGroup = new THREE.Group();
        floorsGroup.name = "floors";
        
        // Track processed tiles to avoid duplicates
        const processed = new Set();
        
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
    
    /**
     * Build wall meshes from edges array
     * @param {Array} edges - Array of { x, y, dir } objects
     * @returns {THREE.Group} Group containing wall meshes
     */
    function buildWalls(edges) {
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
            let geometry, position;
            
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
    
    /**
     * Load and render a floorplan from JSON file
     * @param {string} path - Path to floorplan JSON file
     * @returns {Promise<THREE.Group>} Promise resolving to complete floorplan group
     */
    async function loadFloorplan(path) {
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
            group.units = json.units;
        }
        
        group.add(floorsGroup, wallsGroup);
        return group;
    }
    
    // Expose to global scope
    window.loadFloorplan = loadFloorplan;
    
    console.log('✅ loadFloorplan browser shim loaded');
    
})();