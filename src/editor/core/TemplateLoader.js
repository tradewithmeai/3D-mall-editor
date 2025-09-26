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
 * Normalize unit template to standard DTO format
 * @param {Object} json - Unit template JSON
 * @returns {Object} - Normalized unit DTO
 */
function normalizeUnitTemplate(json) {
    const dto = {
        type: 'unit',
        rect: { x: 0, y: 0, w: 10, h: 10 }, // Default fallback
        rooms: []
    };

    // Extract main rect from multiple possible locations
    dto.rect = normalizeRect(json.rect || json.bounds);

    // If no direct rect, try to get from first room as fallback
    if (!dto.rect && Array.isArray(json.rooms) && json.rooms.length > 0) {
        dto.rect = normalizeRect(json.rooms[0].rect || json.rooms[0].bounds);
    }

    // Extract rooms array
    if (Array.isArray(json.rooms)) {
        dto.rooms = json.rooms.map(room => ({
            id: room.id || `room-${Math.random().toString(36).substr(2, 9)}`,
            rect: normalizeRect(room.rect || room.bounds || room.gridRect)
        }));
    }

    return dto;
}

/**
 * Normalize room template to standard DTO format
 * @param {Object} json - Room template JSON
 * @returns {Object} - Normalized room DTO
 */
function normalizeRoomTemplate(json) {
    const dto = {
        type: 'room',
        rect: { x: 0, y: 0, w: 5, h: 5 }, // Default fallback
        zones: []
    };

    // Extract main rect
    dto.rect = normalizeRect(json.rect || json.bounds);

    // If no direct rect, try to get from first zone as fallback
    if (!dto.rect && json.features?.floorZones?.length > 0) {
        dto.rect = normalizeRect(json.features.floorZones[0].bounds);
    }

    // Extract zones from features.floorZones
    if (json.features?.floorZones) {
        dto.zones = json.features.floorZones.map(zone => ({
            id: zone.id || `zone-${Math.random().toString(36).substr(2, 9)}`,
            rect: normalizeRect(zone.bounds || zone.rect)
        }));
    }

    return dto;
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