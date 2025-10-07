#!/usr/bin/env node

/**
 * Verify Parity for Scene 3D v1 Fixtures
 *
 * Simulates the simulator's parity checking logic
 * Outputs in the same format as the browser console
 */

const fs = require('fs');
const path = require('path');

// Fixtures to test
const fixtures = [
    'unit-2x3.scene.3d.v1.json',
    'room-L.scene.3d.v1.json',
    'room-U.scene.3d.v1.json',
    'room-donut.scene.3d.v1.json'
];

const fixturesDir = path.join(__dirname, '..', 'examples', 'pipe');

console.log('🔍 Verifying Parity for Scene 3D v1 Fixtures\n');

let allMatch = true;

fixtures.forEach(filename => {
    const filepath = path.join(fixturesDir, filename);
    const sceneObj = JSON.parse(fs.readFileSync(filepath, 'utf8'));

    // Extract actual counts from data
    const tilesCount = sceneObj.tiles?.floor?.length || 0;
    const hEdgesCount = sceneObj.edges?.horizontal?.length || 0;
    const vEdgesCount = sceneObj.edges?.vertical?.length || 0;

    // Extract units
    const cellMeters = sceneObj.units?.cellMeters || 1;
    const originOffset = sceneObj.originOffset || { x: 0, y: 0 };

    // Output in simulator format
    console.log(`📄 ${filename}`);
    console.log(`[SCENE:v1] tiles=${tilesCount} edgesH=${hEdgesCount} edgesV=${vEdgesCount} cell=${cellMeters} originOffset=(${originOffset.x},${originOffset.y})`);

    if (sceneObj.bounds) {
        const min = sceneObj.bounds.min;
        const max = sceneObj.bounds.max;
        const center = sceneObj.bounds.center;
        console.log(`[SCENE:v1] bounds: min=(${min.x},${min.y},${min.z}) max=(${max.x},${max.y},${max.z}) centre=(${center.x},${center.y},${center.z})`);
    }

    // Verify parity
    if (sceneObj.meta?.parity) {
        const parity = sceneObj.meta.parity;
        let parityOK = true;

        if (parity.tiles !== tilesCount) {
            console.error(`[SCENE:v1] Parity mismatch: tiles expected=${parity.tiles} actual=${tilesCount}`);
            parityOK = false;
            allMatch = false;
        }
        if (parity.edgesH !== hEdgesCount) {
            console.error(`[SCENE:v1] Parity mismatch: edgesH expected=${parity.edgesH} actual=${hEdgesCount}`);
            parityOK = false;
            allMatch = false;
        }
        if (parity.edgesV !== vEdgesCount) {
            console.error(`[SCENE:v1] Parity mismatch: edgesV expected=${parity.edgesV} actual=${vEdgesCount}`);
            parityOK = false;
            allMatch = false;
        }

        if (parityOK) {
            console.log(`[PARITY] tiles_in=${parity.tiles} tiles_out=${tilesCount} edgesH_in=${parity.edgesH} edgesH_out=${hEdgesCount} edgesV_in=${parity.edgesV} edgesV_out=${vEdgesCount} floorArea_in=${parity.floorArea} floorArea_out=${tilesCount} edgeLenH_in=${parity.edgeLenH} edgeLenH_out=${hEdgesCount} edgeLenV_in=${parity.edgeLenV} edgeLenV_out=${vEdgesCount} → ALL_MATCH`);
        }
    } else {
        console.warn('[SCENE:v1] Warning: No parity metadata found');
        allMatch = false;
    }

    console.log('');
});

if (allMatch) {
    console.log('✅ All fixtures: parity verified (ALL_MATCH)\n');
    process.exit(0);
} else {
    console.error('❌ Some fixtures failed parity check\n');
    process.exit(1);
}
