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
     * Parse scene.3d.v1 format to normalized Layout structure
     * @param {Object} sceneObj - scene.3d.v1 JSON object
     * @returns {Object} { width, height, cells[] }
     */
    function parseScene3dV1(sceneObj) {
        console.log('[SCENE:v1] Parsing scene.3d.v1 format');

        // Extract units with defaults
        const units = sceneObj.units || {};
        const cellMeters = units.cellMeters || 1;

        // Validate coordinateSystem is Y-up
        const cs = units.coordinateSystem;
        if (cs !== 'right-handed-y-up') {
            console.error(`[SCENE:v1] REJECTED: coordinateSystem="${cs}" (expected "right-handed-y-up")`);
            throw new Error(`Invalid coordinate system: ${cs}. Only right-handed-y-up is supported.`);
        }

        // Handle legacy originOffset.z → originOffset.y
        let originOffset = sceneObj.originOffset || { x: 0, y: 0 };
        if (originOffset.z !== undefined && originOffset.y === undefined) {
            console.warn('[SCENE:v1] Legacy originOffset.z detected; mapping to .y');
            originOffset.y = originOffset.z;
        }
        originOffset = { x: originOffset.x || 0, y: originOffset.y || 0 };

        // Log scene info
        const tilesCount = sceneObj.tiles?.floor?.length || 0;
        const hEdgesCount = sceneObj.edges?.horizontal?.length || 0;
        const vEdgesCount = sceneObj.edges?.vertical?.length || 0;
        const bounds = sceneObj.bounds;

        console.log(`[SCENE:v1] tiles=${tilesCount} edgesH=${hEdgesCount} edgesV=${vEdgesCount} cell=${cellMeters} originOffset=(${originOffset.x},${originOffset.y})`);

        if (bounds) {
            const min = bounds.min;
            const max = bounds.max;
            const center = bounds.center;
            console.log(`[SCENE:v1] bounds: min=(${min.x},${min.y},${min.z}) max=(${max.x},${max.y},${max.z}) centre=(${center.x},${center.y},${center.z})`);
        }

        // Verify parity if present - HARD FAIL on mismatch
        if (sceneObj.meta?.parity) {
            const p = sceneObj.meta.parity;
            const errs = [];
            if (p.tiles !== tilesCount) errs.push(`tiles expected ${p.tiles} got ${tilesCount}`);
            if (p.edgesH !== hEdgesCount) errs.push(`edgesH expected ${p.edgesH} got ${hEdgesCount}`);
            if (p.edgesV !== vEdgesCount) errs.push(`edgesV expected ${p.edgesV} got ${vEdgesCount}`);

            if (errs.length > 0) {
                console.error('[SCENE:v1] PARITY MISMATCH:', errs.join('; '));
                throw new Error(`Parity validation failed: ${errs.join('; ')}`);
            }
            console.log('[SCENE:v1] Parity OK');
        }

        const cells = [];
        let minX = 0, maxX = 0, minY = 0, maxY = 0;

        // Process floor tiles
        if (sceneObj.tiles?.floor) {
            sceneObj.tiles.floor.forEach(([x, y]) => {
                // Tiles are already normalized to (0,0) in the file
                // originOffset will be applied during rendering
                cells.push({ x, y, kind: 'floor' });

                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            });
        }

        // Note: Wall edges are NOT added to cells array for scene.3d.v1
        // They are kept separate in the edges structure and processed directly
        // Adding them to cells would overwrite floor tiles at perimeter coordinates

        // Calculate layout dimensions
        const width = Math.max(maxX - minX + 1, 1);
        const height = Math.max(maxY - minY + 1, 1);

        // Normalize cells to start from (0,0)
        const normalizedCells = cells.map(cell => ({
            x: cell.x - minX,
            y: cell.y - minY,
            kind: cell.kind,
            dir: cell.dir || null
        }));

        return {
            width,
            height,
            cells: normalizedCells,
            cellMeters,
            isScene3dV1: true,
            originalScene: sceneObj,
            originOffset: originOffset  // Pass through for rendering
        };
    }

    /**
     * Parse JSON to normalized Layout structure
     * @param {Object} json - Raw JSON from file
     * @returns {Object} { width, height, cells[] }
     */
    function parseLayout(json) {
        // Detect format: scene.3d.v1 vs legacy instances
        if (json.meta && json.meta.schema === 'scene.3d.v1') {
            return parseScene3dV1(json);
        }

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
     * @param {Object} layout - { width, height, cells[], cellMeters?, isScene3dV1? }
     * @returns {THREE.Group} Group containing floor meshes
     */
    function buildFloors(layout) {
        const { width, height, cells, cellMeters = 1, isScene3dV1 = false, originOffset = { x: 0, y: 0 } } = layout;

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

        // Scene.3d.v1 uses proper metric positioning with cellMeters scaling
        // Legacy format uses grid-based positioning with no scaling

        console.log(`[FLOOR] Building floors: width=${width}, height=${height}, cellMeters=${cellMeters}, totalCells=${cells.length}`);
        console.log(`[FLOOR] Floor tiles:`, cells.filter(c => c.kind === 'floor').map(c => `[${c.x},${c.y}]`).join(', '));

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

                // Create merged floor geometry for this strip
                const stripWidth = stripLength * cellMeters;
                const stripDepth = cellMeters;

                let geometry, material, floor;

                if (isScene3dV1) {
                    // scene.3d.v1: Use 3D box with proper thickness from scene spec
                    const floorThickness = layout.originalScene?.units?.floorThicknessMeters || 0.1;
                    geometry = new THREE.BoxGeometry(stripWidth, floorThickness, stripDepth);

                    material = new THREE.MeshStandardMaterial({
                        color: 0x8B4513, // Brown color
                        roughness: 0.8,
                        metalness: 0.0
                    });

                    floor = new THREE.Mesh(geometry, material);

                    // Position: center the box so bottom sits at Y=0 (ground level)
                    // Apply originOffset to position in world space
                    const worldX = (x + originOffset.x + stripLength / 2) * cellMeters;
                    const worldY = floorThickness / 2; // Center of box thickness
                    const worldZ = (y + originOffset.y + 0.5) * cellMeters;
                    floor.position.set(worldX, worldY, worldZ);

                    console.log(`[FLOOR] Row y=${y}, startX=${x}, stripLen=${stripLength}, offset=(${originOffset.x},${originOffset.y}), box=${stripWidth}×${floorThickness}×${stripDepth}m @ (${worldX}, ${worldY}, ${worldZ})`);
                } else {
                    // Legacy: flat plane
                    geometry = new THREE.PlaneGeometry(stripWidth, stripDepth);

                    material = new THREE.MeshStandardMaterial({
                        color: 0x8B4513,
                        roughness: 0.8,
                        metalness: 0.0
                    });

                    floor = new THREE.Mesh(geometry, material);
                    floor.position.set(
                        x + stripLength / 2,
                        0,
                        y + 0.5
                    );
                    floor.rotation.x = -Math.PI / 2;
                }

                floorsGroup.add(floor);
            }
        }
        
        return floorsGroup;
    }
    
    /**
     * Build wall meshes from edges array
     * @param {Array} edges - Array of { x, y, dir } objects
     * @param {Object} layout - Layout object with cellMeters and isScene3dV1 flags
     * @returns {THREE.Group} Group containing wall meshes
     */
    function buildWalls(edges, layout = {}) {
        const { cellMeters = 1, isScene3dV1 = false, originalScene } = layout;

        const wallsGroup = new THREE.Group();
        wallsGroup.name = "walls";

        // Single material for all walls
        const material = new THREE.MeshStandardMaterial({
            color: 0x808080, // Gray color
            roughness: 0.7,
            metalness: 0.0
        });

        // Get wall dimensions from scene.3d.v1 or use defaults
        let wallHeight, wallThickness;
        if (isScene3dV1 && originalScene?.units) {
            wallHeight = originalScene.units.wallHeightMeters || 3.0;
            wallThickness = originalScene.units.wallThicknessMeters || 0.2;
        } else {
            wallHeight = 3.0;
            wallThickness = 0.1;
        }

        // Process each edge in deterministic order (edges should already be sorted)
        edges.forEach(edge => {
            let geometry, position;

            if (edge.dir === 'H') {
                // Horizontal edge: spans (x,y) → (x+1,y) along X-axis
                if (isScene3dV1) {
                    // scene.3d.v1: proper metric scaling
                    const width = cellMeters;
                    const depth = wallThickness;
                    const height = wallHeight;
                    geometry = new THREE.BoxGeometry(width, height, depth);

                    // Position: center at (x+0.5)*cellMeters, height/2, y*cellMeters
                    // Apply originOffset from layout
                    const offset = layout.originOffset || { x: 0, y: 0 };
                    const worldX = (edge.x + offset.x + 0.5) * cellMeters;
                    const worldY = height / 2;
                    const worldZ = (edge.y + offset.y) * cellMeters;
                    position = new THREE.Vector3(worldX, worldY, worldZ);
                } else {
                    // Legacy: original logic
                    geometry = new THREE.BoxGeometry(1, 3, 0.1);
                    position = new THREE.Vector3(edge.x + 0.5, 1.5, edge.y);
                }
            } else {
                // Vertical edge: spans (x,y) → (x,y+1) along Z-axis
                if (isScene3dV1) {
                    // scene.3d.v1: proper metric scaling
                    const width = wallThickness;
                    const depth = cellMeters;
                    const height = wallHeight;
                    geometry = new THREE.BoxGeometry(width, height, depth);

                    // Position: center at x*cellMeters, height/2, (y+0.5)*cellMeters
                    // Apply originOffset from layout
                    const offset = layout.originOffset || { x: 0, y: 0 };
                    const worldX = (edge.x + offset.x) * cellMeters;
                    const worldY = height / 2;
                    const worldZ = (edge.y + offset.y + 0.5) * cellMeters;
                    position = new THREE.Vector3(worldX, worldY, worldZ);
                } else {
                    // Legacy: original logic
                    geometry = new THREE.BoxGeometry(0.1, 3, 1);
                    position = new THREE.Vector3(edge.x, 1.5, edge.y + 0.5);
                }
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

        // Extract edges based on format
        let edges;
        if (layout.isScene3dV1) {
            // scene.3d.v1: edges are in the originalScene.edges structure
            // Edges are already normalized in the file, originOffset applied during rendering
            const edgesH = layout.originalScene.edges?.horizontal || [];
            const edgesV = layout.originalScene.edges?.vertical || [];

            edges = [
                ...edgesH.map(([x, y]) => ({ x, y, dir: 'H' })),
                ...edgesV.map(([x, y]) => ({ x, y, dir: 'V' }))
            ];
        } else {
            edges = tilesToEdges(layout);
        }

        const floorsGroup = buildFloors(layout);
        const wallsGroup = buildWalls(edges, layout);
        const group = new THREE.Group();
        group.name = 'floorplan';
        
        // Store units data on the group for future access
        if (json.units) {
            group.units = json.units;
        }
        
        group.add(floorsGroup, wallsGroup);
        return group;
    }
    
    /**
     * Build ghost grid helper for scene visualization
     * @param {number} gridWidth - Grid width in cells (default 60)
     * @param {number} gridHeight - Grid height in cells (default 40)
     * @param {number} cellMeters - Size of each cell in meters (default 1)
     * @returns {THREE.Object3D} Ghost grid object
     */
    function buildGhostGrid(gridWidth = 60, gridHeight = 40, cellMeters = 1) {
        const ghostGrid = new THREE.Group();
        ghostGrid.name = "ghostGrid";

        // Thin line material - faint and transparent
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x666666,
            opacity: 0.2,
            transparent: true
        });

        // Create vertical lines (parallel to Z-axis)
        for (let x = 0; x <= gridWidth; x++) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(x * cellMeters, 0.001, 0),
                new THREE.Vector3(x * cellMeters, 0.001, gridHeight * cellMeters)
            ]);
            const line = new THREE.Line(geometry, lineMaterial);
            ghostGrid.add(line);
        }

        // Create horizontal lines (parallel to X-axis)
        for (let y = 0; y <= gridHeight; y++) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0.001, y * cellMeters),
                new THREE.Vector3(gridWidth * cellMeters, 0.001, y * cellMeters)
            ]);
            const line = new THREE.Line(geometry, lineMaterial);
            ghostGrid.add(line);
        }

        return ghostGrid;
    }

    /**
     * Load scene.3d.v1 from object and add to scene with ghost grid
     * @param {Object} sceneObj - Parsed scene.3d.v1 JSON object
     * @param {THREE.Scene} targetScene - Three.js scene to add to
     * @param {THREE.Camera} camera - Camera to recenter
     * @returns {THREE.Group} Combined group with scene and ghost grid
     */
    function importScene3DFromObject(sceneObj, targetScene, camera) {
        console.log('[SCENE:v1] Importing scene.3d.v1 from object');

        // Remove any previous sceneV1 group and ghost grid
        const existingScene = targetScene.getObjectByName('sceneV1');
        const existingGrid = targetScene.getObjectByName('ghostGrid');
        if (existingScene) {
            targetScene.remove(existingScene);
        }
        if (existingGrid) {
            targetScene.remove(existingGrid);
        }

        // Parse the scene using existing logic
        const layout = parseScene3dV1(sceneObj);

        // Extract edges directly from originalScene structure
        // Edges are already normalized in the file, originOffset applied during rendering
        const edgesH = layout.originalScene.edges?.horizontal || [];
        const edgesV = layout.originalScene.edges?.vertical || [];

        const edges = [
            ...edgesH.map(([x, y]) => ({ x, y, dir: 'H' })),
            ...edgesV.map(([x, y]) => ({ x, y, dir: 'V' }))
        ];

        const floorsGroup = buildFloors(layout);
        const wallsGroup = buildWalls(edges, layout);

        // Create main scene group
        const sceneGroup = new THREE.Group();
        sceneGroup.name = 'sceneV1';
        sceneGroup.add(floorsGroup, wallsGroup);

        // Create ghost grid based on scene limits or defaults
        let gridWidth = 60, gridHeight = 40;
        if (sceneObj.meta?.simLimits) {
            gridWidth = sceneObj.meta.simLimits.maxTilesX || 60;
            gridHeight = sceneObj.meta.simLimits.maxTilesY || 40;
        }

        const ghostGrid = buildGhostGrid(gridWidth, gridHeight, layout.cellMeters);

        // Add both to scene
        targetScene.add(sceneGroup);
        targetScene.add(ghostGrid);

        // Recenter camera to content bounds if bounds are available
        if (sceneObj.bounds && camera) {
            const bounds = sceneObj.bounds;
            const center = bounds.center;
            const size = {
                x: bounds.max.x - bounds.min.x,
                y: bounds.max.y - bounds.min.y,
                z: bounds.max.z - bounds.min.z
            };

            // Position camera to view the entire scene with some margin
            const margin = Math.max(size.x, size.z) * 0.5;
            camera.position.set(
                center.x + margin,
                center.y + margin,
                center.z + margin
            );
            camera.lookAt(center.x, center.y, center.z);

            console.log(`[SCENE:v1] Camera recentered to bounds center (${center.x}, ${center.y}, ${center.z})`);
        }

        return sceneGroup;
    }

    // Expose to global scope
    window.loadFloorplan = loadFloorplan;
    window.buildGhostGrid = buildGhostGrid;
    window.importScene3DFromObject = importScene3DFromObject;

    console.log('✅ loadFloorplan browser shim loaded with scene.3d.v1 support');
    
})();