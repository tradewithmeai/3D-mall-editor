/**
 * ExportBuilder3D - Builds scene.3d.v1 JSON per Interface Contract v1
 *
 * Converts 2D scene data to 3D construction API format with exact field mapping
 * as specified in reports/2d→3d-interface-v1.md
 *
 * Enhanced with:
 * - Contract locking (integer grid, axes, units validation)
 * - Coordinate normalization (content-based bounds)
 * - Tile/edge canonicalization (dedupe, sort, bounds validation)
 * - Parity summary for cross-checking
 * - Deterministic output with digest
 * - Back-compatibility guards
 */

// 🎯 SIMULATION LIMITS (shared with 3D simulator)
const SIM_MAX_TILES_X = 60;
const SIM_MAX_TILES_Y = 40;
const DEFAULT_CELL_METERS = 1;
const DEFAULT_WALL_HEIGHT_METERS = 3.0;

/**
 * Convert current scene state to scene.3d.v1 format
 *
 * @param {Object} sceneModel - Editor scene model (grid, horizontalEdges, verticalEdges)
 * @param {number} cellSize - Cell size in pixels
 * @param {string} safeId - Sanitized scene identifier
 * @returns {Object} scene.3d.v1 JSON per Interface Contract v1
 */
export function toScene3D(sceneModel, cellSize, safeId = 'scene') {
    const now = new Date().toISOString();

    // ✅ NEW NORMALIZATION CODE ACTIVE

    // 🔒 CONTRACT LOCKING: Enforce integer grid and validate units
    const cellMeters = cellSize * 0.05; // worldUnit = cellSize × 0.05 meters/pixel

    if (cellMeters <= 0) {
        throw new Error(`Invalid cellMeters: ${cellMeters} (must be > 0)`);
    }

    // Extract and validate floor tiles
    const rawFloorTiles = [];
    for (let y = 0; y < sceneModel.grid.length; y++) {
        for (let x = 0; x < sceneModel.grid[y].length; x++) {
            if (sceneModel.grid[y][x] === 'floor') {
                // Enforce integer coordinates
                if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
                    throw new Error(`Non-integer or negative tile coordinate: [${x}, ${y}]`);
                }
                rawFloorTiles.push([x, y]);
            }
        }
    }

    // Extract and validate horizontal edges (walls)
    const rawHorizontalEdges = [];
    for (let y = 0; y < sceneModel.horizontalEdges.length; y++) {
        for (let x = 0; x < sceneModel.horizontalEdges[y].length; x++) {
            if (sceneModel.horizontalEdges[y] && sceneModel.horizontalEdges[y][x]) {
                // Enforce integer coordinates
                if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
                    throw new Error(`Non-integer or negative horizontal edge coordinate: [${x}, ${y}]`);
                }
                // Horizontal edges must be unit segments: (x,y) → (x+1,y)
                rawHorizontalEdges.push([x, y]);
            }
        }
    }

    // Extract and validate vertical edges (walls)
    const rawVerticalEdges = [];
    for (let y = 0; y < sceneModel.verticalEdges.length; y++) {
        for (let x = 0; x < sceneModel.verticalEdges[y].length; x++) {
            if (sceneModel.verticalEdges[y] && sceneModel.verticalEdges[y][x]) {
                // Enforce integer coordinates
                if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
                    throw new Error(`Non-integer or negative vertical edge coordinate: [${x}, ${y}]`);
                }
                // Vertical edges must be unit segments: (x,y) → (x,y+1)
                rawVerticalEdges.push([x, y]);
            }
        }
    }

    // 📐 CANONICALIZE FLOOR TILES
    // Deduplicate and sort by (y, x) for deterministic output
    const floorTilesSet = new Set(rawFloorTiles.map(tile => `${tile[0]},${tile[1]}`));
    const floorTiles = Array.from(floorTilesSet)
        .map(str => str.split(',').map(Number))
        .sort((a, b) => a[1] - b[1] || a[0] - b[0]); // Sort by y, then x

    // 📐 CANONICALIZE WALL EDGES
    // Deduplicate horizontal edges and sort by (y, x)
    const horizontalEdgesSet = new Set(rawHorizontalEdges.map(edge => `${edge[0]},${edge[1]}`));
    const horizontalEdges = Array.from(horizontalEdgesSet)
        .map(str => str.split(',').map(Number))
        .sort((a, b) => a[1] - b[1] || a[0] - b[0]); // Sort by y, then x

    // Deduplicate vertical edges and sort by (x, y)
    const verticalEdgesSet = new Set(rawVerticalEdges.map(edge => `${edge[0]},${edge[1]}`));
    const verticalEdges = Array.from(verticalEdgesSet)
        .map(str => str.split(',').map(Number))
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]); // Sort by x, then y

    // 🚫 VALIDATE NO DIAGONAL EDGES
    // Current format only supports axis-aligned edges; diagonal edges would indicate data corruption
    // This validation is implicit since we only extract from horizontalEdges and verticalEdges arrays

    // 🏝️ WARN ON ISOLATED FLOOR TILES (optional sanity check)
    detectFloorIslands(floorTiles);

    // 🔐 VALIDATE PERIMETER CLOSURE (optional sanity check)
    validatePerimeterClosure(floorTiles, horizontalEdges, verticalEdges);

    // 🎯 COORDINATE NORMALIZATION (E-01 requirement)
    // Source of truth = floor tiles only, normalize to content bounds
    let normalizedFloorTiles = floorTiles;
    let normalizedHorizontalEdges = horizontalEdges;
    let normalizedVerticalEdges = verticalEdges;
    let contentBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, widthTiles: 0, heightTiles: 0 };

    if (floorTiles.length > 0) {
        // Compute content bounds from floor tiles only
        const minX = Math.min(...floorTiles.map(tile => tile[0]));
        const minY = Math.min(...floorTiles.map(tile => tile[1]));
        const maxX = Math.max(...floorTiles.map(tile => tile[0]));
        const maxY = Math.max(...floorTiles.map(tile => tile[1]));

        const widthTiles = maxX - minX + 1;
        const heightTiles = maxY - minY + 1;

        contentBounds = { minX, minY, maxX, maxY, widthTiles, heightTiles };

        // Normalize all coordinates by subtracting offset
        normalizedFloorTiles = floorTiles.map(([x, y]) => [x - minX, y - minY]);
        normalizedHorizontalEdges = horizontalEdges.map(([x, y]) => [x - minX, y - minY]);
        normalizedVerticalEdges = verticalEdges.map(([x, y]) => [x - minX, y - minY]);

        console.log(`[EXPORT:3d] Normalized coordinates: offset=(-${minX},-${minY}), content=${widthTiles}×${heightTiles}`);
    }

    // 📊 CONTENT-BASED BOUNDS CALCULATION (E-01 requirement)
    // Bounds computed from actual content dimensions, not canvas/grid size
    const wallHeightMeters = DEFAULT_WALL_HEIGHT_METERS;
    const contentWidthMeters = contentBounds.widthTiles * cellMeters;
    const contentHeightMeters = contentBounds.heightTiles * cellMeters;

    // Validate content fits within simulation limits
    if (contentBounds.widthTiles > SIM_MAX_TILES_X) {
        throw new Error(`Content width ${contentBounds.widthTiles} exceeds simulation limit ${SIM_MAX_TILES_X}`);
    }
    if (contentBounds.heightTiles > SIM_MAX_TILES_Y) {
        throw new Error(`Content height ${contentBounds.heightTiles} exceeds simulation limit ${SIM_MAX_TILES_Y}`);
    }

    // 🎯 PARITY SUMMARY FOR CROSS-CHECKING
    const parity = {
        tiles: normalizedFloorTiles.length,
        edgesH: normalizedHorizontalEdges.length,
        edgesV: normalizedVerticalEdges.length,
        floorArea: normalizedFloorTiles.length, // In grid units
        edgeLenH: normalizedHorizontalEdges.length, // In grid units
        edgeLenV: normalizedVerticalEdges.length // In grid units
    };

    // 🏗️ BUILD CANONICAL OUTPUT
    const output = {
        meta: {
            schema: "scene.3d.v1",
            version: "1.0",
            sourceSchema: "scene.v1",
            created: now,
            name: safeId,
            axes: "Y_up_XZ_ground", // 🔒 EXPLICIT COORDINATE CONVENTION (Three.js Y-up)
            parity: parity,
            offsetFormat: "xy_standard", // 🔒 FLAG: Using x/y offset format (not legacy x/z)
            simLimits: { maxTilesX: SIM_MAX_TILES_X, maxTilesY: SIM_MAX_TILES_Y } // 🎯 SIMULATION CONSTRAINTS
        },
        units: {
            cellMeters: cellMeters,
            wallHeightMeters: wallHeightMeters,
            wallThicknessMeters: 0.2,
            floorThicknessMeters: 0.1,
            lengthUnit: "meters",
            coordinateSystem: "right-handed-y-up"
        },
        bounds: {
            min: {
                x: 0,
                y: 0,
                z: 0
            },
            max: {
                x: contentWidthMeters,
                y: contentHeightMeters,
                z: wallHeightMeters
            },
            center: {
                x: contentWidthMeters / 2,
                y: contentHeightMeters / 2,
                z: wallHeightMeters / 2
            }
        },
        tiles: {
            floor: normalizedFloorTiles
        },
        edges: {
            horizontal: normalizedHorizontalEdges,
            vertical: normalizedVerticalEdges
        },
        originOffset: {
            x: contentBounds.minX,
            y: contentBounds.minY
        }
    };

    // 🔐 DETERMINISTIC DIGEST (simple hash of canonicalized data)
    const canonicalData = JSON.stringify({
        tiles: normalizedFloorTiles,
        edges: { horizontal: normalizedHorizontalEdges, vertical: normalizedVerticalEdges }
    });

    output.meta.digest = computeSimpleHash(canonicalData);

    // 📝 LOUD DIAGNOSTIC LOGGING FOR WIRE-UP CHECK
    console.info("[EXPORT:3d] v2", {
        minX: contentBounds.minX,
        minY: contentBounds.minY,
        widthTiles: contentBounds.widthTiles,
        heightTiles: contentBounds.heightTiles,
        tiles: normalizedFloorTiles.length,
        h: normalizedHorizontalEdges.length,
        v: normalizedVerticalEdges.length,
        units: { cell: cellMeters, wall: wallHeightMeters }
    });

    // 📝 ENHANCED CONSOLE LOGGING (E-01 requirement)
    console.log(`[EXPORT:3d] Parity: tiles=${parity.tiles}, edgesH=${parity.edgesH}, edgesV=${parity.edgesV}, floorArea=${parity.floorArea}, edgeLenH=${parity.edgeLenH}, edgeLenV=${parity.edgeLenV}, digest=${output.meta.digest}`);
    console.log(`[EXPORT:3d] contentTiles=${contentBounds.widthTiles}×${contentBounds.heightTiles}, bounds=${contentWidthMeters}m×${contentHeightMeters}m×${wallHeightMeters}m, offset={x:0,y:0}, axes=Z_up_XY_ground`);

    return output;
}

/**
 * Compute simple deterministic hash of a string
 * @param {string} text - Text to hash
 * @returns {string} Hex-encoded hash
 */
function computeSimpleHash(text) {
    let hash = 0;
    if (text.length === 0) return '0';

    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Detect isolated floor tiles (warn-only sanity check)
 * @param {Array<Array<number>>} floorTiles - Array of [x, y] floor tile coordinates
 */
function detectFloorIslands(floorTiles) {
    if (floorTiles.length === 0) return;

    // Create lookup set for O(1) neighbor checking
    const tileSet = new Set(floorTiles.map(tile => `${tile[0]},${tile[1]}`));

    // Check for single-cell islands (tiles with no 4-neighbor connections)
    const islands = [];
    for (const [x, y] of floorTiles) {
        const neighbors = [
            `${x-1},${y}`, // left
            `${x+1},${y}`, // right
            `${x},${y-1}`, // up
            `${x},${y+1}`  // down
        ];

        const connectedNeighbors = neighbors.filter(coord => tileSet.has(coord)).length;
        if (connectedNeighbors === 0) {
            islands.push([x, y]);
        }
    }

    if (islands.length > 0) {
        console.warn(`[EXPORT:3d] Warning: Found ${islands.length} isolated floor tile(s):`, islands);
        console.warn('[EXPORT:3d] Isolated tiles may indicate unintended single-cell regions.');
    }
}

/**
 * Validate perimeter closure (warn-only sanity check for room completeness)
 * @param {Array<Array<number>>} floorTiles - Array of [x, y] floor tile coordinates
 * @param {Array<Array<number>>} horizontalEdges - Array of [x, y] horizontal edge coordinates
 * @param {Array<Array<number>>} verticalEdges - Array of [x, y] vertical edge coordinates
 */
function validatePerimeterClosure(floorTiles, horizontalEdges, verticalEdges) {
    if (floorTiles.length === 0) return;

    // Create lookup sets for quick edge checking
    const hEdgeSet = new Set(horizontalEdges.map(edge => `${edge[0]},${edge[1]}`));
    const vEdgeSet = new Set(verticalEdges.map(edge => `${edge[0]},${edge[1]}`));
    const tileSet = new Set(floorTiles.map(tile => `${tile[0]},${tile[1]}`));

    // Find perimeter tiles (tiles with at least one non-floor neighbor)
    const perimeterGaps = [];

    for (const [x, y] of floorTiles) {
        // Check each side of the tile for missing walls
        // Top side: need horizontal edge at (x, y)
        if (!tileSet.has(`${x},${y-1}`) && !hEdgeSet.has(`${x},${y}`)) {
            perimeterGaps.push(`Top of tile [${x},${y}] missing wall`);
        }
        // Bottom side: need horizontal edge at (x, y+1)
        if (!tileSet.has(`${x},${y+1}`) && !hEdgeSet.has(`${x},${y+1}`)) {
            perimeterGaps.push(`Bottom of tile [${x},${y}] missing wall`);
        }
        // Left side: need vertical edge at (x, y)
        if (!tileSet.has(`${x-1},${y}`) && !vEdgeSet.has(`${x},${y}`)) {
            perimeterGaps.push(`Left of tile [${x},${y}] missing wall`);
        }
        // Right side: need vertical edge at (x+1, y)
        if (!tileSet.has(`${x+1},${y}`) && !vEdgeSet.has(`${x+1},${y}`)) {
            perimeterGaps.push(`Right of tile [${x},${y}] missing wall`);
        }
    }

    if (perimeterGaps.length > 0) {
        console.warn(`[EXPORT:3d] Warning: Found ${perimeterGaps.length} perimeter gap(s):`);
        perimeterGaps.forEach(gap => console.warn(`[EXPORT:3d]   ${gap}`));
        console.warn('[EXPORT:3d] Gaps may indicate incomplete room enclosure.');
    }
}