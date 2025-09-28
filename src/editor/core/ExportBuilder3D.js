/**
 * ExportBuilder3D - Builds scene.3d.v1 JSON per Interface Contract v1
 *
 * Converts 2D scene data to 3D construction API format with exact field mapping
 * as specified in reports/2d→3d-interface-v1.md
 */

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

    // Calculate units per Interface Contract v1
    const cellMeters = cellSize * 0.05; // worldUnit = cellSize × 0.05 meters/pixel

    // Extract floor tiles
    const floorTiles = [];
    for (let y = 0; y < sceneModel.grid.length; y++) {
        for (let x = 0; x < sceneModel.grid[y].length; x++) {
            if (sceneModel.grid[y][x] === 'floor') {
                floorTiles.push([x, y]);
            }
        }
    }

    // Extract horizontal edges (walls)
    const horizontalEdges = [];
    for (let y = 0; y < sceneModel.horizontalEdges.length; y++) {
        for (let x = 0; x < sceneModel.horizontalEdges[y].length; x++) {
            if (sceneModel.horizontalEdges[y] && sceneModel.horizontalEdges[y][x]) {
                horizontalEdges.push([x, y]);
            }
        }
    }

    // Extract vertical edges (walls)
    const verticalEdges = [];
    for (let y = 0; y < sceneModel.verticalEdges.length; y++) {
        for (let x = 0; x < sceneModel.verticalEdges[y].length; x++) {
            if (sceneModel.verticalEdges[y] && sceneModel.verticalEdges[y][x]) {
                verticalEdges.push([x, y]);
            }
        }
    }

    // Calculate scene bounds
    const gridWidth = sceneModel.grid[0]?.length || 0;
    const gridHeight = sceneModel.grid.length || 0;

    // Build scene.3d.v1 JSON exactly per Interface Contract v1
    return {
        meta: {
            schema: "scene.3d.v1",
            version: "1.0",
            sourceSchema: "scene.v1",
            created: now,
            name: safeId
        },
        units: {
            cellMeters: cellMeters,
            wallHeightMeters: 3.0,
            wallThicknessMeters: 0.2,
            floorThicknessMeters: 0.1,
            lengthUnit: "meters",
            coordinateSystem: "right-handed-y-up"
        },
        bounds: {
            min: { x: 0, y: 0, z: 0 },
            max: {
                x: gridWidth * cellMeters,
                y: 3.0,
                z: gridHeight * cellMeters
            },
            center: {
                x: (gridWidth * cellMeters) / 2,
                y: 1.5,
                z: (gridHeight * cellMeters) / 2
            }
        },
        tiles: {
            floor: floorTiles
        },
        edges: {
            horizontal: horizontalEdges,
            vertical: verticalEdges
        },
        originOffset: {
            x: 0,
            z: 0
        }
    };
}