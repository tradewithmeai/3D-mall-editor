#!/usr/bin/env node

/**
 * Golden Round-Trip Test for Scene.v1 Format
 *
 * Tests that Save → Load → Save produces identical results
 * This ensures data integrity and validates the round-trip guarantee
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Load schema
const schemaPath = path.join(__dirname, '..', 'docs', 'schema', 'scene.v1.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

// Setup AJV
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addFormat('date', /^\d{4}-\d{2}-\d{2}$/);
const validate = ajv.compile(schema);

// Test data - represents a simple scene
const testScene = {
    meta: {
        schema: "scene.v1",
        version: "1.0",
        created: "2025-09-24T13:00:00.000Z",
        modified: "2025-09-24T13:00:00.000Z",
        author: "golden-test"
    },
    grid: {
        width: 10,
        height: 8,
        cellSize: 20
    },
    tiles: {
        floor: [
            [1, 1], [2, 1], [3, 1],
            [1, 2], [2, 2], [3, 2],
            [5, 5], [6, 5], [7, 5]
        ]
    },
    edges: {
        horizontal: [
            [1, 0], [2, 0], [3, 0],  // Top wall
            [1, 3], [2, 3], [3, 3]   // Bottom wall
        ],
        vertical: [
            [0, 1], [0, 2],  // Left wall
            [4, 1], [4, 2]   // Right wall
        ]
    }
};

/**
 * Compare two coordinate arrays (ignoring order)
 */
function compareCoordinateArrays(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;

    const sorted1 = arr1.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const sorted2 = arr2.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    return JSON.stringify(sorted1) === JSON.stringify(sorted2);
}

/**
 * Deep comparison of two objects ignoring timestamp fields
 */
function deepEqualIgnoreTimestamps(obj1, obj2, path = '') {
    if (obj1 === obj2) return true;

    if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 === null || obj2 === null) {
        return false;
    }

    // Special handling for coordinate arrays
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
        // Check if this is a coordinate array (array of [x, y] pairs)
        const isCoordArray1 = obj1.every(item => Array.isArray(item) && item.length === 2 && typeof item[0] === 'number');
        const isCoordArray2 = obj2.every(item => Array.isArray(item) && item.length === 2 && typeof item[0] === 'number');

        if (isCoordArray1 && isCoordArray2) {
            return compareCoordinateArrays(obj1, obj2);
        }

        // Regular array comparison
        if (obj1.length !== obj2.length) return false;
        for (let i = 0; i < obj1.length; i++) {
            if (!deepEqualIgnoreTimestamps(obj1[i], obj2[i], `${path}[${i}]`)) {
                return false;
            }
        }
        return true;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    // Filter out timestamp fields for comparison
    const filteredKeys1 = keys1.filter(key => key !== 'created' && key !== 'modified');
    const filteredKeys2 = keys2.filter(key => key !== 'created' && key !== 'modified');

    // Check if we have the same non-timestamp keys
    if (filteredKeys1.length !== filteredKeys2.length) {
        console.error(`Key count mismatch at ${path}: ${filteredKeys1.length} vs ${filteredKeys2.length}`);
        console.error(`Keys1 (filtered):`, filteredKeys1);
        console.error(`Keys2 (filtered):`, filteredKeys2);
        return false;
    }

    for (let key of filteredKeys1) {
        if (!filteredKeys2.includes(key)) {
            console.error(`Missing key at ${path}.${key}`);
            return false;
        }

        if (!deepEqualIgnoreTimestamps(obj1[key], obj2[key], path ? `${path}.${key}` : key)) {
            console.error(`Value mismatch at ${path}.${key}`);
            console.error(`Expected:`, obj1[key]);
            console.error(`Actual:`, obj2[key]);
            return false;
        }
    }

    return true;
}

/**
 * Simulate editor round-trip conversion
 * This mimics what the editor does: scene.v1 → editor state → scene.v1
 */
function simulateEditorRoundTrip(sceneData) {
    // Simulate editor internal state conversion
    const gridWidth = sceneData.grid.width;
    const gridHeight = sceneData.grid.height;
    const cellSize = sceneData.grid.cellSize;

    // Create grid arrays (like editor does)
    const grid = [];
    const horizontalEdges = [];
    const verticalEdges = [];

    // Initialize empty grids
    for (let y = 0; y < gridHeight; y++) {
        grid[y] = [];
        horizontalEdges[y] = [];
        verticalEdges[y] = [];
        for (let x = 0; x < gridWidth; x++) {
            grid[y][x] = 'empty';
            horizontalEdges[y][x] = false;
            verticalEdges[y][x] = false;
        }
    }

    // Load floor tiles
    if (sceneData.tiles && sceneData.tiles.floor) {
        sceneData.tiles.floor.forEach(([x, y]) => {
            if (y < gridHeight && x < gridWidth) {
                grid[y][x] = 'floor';
            }
        });
    }

    // Load edges
    if (sceneData.edges) {
        if (sceneData.edges.horizontal) {
            sceneData.edges.horizontal.forEach(([x, y]) => {
                if (y < gridHeight && x < gridWidth) {
                    horizontalEdges[y][x] = true;
                }
            });
        }
        if (sceneData.edges.vertical) {
            sceneData.edges.vertical.forEach(([x, y]) => {
                if (y < gridHeight && x < gridWidth) {
                    verticalEdges[y][x] = true;
                }
            });
        }
    }

    // Convert back to scene.v1 format (like editor export)
    const now = new Date().toISOString();
    const floorTiles = [];
    const horizontalEdgesList = [];
    const verticalEdgesList = [];

    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (grid[y][x] === 'floor') {
                floorTiles.push([x, y]);
            }
            if (horizontalEdges[y][x]) {
                horizontalEdgesList.push([x, y]);
            }
            if (verticalEdges[y][x]) {
                verticalEdgesList.push([x, y]);
            }
        }
    }

    // Preserve original meta fields while updating timestamps
    const meta = {
        schema: "scene.v1",
        version: "1.0",
        created: now,
        modified: now
    };

    // Copy over optional fields if they exist
    if (sceneData.meta.author) meta.author = sceneData.meta.author;

    return {
        meta: meta,
        grid: {
            width: gridWidth,
            height: gridHeight,
            cellSize: cellSize
        },
        tiles: {
            floor: floorTiles
        },
        edges: {
            horizontal: horizontalEdgesList,
            vertical: verticalEdgesList
        }
    };
}

/**
 * Run all tests
 */
function runTests() {
    console.log('🧪 Running Golden Round-Trip Tests for Scene.v1 Format\\n');

    let passed = 0;
    let failed = 0;

    // Test 1: Schema Validation
    console.log('Test 1: Schema Validation');
    const isValid = validate(testScene);
    if (isValid) {
        console.log('✅ Test scene validates against schema');
        passed++;
    } else {
        console.log('❌ Test scene fails schema validation:');
        console.log(validate.errors);
        failed++;
    }

    // Test 2: Round-Trip Guarantee
    console.log('\\nTest 2: Round-Trip Guarantee');
    try {
        const roundTripResult = simulateEditorRoundTrip(testScene);

        // Validate the round-trip result
        const isRoundTripValid = validate(roundTripResult);
        if (!isRoundTripValid) {
            console.log('❌ Round-trip result fails schema validation:');
            console.log(validate.errors);
            failed++;
        } else if (deepEqualIgnoreTimestamps(testScene, roundTripResult)) {
            console.log('✅ Round-trip produces identical data (ignoring timestamps)');
            passed++;
        } else {
            console.log('❌ Round-trip produces different data');
            failed++;
        }
    } catch (error) {
        console.log('❌ Round-trip test failed with error:', error.message);
        failed++;
    }

    // Test 3: Empty Scene Round-Trip
    console.log('\\nTest 3: Empty Scene Round-Trip');
    const emptyScene = {
        meta: {
            schema: "scene.v1",
            version: "1.0",
            created: "2025-09-24T13:00:00.000Z",
            modified: "2025-09-24T13:00:00.000Z"
        },
        grid: { width: 5, height: 5, cellSize: 20 },
        tiles: { floor: [] },
        edges: { horizontal: [], vertical: [] }
    };

    try {
        const emptyRoundTrip = simulateEditorRoundTrip(emptyScene);
        if (deepEqualIgnoreTimestamps(emptyScene, emptyRoundTrip)) {
            console.log('✅ Empty scene round-trip works correctly');
            passed++;
        } else {
            console.log('❌ Empty scene round-trip fails');
            failed++;
        }
    } catch (error) {
        console.log('❌ Empty scene round-trip failed:', error.message);
        failed++;
    }

    // Results
    console.log(`\\n📊 Test Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log('🎉 All golden round-trip tests passed!');
        console.log('✅ Scene.v1 format maintains data integrity');
        process.exit(0);
    } else {
        console.log('💥 Some tests failed - data integrity cannot be guaranteed');
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runTests();
}

module.exports = { testScene, simulateEditorRoundTrip, deepEqualIgnoreTimestamps };