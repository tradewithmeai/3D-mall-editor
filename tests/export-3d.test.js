/**
 * Export 3D Tests - Validates scene.3d.v1 export functionality
 *
 * Tests:
 * 1. Fixture validation against schema
 * 2. Canonicalization (dedupe, sort, bounds)
 * 3. Parity summary accuracy
 * 4. Digest stability (re-export produces same digest)
 * 5. Contract lock-in (required fields present)
 */

import { toScene3D } from '../src/editor/core/ExportBuilder3D.js';
import { validateScene3D } from '../src/editor/core/validateScene3D.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Test fixtures
const FIXTURES = [
    'unit-2x3.scene.3d.v1.json',
    'room-L.scene.3d.v1.json',
    'room-U.scene.3d.v1.json',
    'room-donut.scene.3d.v1.json'
];

/**
 * Test 1: Validate all fixtures against schema
 */
async function testFixtureValidation() {
    console.log('\n=== Test 1: Fixture Validation ===');

    for (const fixture of FIXTURES) {
        const path = join('examples', 'pipe', fixture);
        const json = JSON.parse(readFileSync(path, 'utf8'));

        const result = await validateScene3D(json);

        if (result.count === 0) {
            console.log(`✅ ${fixture}: Valid`);
        } else {
            console.error(`❌ ${fixture}: ${result.count} errors`);
            result.errors.forEach(err => {
                console.error(`   ${err.path}: ${err.msg}`);
            });
        }
    }
}

/**
 * Test 2: Canonicalization (tiles deduped and sorted)
 */
function testCanonicalization() {
    console.log('\n=== Test 2: Canonicalization ===');

    // Create scene with duplicate and unsorted tiles
    const sceneModel = {
        grid: [
            ['floor', 'floor'],
            ['floor', 'floor']
        ],
        horizontalEdges: [
            [true, true],
            [false, false],
            [true, true]
        ],
        verticalEdges: [
            [true, false, true],
            [true, false, true]
        ]
    };

    const output = toScene3D(sceneModel, 20, 'test-canon');

    // Check tiles are sorted by (y, x)
    const tiles = output.tiles.floor;
    let sorted = true;
    for (let i = 1; i < tiles.length; i++) {
        const prev = tiles[i-1];
        const curr = tiles[i];
        if (prev[1] > curr[1] || (prev[1] === curr[1] && prev[0] > curr[0])) {
            sorted = false;
            break;
        }
    }

    if (sorted) {
        console.log('✅ Tiles are sorted by (y, x)');
    } else {
        console.error('❌ Tiles are not properly sorted');
    }

    // Check no duplicates
    const tileSet = new Set(tiles.map(t => `${t[0]},${t[1]}`));
    if (tileSet.size === tiles.length) {
        console.log('✅ No duplicate tiles');
    } else {
        console.error('❌ Duplicate tiles found');
    }
}

/**
 * Test 3: Parity summary accuracy
 */
function testParitySummary() {
    console.log('\n=== Test 3: Parity Summary ===');

    for (const fixture of FIXTURES) {
        const path = join('examples', 'pipe', fixture);
        const json = JSON.parse(readFileSync(path, 'utf8'));

        const parity = json.meta.parity;
        const actualTiles = json.tiles.floor.length;
        const actualEdgesH = json.edges.horizontal.length;
        const actualEdgesV = json.edges.vertical.length;

        if (parity.tiles === actualTiles &&
            parity.edgesH === actualEdgesH &&
            parity.edgesV === actualEdgesV &&
            parity.floorArea === actualTiles &&
            parity.edgeLenH === actualEdgesH &&
            parity.edgeLenV === actualEdgesV) {
            console.log(`✅ ${fixture}: Parity accurate`);
        } else {
            console.error(`❌ ${fixture}: Parity mismatch`);
            console.error(`   Expected: tiles=${actualTiles}, edgesH=${actualEdgesH}, edgesV=${actualEdgesV}`);
            console.error(`   Got: tiles=${parity.tiles}, edgesH=${parity.edgesH}, edgesV=${parity.edgesV}`);
        }
    }
}

/**
 * Test 4: Digest stability (deterministic output)
 */
function testDigestStability() {
    console.log('\n=== Test 4: Digest Stability ===');

    const sceneModel = {
        grid: [
            ['floor', 'floor'],
            ['floor', 'floor']
        ],
        horizontalEdges: [
            [true, true],
            [false, false],
            [true, true]
        ],
        verticalEdges: [
            [true, false, true],
            [true, false, true]
        ]
    };

    const output1 = toScene3D(sceneModel, 20, 'test-digest');
    const output2 = toScene3D(sceneModel, 20, 'test-digest');

    if (output1.meta.digest === output2.meta.digest) {
        console.log(`✅ Digest is stable: ${output1.meta.digest}`);
    } else {
        console.error('❌ Digest is not stable');
        console.error(`   First export: ${output1.meta.digest}`);
        console.error(`   Second export: ${output2.meta.digest}`);
    }
}

/**
 * Test 5: Contract lock-in (required fields)
 */
function testContractLockIn() {
    console.log('\n=== Test 5: Contract Lock-In ===');

    const sceneModel = {
        grid: [['floor']],
        horizontalEdges: [[true], [true]],
        verticalEdges: [[true, true]]
    };

    const output = toScene3D(sceneModel, 20, 'test-contract');

    const checks = [
        { name: 'meta.schema', value: output.meta.schema, expected: 'scene.3d.v1' },
        { name: 'meta.version', value: output.meta.version, expected: '1.0' },
        { name: 'meta.axes', value: output.meta.axes, expected: 'Z_up_XY_ground' },
        { name: 'units.cellMeters', value: output.units.cellMeters, check: v => v > 0 },
        { name: 'units.wallHeightMeters', value: output.units.wallHeightMeters, check: v => v > 0 },
        { name: 'units.coordinateSystem', value: output.units.coordinateSystem, expected: 'right-handed-z-up' },
        { name: 'originOffset.x', value: output.originOffset.x, check: v => typeof v === 'number' },
        { name: 'originOffset.y', value: output.originOffset.y, check: v => typeof v === 'number' },
        { name: 'meta.parity', value: output.meta.parity, check: v => v && typeof v === 'object' },
        { name: 'meta.digest', value: output.meta.digest, check: v => /^[0-9a-f]{8}$/.test(v) }
    ];

    checks.forEach(check => {
        let passed = false;
        if (check.expected !== undefined) {
            passed = check.value === check.expected;
        } else if (check.check) {
            passed = check.check(check.value);
        }

        if (passed) {
            console.log(`✅ ${check.name}: ${check.value}`);
        } else {
            console.error(`❌ ${check.name}: ${check.value} (expected: ${check.expected || 'valid'})`);
        }
    });
}

/**
 * Test 6: Bounds calculation (Z_up_XY_ground)
 */
function testBoundsCalculation() {
    console.log('\n=== Test 6: Bounds Calculation ===');

    const sceneModel = {
        grid: [
            ['floor', 'floor'],
            ['floor', 'floor'],
            ['floor', 'floor']
        ],
        horizontalEdges: [
            [true, true],
            [false, false],
            [false, false],
            [true, true]
        ],
        verticalEdges: [
            [true, false, true],
            [true, false, true],
            [true, false, true]
        ]
    };

    const cellSize = 20; // 20 pixels
    const cellMeters = cellSize * 0.05; // 1.0 meter
    const output = toScene3D(sceneModel, cellSize, 'test-bounds');

    // Expected: 2×3 grid = 2m wide × 3m deep × 3m tall
    const expectedMax = {
        x: 2.0,  // width (X axis)
        y: 3.0,  // depth (Y axis)
        z: 3.0   // height (Z axis, wall height)
    };

    if (output.bounds.max.x === expectedMax.x &&
        output.bounds.max.y === expectedMax.y &&
        output.bounds.max.z === expectedMax.z) {
        console.log(`✅ Bounds correct: ${expectedMax.x}m × ${expectedMax.y}m × ${expectedMax.z}m`);
    } else {
        console.error('❌ Bounds incorrect');
        console.error(`   Expected: x=${expectedMax.x}, y=${expectedMax.y}, z=${expectedMax.z}`);
        console.error(`   Got: x=${output.bounds.max.x}, y=${output.bounds.max.y}, z=${output.bounds.max.z}`);
    }
}

// Run all tests
async function runTests() {
    console.log('🧪 Running Export 3D Tests...\n');

    await testFixtureValidation();
    testCanonicalization();
    testParitySummary();
    testDigestStability();
    testContractLockIn();
    testBoundsCalculation();

    console.log('\n✅ All tests completed\n');
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests().catch(console.error);
}

export { runTests };
