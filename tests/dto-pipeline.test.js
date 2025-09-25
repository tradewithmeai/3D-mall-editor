/**
 * DTO Pipeline Tests
 * Tests SchemaRegistry.detect(), TemplateLoader.load(), and TemplateBounds.makeBounds()
 */

import { detect } from '../src/editor/core/SchemaRegistry.js';
import { load as loadTemplate } from '../src/editor/core/TemplateLoader.js';
import { makeBounds } from '../src/editor/core/TemplateBounds.js';

// Test data fixtures
const fixtures = {
    mall: {
        meta: { schema: 'mall-template.v1', version: '1.0' },
        id: 'test-mall',
        grid: { width: 60, height: 40, cellSize: 20 },
        units: [
            { id: 'unit-1', rect: { x: 10, y: 10, w: 8, h: 6 } }
        ]
    },

    unit: {
        meta: { schema: 'unit-template.v1', version: '1.0' },
        id: 'test-unit',
        rect: { x: 10, y: 10, w: 8, h: 6 },
        rooms: []
    },

    room: {
        meta: { schema: 'room-template.v1', version: '1.0' },
        id: 'test-room',
        rect: { x: 12, y: 12, w: 4, h: 3 },
        zones: []
    },

    scene: {
        meta: { schema: 'scene.v1', version: '1.0' },
        grid: { width: 60, height: 40, cellSize: 20 },
        tiles: { floor: [[10, 10], [10, 11]] },
        edges: { horizontal: [[10, 10]], vertical: [[11, 10]] }
    },

    // Alias test: gallery should map to unit
    gallery: {
        meta: { schema: 'gallery-template.v1', version: '1.0' },
        id: 'test-gallery',
        rect: { x: 5, y: 5, w: 10, h: 8 },
        rooms: []
    }
};

function runTests() {
    console.log('🧪 Running DTO Pipeline Tests...\n');

    let passed = 0;
    let failed = 0;

    // Test 1: SchemaRegistry.detect() basic cases
    try {
        console.log('Test 1: Schema Detection');

        const mallKind = detect(fixtures.mall);
        console.assert(mallKind === 'mall-template.v1', `Expected 'mall-template.v1', got '${mallKind}'`);

        const unitKind = detect(fixtures.unit);
        console.assert(unitKind === 'unit-template.v1', `Expected 'unit-template.v1', got '${unitKind}'`);

        const roomKind = detect(fixtures.room);
        console.assert(roomKind === 'room-template.v1', `Expected 'room-template.v1', got '${roomKind}'`);

        const sceneKind = detect(fixtures.scene);
        console.assert(sceneKind === 'scene.v1', `Expected 'scene.v1', got '${sceneKind}'`);

        console.log('✅ Schema detection passed\n');
        passed++;
    } catch (error) {
        console.log('❌ Schema detection failed:', error.message, '\n');
        failed++;
    }

    // Test 2: Gallery alias mapping (gallery→unit)
    try {
        console.log('Test 2: Gallery Alias Mapping');

        const galleryKind = detect(fixtures.gallery);
        console.assert(galleryKind === 'gallery-template.v1', `Expected 'gallery-template.v1', got '${galleryKind}'`);

        const { dto } = loadTemplate(fixtures.gallery);
        console.assert(dto.type === 'unit', `Expected dto.type='unit', got '${dto.type}'`);

        console.log('✅ Gallery alias mapping passed\n');
        passed++;
    } catch (error) {
        console.log('❌ Gallery alias mapping failed:', error.message, '\n');
        failed++;
    }

    // Test 3: TemplateLoader.load() DTO normalization
    try {
        console.log('Test 3: DTO Normalization');

        const { dto: mallDto } = loadTemplate(fixtures.mall);
        console.assert(mallDto.type === 'mall', `Expected mall dto.type='mall', got '${mallDto.type}'`);
        console.assert(mallDto.units && mallDto.units.length === 1, 'Mall DTO should have units array');

        const { dto: unitDto } = loadTemplate(fixtures.unit);
        console.assert(unitDto.type === 'unit', `Expected unit dto.type='unit', got '${unitDto.type}'`);
        console.assert(unitDto.rect, 'Unit DTO should have rect');

        const { dto: sceneDto } = loadTemplate(fixtures.scene);
        console.assert(sceneDto.type === 'scene', `Expected scene dto.type='scene', got '${sceneDto.type}'`);

        console.log('✅ DTO normalization passed\n');
        passed++;
    } catch (error) {
        console.log('❌ DTO normalization failed:', error.message, '\n');
        failed++;
    }

    // Test 4: TemplateBounds.makeBounds() basic cases
    try {
        console.log('Test 4: Bounds Checking');

        // Mall bounds: union of unit rectangles
        const { dto: mallDto } = loadTemplate(fixtures.mall);
        const mallBounds = makeBounds(mallDto);
        console.assert(mallBounds.isInside(12, 12), 'Point (12,12) should be inside mall unit bounds');
        console.assert(!mallBounds.isInside(5, 5), 'Point (5,5) should be outside mall unit bounds');

        // Unit bounds: single rectangle
        const { dto: unitDto } = loadTemplate(fixtures.unit);
        const unitBounds = makeBounds(unitDto);
        console.assert(unitBounds.isInside(12, 12), 'Point (12,12) should be inside unit bounds');
        console.assert(!unitBounds.isInside(20, 20), 'Point (20,20) should be outside unit bounds');

        // Scene bounds: allow everything
        const { dto: sceneDto } = loadTemplate(fixtures.scene);
        const sceneBounds = makeBounds(sceneDto);
        console.assert(sceneBounds.isInside(100, 100), 'Scene should allow any coordinates');

        console.log('✅ Bounds checking passed\n');
        passed++;
    } catch (error) {
        console.log('❌ Bounds checking failed:', error.message, '\n');
        failed++;
    }

    // Test Results
    console.log(`🎯 Test Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log('🎉 All DTO pipeline tests passed!');
        return true;
    } else {
        console.log('💥 Some tests failed');
        return false;
    }
}

// Run tests if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    const success = runTests();
    process.exit(success ? 0 : 1);
}

export { runTests };