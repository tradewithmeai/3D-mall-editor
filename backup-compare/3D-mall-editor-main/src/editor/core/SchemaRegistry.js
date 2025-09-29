/**
 * SchemaRegistry - Schema detection and normalization for 3D mall templates
 * Detects template types and handles schema aliases
 */

/**
 * Schema aliases mapping
 * Maps deprecated or alternative schema names to canonical ones
 */
const SCHEMA_ALIASES = {
    'gallery-template.v1': 'unit-template.v1',
    'gallery-template': 'unit-template',
    'gallery.v1': 'unit-template.v1'
};

/**
 * Detect template type and version from JSON data
 * @param {Object} json - The JSON data to analyze
 * @returns {Object} - { kind: 'mall'|'unit'|'room'|'scene'|'unknown', version: 'v1'|'' }
 */
export function detect(json) {
    if (!json || typeof json !== 'object') {
        return { kind: 'unknown', version: '' };
    }

    // Try multiple schema field locations
    let schemaStr = json.meta?.schema ||
                   json.schema ||
                   json.$schema ||
                   json.type;

    if (!schemaStr) {
        // Special case: if json.instances is an array, it's a scene
        if (Array.isArray(json.instances)) {
            return { kind: 'scene', version: 'v1' };
        }
        return { kind: 'unknown', version: '' };
    }

    // Normalize to lowercase for comparison
    schemaStr = String(schemaStr).toLowerCase();

    // Apply schema aliases
    schemaStr = SCHEMA_ALIASES[schemaStr] || schemaStr;

    // Extract version
    let version = '';
    if (schemaStr.includes('.v1')) {
        version = 'v1';
    }

    // Determine kind based on schema prefix
    let kind = 'unknown';
    if (schemaStr.startsWith('mall')) {
        kind = 'mall';
    } else if (schemaStr.startsWith('unit')) {
        kind = 'unit';
    } else if (schemaStr.startsWith('room')) {
        kind = 'room';
    } else if (schemaStr.startsWith('scene')) {
        kind = 'scene';
    }

    return { kind, version };
}

/**
 * Normalize schema kind by applying alias mappings
 * @param {string} schemaStr - The original schema string
 * @returns {string} - The normalized schema string
 */
export function normaliseKind(schemaStr) {
    if (!schemaStr || typeof schemaStr !== 'string') {
        return '';
    }

    const normalized = schemaStr.toLowerCase();
    return SCHEMA_ALIASES[normalized] || schemaStr;
}

/**
 * Get all registered schema aliases
 * @returns {Object} - The schema aliases mapping
 */
export function getAliases() {
    return { ...SCHEMA_ALIASES };
}