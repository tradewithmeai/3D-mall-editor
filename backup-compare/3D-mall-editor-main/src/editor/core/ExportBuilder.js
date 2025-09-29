/**
 * ExportBuilder - Single source of truth for all template/scene exports
 * Pure functions with no DOM dependencies
 */

/**
 * Build mall template JSON
 * @param {Object} params - Mall parameters
 * @param {number} params.gridWidth - Grid width
 * @param {number} params.gridHeight - Grid height
 * @param {number} params.cellSize - Cell size in pixels
 * @param {Array} params.units - Array of unit objects with {id, rect}
 * @param {string} [params.id] - Optional mall ID, generates timestamp if not provided
 * @returns {Object} Mall template JSON
 */
export function buildMallTemplate({ gridWidth, gridHeight, cellSize, units, id }) {
    const mallId = id || `mall-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`;

    return {
        meta: {
            schema: 'mall-template.v1',
            version: '1.0',
            name: 'Generated Mall Template'
        },
        id: mallId,
        grid: {
            width: gridWidth,
            height: gridHeight,
            cellSize: cellSize
        },
        units: units.map(unit => ({
            id: unit.id,
            rect: { ...unit.rect }
        })),
        created: new Date().toISOString()
    };
}

/**
 * Build unit template JSON (UI label "Gallery", schema is unit-template.v1)
 * @param {Object} params - Unit parameters
 * @param {string} params.id - Unit ID
 * @param {Object} params.rect - Rectangle {x, y, w, h}
 * @param {Array} [params.rooms] - Optional array of room objects
 * @param {string} [params.parentMallId] - Optional parent mall ID
 * @returns {Object} Unit template JSON
 */
export function buildUnitTemplate({ id, rect, rooms = [], parentMallId }) {
    const template = {
        meta: {
            schema: 'unit-template.v1',
            version: '1.0',
            name: `Unit Template ${id}`
        },
        id: id,
        rect: { ...rect },
        rooms: rooms.map(room => ({
            id: room.id,
            gridRect: { ...room.gridRect }
        })),
        created: new Date().toISOString()
    };

    // Add parent link if provided
    if (parentMallId) {
        template.meta.parent = {
            schema: 'mall-template.v1',
            id: parentMallId
        };
    }

    return template;
}

/**
 * Build room template JSON
 * @param {Object} params - Room parameters
 * @param {string} params.id - Room ID
 * @param {Object} params.rect - Rectangle {x, y, w, h}
 * @param {Array} [params.zones] - Optional array of zone objects
 * @param {string} [params.parentUnitId] - Optional parent unit ID
 * @returns {Object} Room template JSON
 */
export function buildRoomTemplate({ id, rect, zones = [], parentUnitId }) {
    const template = {
        meta: {
            schema: 'room-template.v1',
            version: '1.0'
        },
        id: id,
        rect: { ...rect },
        zones: [...zones],
        created: new Date().toISOString()
    };

    // Add parent link if provided (same pattern as gallery templates)
    if (parentUnitId) {
        template.meta.parent = {
            schema: 'unit-template.v1',
            id: parentUnitId
        };
    }

    return template;
}

/**
 * Build scene.v1 JSON
 * @param {Object} params - Scene parameters
 * @param {number} params.gridWidth - Grid width
 * @param {number} params.gridHeight - Grid height
 * @param {number} params.cellSize - Cell size in pixels
 * @param {Array} params.floorTiles - Array of [x,y] coordinate arrays
 * @param {Array} params.hEdges - Array of [x,y] coordinate arrays for horizontal edges
 * @param {Array} params.vEdges - Array of [x,y] coordinate arrays for vertical edges
 * @returns {Object} Scene v1 JSON
 */
export function buildSceneV1({ gridWidth, gridHeight, cellSize, floorTiles, hEdges, vEdges }) {
    const now = new Date().toISOString();

    return {
        meta: {
            schema: 'scene.v1',
            version: '1.0',
            created: now,
            modified: now
        },
        grid: {
            width: gridWidth,
            height: gridHeight,
            cellSize: cellSize
        },
        tiles: {
            floor: floorTiles
        },
        edges: {
            horizontal: hEdges,
            vertical: vEdges
        }
    };
}