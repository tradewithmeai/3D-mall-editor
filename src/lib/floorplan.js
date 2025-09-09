/**
 * Floorplan utility functions for grid<->JSON conversion and manipulation
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