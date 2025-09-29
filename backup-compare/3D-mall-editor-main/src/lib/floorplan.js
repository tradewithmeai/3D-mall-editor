/**
 * Floorplan utility functions for grid<->JSON conversion and manipulation
 * Supports both tile-based and edge-based wall systems
 */

/**
 * Convert a 2D grid to 3D instances array matching the room-layout.json schema
 * @param {Array<Array<string>>} grid - 2D array where each cell contains 'empty', 'floor', or 'wall'
 * @param {Object} options - Conversion options
 * @returns {Array} Array of instances for JSON export
 */
export function gridToInstances(grid, options = {}) {
    const {
        cellSize = 2,  // Size of each grid cell in 3D units
        floorHeight = 0,
        wallHeight = 4,
        includeReferencePole = true
    } = options;
    
    const instances = [];
    
    // Add reference pole by default
    if (includeReferencePole) {
        instances.push({
            type: "referencePole",
            position: [0, 0.5, 0]
        });
    }
    
    const gridHeight = grid.length;
    const gridWidth = grid[0]?.length || 0;
    
    // Convert grid cells to 3D instances
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const tileType = grid[y][x];
            const worldX = x * cellSize;
            const worldZ = y * cellSize;
            
            if (tileType === 'floor') {
                instances.push({
                    type: "lobbyFloor",
                    position: [worldX, floorHeight, worldZ],
                    rotation: [-1.5707963267948966, 0, 0]
                });
            } else if (tileType === 'wall') {
                instances.push({
                    type: "lobbyWall",
                    position: [worldX, wallHeight, worldZ],
                    rotation: [0, 0, 0]
                });
            }
        }
    }
    
    return instances;
}

/**
 * Convert instances array to 2D grid
 * @param {Array} instances - Array of 3D instances
 * @param {Object} options - Conversion options
 * @returns {Array<Array<string>>} 2D grid array
 */
export function instancesToGrid(instances, options = {}) {
    const {
        cellSize = 2,
        gridWidth = 40,
        gridHeight = 30,
        defaultTile = 'empty'
    } = options;
    
    // Initialize empty grid
    const grid = createEmptyGrid(gridWidth, gridHeight, defaultTile);
    
    instances.forEach(instance => {
        if (instance.position && instance.type) {
            const [worldX, worldY, worldZ] = instance.position;
            const gridX = Math.floor(worldX / cellSize);
            const gridY = Math.floor(worldZ / cellSize);
            
            if (isValidGridPosition(gridX, gridY, gridWidth, gridHeight)) {
                if (instance.type === 'lobbyFloor') {
                    grid[gridY][gridX] = 'floor';
                } else if (isWallType(instance.type)) {
                    grid[gridY][gridX] = 'wall';
                }
            }
        }
    });
    
    return grid;
}

/**
 * Create an empty grid filled with default tiles
 * @param {number} width - Grid width
 * @param {number} height - Grid height  
 * @param {string} defaultTile - Default tile type
 * @returns {Array<Array<string>>} Empty grid
 */
export function createEmptyGrid(width, height, defaultTile = 'empty') {
    const grid = [];
    for (let y = 0; y < height; y++) {
        grid[y] = [];
        for (let x = 0; x < width; x++) {
            grid[y][x] = defaultTile;
        }
    }
    return grid;
}

/**
 * Flood fill algorithm to fill connected areas with the same tile type
 * @param {Array<Array<string>>} grid - Grid to modify
 * @param {number} startX - Starting X position
 * @param {number} startY - Starting Y position
 * @param {string} newTileType - New tile type to fill with
 * @returns {Array<Array<string>>} Modified grid
 */
export function floodFill(grid, startX, startY, newTileType) {
    const gridHeight = grid.length;
    const gridWidth = grid[0]?.length || 0;
    
    if (!isValidGridPosition(startX, startY, gridWidth, gridHeight)) {
        return grid;
    }
    
    const originalTileType = grid[startY][startX];
    if (originalTileType === newTileType) {
        return grid;
    }
    
    // Create a deep copy of the grid
    const newGrid = grid.map(row => [...row]);
    
    const stack = [[startX, startY]];
    
    while (stack.length > 0) {
        const [x, y] = stack.pop();
        
        if (!isValidGridPosition(x, y, gridWidth, gridHeight) || 
            newGrid[y][x] !== originalTileType) {
            continue;
        }
        
        newGrid[y][x] = newTileType;
        
        // Add adjacent cells to stack
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    
    return newGrid;
}

/**
 * Check if a grid position is valid (within bounds)
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Grid width
 * @param {number} height - Grid height
 * @returns {boolean} True if position is valid
 */
export function isValidGridPosition(x, y, width, height) {
    return x >= 0 && x < width && y >= 0 && y < height;
}

/**
 * Check if an instance type represents a wall
 * @param {string} instanceType - The instance type to check
 * @returns {boolean} True if it's a wall type
 */
export function isWallType(instanceType) {
    const wallTypes = [
        'lobbyWall',
        'lobbyNorthWall', 
        'lobbySouthWall',
        'lobbyEastWall',
        'lobbyWestWall'
    ];
    return wallTypes.includes(instanceType);
}

/**
 * Calculate bounds of non-empty tiles in grid
 * @param {Array<Array<string>>} grid - Grid to analyze
 * @returns {Object} Bounds object with min/max x/y coordinates
 */
export function calculateGridBounds(grid) {
    const gridHeight = grid.length;
    const gridWidth = grid[0]?.length || 0;
    
    let minX = gridWidth, maxX = -1;
    let minY = gridHeight, maxY = -1;
    
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (grid[y][x] !== 'empty') {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
    }
    
    return {
        minX: minX === gridWidth ? 0 : minX,
        maxX: maxX === -1 ? 0 : maxX,
        minY: minY === gridHeight ? 0 : minY,
        maxY: maxY === -1 ? 0 : maxY,
        width: maxX === -1 ? 0 : maxX - minX + 1,
        height: maxY === -1 ? 0 : maxY - minY + 1
    };
}

/**
 * Count tiles of each type in grid
 * @param {Array<Array<string>>} grid - Grid to analyze
 * @returns {Object} Count object with tile type keys
 */
export function countTileTypes(grid) {
    const counts = {};
    const gridHeight = grid.length;
    const gridWidth = grid[0]?.length || 0;
    
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const tileType = grid[y][x];
            counts[tileType] = (counts[tileType] || 0) + 1;
        }
    }
    
    return counts;
}

/**
 * Validate that a JSON object matches the expected room-layout schema
 * @param {Object} jsonData - JSON data to validate
 * @returns {Object} Validation result with isValid boolean and errors array
 */
export function validateRoomLayoutJSON(jsonData) {
    const errors = [];
    let isValid = true;
    
    if (!jsonData || typeof jsonData !== 'object') {
        errors.push('JSON data must be an object');
        isValid = false;
        return { isValid, errors };
    }
    
    if (!jsonData.instances || !Array.isArray(jsonData.instances)) {
        errors.push('JSON must contain an "instances" array');
        isValid = false;
    } else {
        jsonData.instances.forEach((instance, index) => {
            if (!instance.type || typeof instance.type !== 'string') {
                errors.push(`Instance ${index}: missing or invalid "type" field`);
                isValid = false;
            }
            
            if (!instance.position || !Array.isArray(instance.position) || instance.position.length !== 3) {
                errors.push(`Instance ${index}: missing or invalid "position" field (should be [x,y,z] array)`);
                isValid = false;
            }
        });
    }
    
    return { isValid, errors };
}

/**
 * Create empty edge sets for horizontal and vertical edges
 * @param {number} width - Grid width
 * @param {number} height - Grid height
 * @returns {Object} Object with horizontalEdges and verticalEdges arrays
 */
export function createEmptyEdgeSets(width, height) {
    const horizontalEdges = [];
    const verticalEdges = [];
    
    for (let y = 0; y < height; y++) {
        horizontalEdges[y] = [];
        verticalEdges[y] = [];
        for (let x = 0; x < width; x++) {
            horizontalEdges[y][x] = false;
            verticalEdges[y][x] = false;
        }
    }
    
    return { horizontalEdges, verticalEdges };
}

/**
 * Rasterize edge sets back to wall tiles for JSON export
 * Uses the rule: H(x,y) -> tile(x, y-1), V(x,y) -> tile(x-1, y)
 * @param {Array<Array<boolean>>} horizontalEdges - Horizontal edge set
 * @param {Array<Array<boolean>>} verticalEdges - Vertical edge set
 * @param {number} gridWidth - Grid width
 * @param {number} gridHeight - Grid height
 * @returns {Array<Array<boolean>>} 2D array of wall tile positions
 */
export function rasterizeEdgesToWalls(horizontalEdges, verticalEdges, gridWidth, gridHeight) {
    const wallTiles = [];
    for (let y = 0; y < gridHeight; y++) {
        wallTiles[y] = [];
        for (let x = 0; x < gridWidth; x++) {
            wallTiles[y][x] = false;
        }
    }
    
    // For horizontal edges H(x,y), mark tile (x, y-1) as wall if in bounds
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (horizontalEdges[y][x]) {
                if (y - 1 >= 0) {
                    wallTiles[y - 1][x] = true;
                }
            }
        }
    }
    
    // For vertical edges V(x,y), mark tile (x-1, y) as wall if in bounds
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (verticalEdges[y][x]) {
                if (x - 1 >= 0) {
                    wallTiles[y][x - 1] = true;
                }
            }
        }
    }
    
    return wallTiles;
}

/**
 * Reconstruct edge sets from wall tile positions heuristically
 * Creates edges on borders of wall tiles where the neighbor is not a wall
 * @param {Array<Array<string>>} grid - Grid with wall tiles
 * @param {number} gridWidth - Grid width
 * @param {number} gridHeight - Grid height
 * @returns {Object} Object with horizontalEdges and verticalEdges arrays
 */
export function reconstructEdgesFromWalls(grid, gridWidth, gridHeight) {
    const { horizontalEdges, verticalEdges } = createEmptyEdgeSets(gridWidth, gridHeight);
    
    // Collect wall positions from instances (not grid tiles)
    const wallPositions = new Set();
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (isWallType(grid[y][x]) || grid[y][x] === 'wall') {
                wallPositions.add(`${x},${y}`);
            }
        }
    }
    
    // For each wall tile, add edges on its borders where the neighbor is not a wall
    for (const posKey of wallPositions) {
        const [x, y] = posKey.split(',').map(Number);
        
        // Top edge: horizontal edge at (x, y) - only if cell above is not a wall
        if (y === 0 || !wallPositions.has(`${x},${y-1}`)) {
            horizontalEdges[y][x] = true;
        }
        
        // Bottom edge: horizontal edge at (x, y+1) - only if cell below is not a wall  
        if (y === gridHeight - 1 || !wallPositions.has(`${x},${y+1}`)) {
            if (y + 1 < gridHeight) {
                horizontalEdges[y + 1][x] = true;
            }
        }
        
        // Left edge: vertical edge at (x, y) - only if cell to left is not a wall
        if (x === 0 || !wallPositions.has(`${x-1},${y}`)) {
            verticalEdges[y][x] = true;
        }
        
        // Right edge: vertical edge at (x+1, y) - only if cell to right is not a wall
        if (x === gridWidth - 1 || !wallPositions.has(`${x+1},${y}`)) {
            if (x + 1 < gridWidth) {
                verticalEdges[y][x + 1] = true;
            }
        }
    }
    
    return { horizontalEdges, verticalEdges };
}

/**
 * Convert edge sets and floor grid to instances for JSON export
 * @param {Array<Array<string>>} grid - Floor tile grid
 * @param {Array<Array<boolean>>} horizontalEdges - Horizontal edge set
 * @param {Array<Array<boolean>>} verticalEdges - Vertical edge set
 * @param {Object} options - Conversion options
 * @returns {Array} Array of instances for JSON export
 */
export function edgeGridToInstances(grid, horizontalEdges, verticalEdges, options = {}) {
    const {
        cellSize = 2,
        floorHeight = 0,
        wallHeight = 4,
        includeReferencePole = true
    } = options;
    
    const instances = [];
    
    // Add reference pole by default
    if (includeReferencePole) {
        instances.push({
            type: "referencePole",
            position: [0, 0.5, 0]
        });
    }
    
    const gridHeight = grid.length;
    const gridWidth = grid[0]?.length || 0;
    
    // Rasterize edges to wall tiles
    const wallTiles = rasterizeEdgesToWalls(horizontalEdges, verticalEdges, gridWidth, gridHeight);
    
    // Convert floors and rasterized walls to 3D instances
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const tileType = grid[y][x];
            const isWall = wallTiles[y][x];
            const worldX = x * cellSize;
            const worldZ = y * cellSize;
            
            if (tileType === 'floor') {
                instances.push({
                    type: "lobbyFloor",
                    position: [worldX, floorHeight, worldZ],
                    rotation: [-1.5707963267948966, 0, 0]
                });
            } else if (tileType === 'wall' || isWall) {
                instances.push({
                    type: "lobbyWall",
                    position: [worldX, wallHeight, worldZ],
                    rotation: [0, 0, 0]
                });
            }
        }
    }
    
    return instances;
}

/**
 * Convert instances to grid and edge sets
 * @param {Array} instances - Array of 3D instances
 * @param {Object} options - Conversion options
 * @returns {Object} Object with grid, horizontalEdges, and verticalEdges
 */
export function instancesToEdgeGrid(instances, options = {}) {
    const {
        cellSize = 2,
        gridWidth = 40,
        gridHeight = 30,
        defaultTile = 'empty'
    } = options;
    
    // Initialize grid and edge sets
    const grid = createEmptyGrid(gridWidth, gridHeight, defaultTile);
    
    // Extract floors and walls from instances
    instances.forEach(instance => {
        if (instance.position && instance.type) {
            const [worldX, worldY, worldZ] = instance.position;
            const gridX = Math.floor(worldX / cellSize);
            const gridY = Math.floor(worldZ / cellSize);
            
            if (isValidGridPosition(gridX, gridY, gridWidth, gridHeight)) {
                if (instance.type === 'lobbyFloor') {
                    grid[gridY][gridX] = 'floor';
                } else if (isWallType(instance.type)) {
                    grid[gridY][gridX] = 'wall';
                }
            }
        }
    });
    
    // Reconstruct edges from wall tiles
    const { horizontalEdges, verticalEdges } = reconstructEdgesFromWalls(grid, gridWidth, gridHeight);
    
    return { grid, horizontalEdges, verticalEdges };
}