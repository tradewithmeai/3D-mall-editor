/**
 * TemplateLoader - Loads and normalizes template data to DTOs
 * Converts various template formats to standardized data transfer objects
 */

import { detect } from './SchemaRegistry.js';

/**
 * Load and normalize template JSON data
 * @param {Object} json - The template JSON data
 * @returns {Object} - { dto, mode } where dto is normalized data and mode is template type
 * @throws {Error} - If format is unsupported
 */
export function load(json) {
    const { kind, version } = detect(json);

    let dto;
    let mode;

    switch (kind) {
        case 'mall':
            dto = normalizeMallTemplate(json);
            mode = 'mall-template';
            break;

        case 'unit':
            dto = normalizeUnitTemplate(json);
            mode = 'unit-template';
            break;

        case 'room':
            dto = normalizeRoomTemplate(json);
            mode = 'room-template';
            break;

        case 'object':
            dto = normalizeObjectTemplate(json);
            mode = 'object-template';
            break;

        case 'scene':
            dto = normalizeScene(json);
            mode = 'scene';
            break;

        default:
            throw new Error(`Unsupported format: ${kind} (version: ${version})`);
    }

    return { dto, mode };
}

/**
 * Normalize mall template to standard DTO format
 * @param {Object} json - Mall template JSON
 * @returns {Object} - Normalized mall DTO
 */
function normalizeMallTemplate(json) {
    // Extract grid size with explicit validation per zzz18 spec
    const gridSize = (json.gridSize && typeof json.gridSize.width === 'number' && typeof json.gridSize.height === 'number')
        ? json.gridSize
        : (json.grid && typeof json.grid.width === 'number' && typeof json.grid.height === 'number')
        ? json.grid
        : null;

    // Extract mall rect if present (zzz20)
    const mallRect = normalizeRect(json.rect || json.bounds || json.gridRect) || null;

    const dto = {
        type: 'mall',
        id: json.id || 'mall',
        rect: mallRect, // NEW: optional mall-level rect
        units: (Array.isArray(json.units) ? json.units : []).map(u => ({
            id: u?.id || 'gallery',
            rect: normalizeRect(u?.rect || u?.bounds || u?.gridRect)
        })).filter(x => x.rect),
        gridSize // may be null
    };

    return dto;
}

/**
 * Unified normalizer for all child templates (unit/room/object)
 * @param {Object} json - Template JSON data
 * @param {Object} config - Template configuration
 * @returns {Object} - Normalized template DTO
 */
function normalizeChildTemplate(json, config) {
    const dto = {
        type: config.type,
        id: json.id || config.defaultId,
        rect: { x: 0, y: 0, w: config.defaultSize.w, h: config.defaultSize.h },
        children: [],
        parentId: extractParentId(json, config.type)
    };

    // Extract main rect from multiple possible locations
    dto.rect = normalizeRect(json.rect || json.bounds) || dto.rect;

    // Get children array from various possible locations
    let childrenArray = null;

    // Try direct property (new format)
    if (Array.isArray(json[config.childrenProperty])) {
        childrenArray = json[config.childrenProperty];
    }
    // Try legacy property name (backwards compatibility)
    else if (config.legacyChildrenProperty && Array.isArray(json[config.legacyChildrenProperty])) {
        childrenArray = json[config.legacyChildrenProperty];
    }
    // Try legacy path like features.floorZones
    else if (config.legacyChildrenPath) {
        const pathParts = config.legacyChildrenPath.split('.');
        let current = json;
        for (const part of pathParts) {
            current = current?.[part];
            if (!current) break;
        }
        if (Array.isArray(current)) {
            childrenArray = current;
        }
    }

    // Process children array if found
    if (childrenArray) {
        dto.children = childrenArray.map(child => ({
            id: child.id || `${config.childIdPrefix}-${Math.random().toString(36).substr(2, 9)}`,
            rect: normalizeRect(child.rect || child.bounds || child.gridRect)
        })).filter(child => child.rect); // Only include children with valid rects
    }

    // If no direct rect, try to get from first child as fallback
    if (!normalizeRect(json.rect || json.bounds) && dto.children.length > 0) {
        dto.rect = dto.children[0].rect;
    }

    return dto;
}

/**
 * Extract parent ID from template JSON - standardized approach
 * @param {Object} json - Template JSON data
 * @param {string} templateType - Template type (unit/room/object)
 * @returns {string|null} - Parent ID or null
 */
function extractParentId(json, templateType) {
    // Check meta.parent first (standard format)
    if (json.meta?.parent?.id) {
        return json.meta.parent.id;
    }

    // Legacy fallback - but these should be migrated to meta.parent
    const legacyProperties = {
        'unit': ['parentMallId'],
        'room': ['parentUnitId', 'parentGalleryId'], // parentUnitId is correct, parentGalleryId is legacy
        'object': ['parentRoomId']
    };

    const properties = legacyProperties[templateType] || [];
    for (const prop of properties) {
        if (json[prop]) {
            return json[prop];
        }
    }

    return null;
}

/**
 * Normalize unit template to standard DTO format
 * @param {Object} json - Unit template JSON
 * @returns {Object} - Normalized unit DTO
 */
function normalizeUnitTemplate(json) {
    return normalizeChildTemplate(json, {
        type: 'unit',
        defaultId: 'unit',
        defaultSize: { w: 10, h: 10 },
        childrenProperty: 'children',
        childIdPrefix: 'room',
        // Support legacy rooms property
        legacyChildrenProperty: 'rooms'
    });
}

/**
 * Normalize room template to standard DTO format
 * @param {Object} json - Room template JSON
 * @returns {Object} - Normalized room DTO
 */
function normalizeRoomTemplate(json) {
    return normalizeChildTemplate(json, {
        type: 'room',
        defaultId: 'room',
        defaultSize: { w: 5, h: 5 },
        childrenProperty: 'children',
        childIdPrefix: 'zone',
        // Support legacy features.floorZones format
        legacyChildrenPath: 'features.floorZones'
    });
}

/**
 * Normalize object template to standard DTO format
 * @param {Object} json - Object template JSON
 * @returns {Object} - Normalized object DTO
 */
function normalizeObjectTemplate(json) {
    return normalizeChildTemplate(json, {
        type: 'object',
        defaultId: 'object',
        defaultSize: { w: 3, h: 3 },
        childrenProperty: 'children',
        childIdPrefix: 'item',
        // Support legacy items format
        legacyChildrenProperty: 'items'
    });
}

/**
 * Normalize scene data
 * @param {Object} json - Scene JSON
 * @returns {Object} - Normalized scene DTO
 */
function normalizeScene(json) {
    return {
        type: 'scene',
        instances: Array.isArray(json.instances) ? json.instances : []
    };
}

/**
 * Normalize rectangle object to standard {x, y, w, h} format
 * @param {Object} rect - Rectangle object in various formats
 * @returns {Object|null} - Normalized rectangle or null if invalid
 */
function normalizeRect(rect) {
    if (!rect || typeof rect !== 'object') {
        return null;
    }

    // Handle different rectangle formats
    const x = rect.x ?? rect.left ?? 0;
    const y = rect.y ?? rect.top ?? 0;
    const w = rect.w ?? rect.width ?? rect.right - rect.left ?? 0;
    const h = rect.h ?? rect.height ?? rect.bottom - rect.top ?? 0;

    return { x, y, w, h };
}