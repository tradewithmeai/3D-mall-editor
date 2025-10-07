#!/usr/bin/env node

/**
 * Validate Scene 3D v1 Fixtures
 *
 * Validates all fixture files in examples/pipe/ against the scene.3d.v1 schema
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Initialize AJV
const ajv = new Ajv({ strict: false });
addFormats(ajv);

// Load schema
const schemaPath = path.join(__dirname, '..', 'schemas', 'scene.3d.v1.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const validate = ajv.compile(schema);

// Test fixtures
const fixturesDir = path.join(__dirname, '..', 'examples', 'pipe');
const fixtures = [
    'unit-2x3.scene.3d.v1.json',
    'room-L.scene.3d.v1.json',
    'room-U.scene.3d.v1.json',
    'room-donut.scene.3d.v1.json'
];

console.log('🧪 Validating Scene 3D v1 Fixtures\n');

let allValid = true;
let totalTests = 0;
let passedTests = 0;

fixtures.forEach(filename => {
    const filepath = path.join(fixturesDir, filename);

    if (!fs.existsSync(filepath)) {
        console.error(`❌ ${filename}: File not found`);
        allValid = false;
        totalTests++;
        return;
    }

    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    const valid = validate(data);
    totalTests++;

    if (valid) {
        console.log(`✅ ${filename}: Valid`);
        passedTests++;

        // Additional checks
        const checks = [];

        // Check meta fields
        if (data.meta.schema === 'scene.3d.v1') checks.push('schema=scene.3d.v1');
        if (data.meta.version === '1.0') checks.push('version=1.0');
        if (data.meta.axes === 'Z_up_XY_ground') checks.push('axes=Z_up_XY_ground');

        // Check units
        if (data.units.cellMeters > 0) checks.push('cellMeters>0');
        if (data.units.wallHeightMeters > 0) checks.push('wallHeightMeters>0');

        // Check parity
        if (data.meta.parity &&
            data.meta.parity.tiles === data.tiles.floor.length &&
            data.meta.parity.edgesH === data.edges.horizontal.length &&
            data.meta.parity.edgesV === data.edges.vertical.length) {
            checks.push('parity-match');
        }

        // Check digest
        if (data.meta.digest && /^[0-9a-f]{8}$/.test(data.meta.digest)) {
            checks.push(`digest=${data.meta.digest}`);
        }

        // Check originOffset
        if (typeof data.originOffset.x === 'number' && typeof data.originOffset.y === 'number') {
            checks.push('originOffset.x/y');
        }

        console.log(`   Checks: ${checks.join(', ')}\n`);
    } else {
        console.error(`❌ ${filename}: Invalid`);
        console.error(`   Errors: ${JSON.stringify(validate.errors, null, 2)}\n`);
        allValid = false;
    }
});

console.log(`\n📊 Summary: ${passedTests}/${totalTests} fixtures valid`);

if (allValid) {
    console.log('✅ All fixtures passed validation\n');
    process.exit(0);
} else {
    console.error('❌ Some fixtures failed validation\n');
    process.exit(1);
}
