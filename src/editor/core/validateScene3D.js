/**
 * validateScene3D - JSON Schema validator for scene.3d.v1 format
 *
 * Lightweight schema validation without third-party dependencies.
 * Returns validation errors in { errors: [{path, msg}], count } format.
 */

/**
 * Validate scene.3d.v1 JSON object against canonical schema
 * @param {Object} obj - Object to validate
 * @returns {Promise<{errors: Array<{path: string, msg: string}>, count: number}>} Validation result
 */
export async function validateScene3D(obj) {
    const errors = [];

    try {
        // Load schema from file
        const schemaResponse = await fetch('/schemas/scene.3d.v1.schema.json');
        if (!schemaResponse.ok) {
            throw new Error(`Failed to load schema: ${schemaResponse.status}`);
        }
        const schema = await schemaResponse.json();

        // Validate against schema
        validateObject(obj, schema, '', errors);

    } catch (error) {
        errors.push({
            path: 'schema',
            msg: `Schema validation failed: ${error.message}`
        });
    }

    return {
        errors,
        count: errors.length
    };
}

/**
 * Recursive object validation against JSON Schema
 * @param {*} value - Value to validate
 * @param {Object} schema - Schema definition
 * @param {string} path - Current property path
 * @param {Array} errors - Error accumulator
 */
function validateObject(value, schema, path, errors) {
    // Type validation
    if (schema.type) {
        const actualType = getJsonType(value);
        if (actualType !== schema.type) {
            errors.push({
                path: path || 'root',
                msg: `Expected type '${schema.type}', got '${actualType}'`
            });
            return; // Stop validation if type is wrong
        }
    }

    // Const validation
    if (schema.const !== undefined && value !== schema.const) {
        errors.push({
            path: path || 'root',
            msg: `Expected constant value '${schema.const}', got '${value}'`
        });
        return;
    }

    // String format validation
    if (schema.format && typeof value === 'string') {
        validateStringFormat(value, schema.format, path, errors);
    }

    // Number validation
    if (typeof value === 'number') {
        validateNumber(value, schema, path, errors);
    }

    // String validation
    if (typeof value === 'string') {
        validateString(value, schema, path, errors);
    }

    // Array validation
    if (Array.isArray(value)) {
        validateArray(value, schema, path, errors);
    }

    // Object validation
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        validateObjectProperties(value, schema, path, errors);
    }
}

/**
 * Get JSON Schema type name for a value
 * @param {*} value - Value to check
 * @returns {string} JSON Schema type name
 */
function getJsonType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

/**
 * Validate string format
 * @param {string} value - String value
 * @param {string} format - Format name
 * @param {string} path - Property path
 * @param {Array} errors - Error accumulator
 */
function validateStringFormat(value, format, path, errors) {
    if (format === 'date-time') {
        // Basic ISO 8601 date-time validation
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
        if (!isoDateRegex.test(value)) {
            errors.push({
                path: path || 'root',
                msg: `Invalid date-time format, expected ISO 8601`
            });
        }
    }
}

/**
 * Validate number constraints
 * @param {number} value - Number value
 * @param {Object} schema - Schema definition
 * @param {string} path - Property path
 * @param {Array} errors - Error accumulator
 */
function validateNumber(value, schema, path, errors) {
    if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({
            path: path || 'root',
            msg: `Value ${value} is less than minimum ${schema.minimum}`
        });
    }

    if (schema.exclusiveMinimum === true && schema.minimum !== undefined && value <= schema.minimum) {
        errors.push({
            path: path || 'root',
            msg: `Value ${value} must be greater than ${schema.minimum}`
        });
    } else if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
        errors.push({
            path: path || 'root',
            msg: `Value ${value} must be greater than ${schema.exclusiveMinimum}`
        });
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({
            path: path || 'root',
            msg: `Value ${value} is greater than maximum ${schema.maximum}`
        });
    }
}

/**
 * Validate string constraints
 * @param {string} value - String value
 * @param {Object} schema - Schema definition
 * @param {string} path - Property path
 * @param {Array} errors - Error accumulator
 */
function validateString(value, schema, path, errors) {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push({
            path: path || 'root',
            msg: `String length ${value.length} is less than minLength ${schema.minLength}`
        });
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push({
            path: path || 'root',
            msg: `String length ${value.length} is greater than maxLength ${schema.maxLength}`
        });
    }
}

/**
 * Validate array constraints and items
 * @param {Array} value - Array value
 * @param {Object} schema - Schema definition
 * @param {string} path - Property path
 * @param {Array} errors - Error accumulator
 */
function validateArray(value, schema, path, errors) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
        errors.push({
            path: path || 'root',
            msg: `Array length ${value.length} is less than minItems ${schema.minItems}`
        });
    }

    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        errors.push({
            path: path || 'root',
            msg: `Array length ${value.length} is greater than maxItems ${schema.maxItems}`
        });
    }

    // Validate array items
    if (schema.items) {
        value.forEach((item, index) => {
            const itemPath = `${path}[${index}]`;
            validateObject(item, schema.items, itemPath, errors);
        });
    }
}

/**
 * Validate object properties and requirements
 * @param {Object} value - Object value
 * @param {Object} schema - Schema definition
 * @param {string} path - Property path
 * @param {Array} errors - Error accumulator
 */
function validateObjectProperties(value, schema, path, errors) {
    // Check required properties
    if (schema.required && Array.isArray(schema.required)) {
        schema.required.forEach(requiredProp => {
            if (!(requiredProp in value)) {
                errors.push({
                    path: path ? `${path}.${requiredProp}` : requiredProp,
                    msg: `Missing required property '${requiredProp}'`
                });
            }
        });
    }

    // Validate properties
    if (schema.properties) {
        Object.keys(value).forEach(prop => {
            const propSchema = schema.properties[prop];
            if (propSchema) {
                const propPath = path ? `${path}.${prop}` : prop;
                validateObject(value[prop], propSchema, propPath, errors);
            } else if (schema.additionalProperties === false) {
                errors.push({
                    path: path ? `${path}.${prop}` : prop,
                    msg: `Additional property '${prop}' is not allowed`
                });
            }
        });

        // Check for missing properties that have schemas
        Object.keys(schema.properties).forEach(schemaProp => {
            if (!(schemaProp in value) && schema.required && schema.required.includes(schemaProp)) {
                // Already handled in required check above
                return;
            }
        });
    }
}