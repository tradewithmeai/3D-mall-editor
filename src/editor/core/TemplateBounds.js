/**
 * TemplateBounds - Boundary checking for template DTOs
 * Creates boundary checkers that validate coordinates against template constraints
 */

/**
 * Create boundary checker for a template DTO
 * @param {Object} dto - Template DTO from TemplateLoader
 * @returns {Object} - { isInside(x, y): boolean }
 */
export function makeBounds(dto) {
    if (!dto || !dto.type) {
        // Default: allow everything for unknown/invalid DTOs
        return {
            isInside: () => true
        };
    }

    switch (dto.type) {
        case 'mall':
            return makeMallBounds(dto);

        case 'unit':
        case 'room':
            return makeRectBounds(dto.rect);

        case 'scene':
        default:
            // Scene and unknown types allow all coordinates
            return {
                isInside: () => true
            };
    }
}

/**
 * Create boundary checker for mall DTO (union of unit rectangles)
 * @param {Object} dto - Mall template DTO
 * @returns {Object} - { isInside(x, y): boolean }
 */
function makeMallBounds(dto) {
    if (!Array.isArray(dto.units) || dto.units.length === 0) {
        // No units defined, allow everything
        return {
            isInside: () => true
        };
    }

    return {
        isInside: (x, y) => {
            // Point is inside if it's within any unit rectangle
            return dto.units.some(unit => {
                if (!unit.rect) return false;
                return isPointInRect(x, y, unit.rect);
            });
        }
    };
}

/**
 * Create boundary checker for single rectangle
 * @param {Object} rect - Rectangle object {x, y, w, h}
 * @returns {Object} - { isInside(x, y): boolean }
 */
function makeRectBounds(rect) {
    if (!rect) {
        // No rect defined, allow everything
        return {
            isInside: () => true
        };
    }

    return {
        isInside: (x, y) => isPointInRect(x, y, rect)
    };
}

/**
 * Check if a point is inside a rectangle
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Object} rect - Rectangle {x, y, w, h}
 * @returns {boolean} - True if point is inside rectangle
 */
function isPointInRect(x, y, rect) {
    if (!rect || typeof rect !== 'object') {
        return false;
    }

    const { x: rx, y: ry, w, h } = rect;

    // Handle invalid rectangle dimensions
    if (w <= 0 || h <= 0) {
        return false;
    }

    return x >= rx &&
           x < rx + w &&
           y >= ry &&
           y < ry + h;
}

/**
 * Utility: Check if rectangle is valid
 * @param {Object} rect - Rectangle to validate
 * @returns {boolean} - True if rectangle has valid dimensions
 */
export function isValidRect(rect) {
    return rect &&
           typeof rect === 'object' &&
           typeof rect.x === 'number' &&
           typeof rect.y === 'number' &&
           typeof rect.w === 'number' &&
           typeof rect.h === 'number' &&
           rect.w > 0 &&
           rect.h > 0;
}

/**
 * Utility: Calculate bounding box for multiple rectangles
 * @param {Array} rects - Array of rectangle objects
 * @returns {Object|null} - Bounding rectangle or null if empty
 */
export function getBoundingRect(rects) {
    if (!Array.isArray(rects) || rects.length === 0) {
        return null;
    }

    const validRects = rects.filter(isValidRect);
    if (validRects.length === 0) {
        return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    validRects.forEach(rect => {
        minX = Math.min(minX, rect.x);
        minY = Math.min(minY, rect.y);
        maxX = Math.max(maxX, rect.x + rect.w);
        maxY = Math.max(maxY, rect.y + rect.h);
    });

    return {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY
    };
}