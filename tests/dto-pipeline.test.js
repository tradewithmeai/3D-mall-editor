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
    },

    // GridRect normalization test: rooms with gridRect should normalize to rect
    unitWithGridRects: {
        meta: { schema: 'unit-template.v1', version: '1.0' },
        id: 'test-unit-gridrects',
        rect: { x: 10, y: 10, w: 12, h: 8 },
        rooms: [
            {
                id: 'room-1',
                gridRect: { x: 12, y: 12, w: 4, h: 3 }
            },
            {
                id: 'room-2',
                gridRect: { x: 16, y: 12, w: 3, h: 4 }
            }
        ]
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

    // Test 5: GridRect normalization
    try {
        console.log('Test 5: GridRect Normalization');

        // Schema detection should work for unit with gridRects
        const gridRectKind = detect(fixtures.unitWithGridRects);
        console.assert(gridRectKind === 'unit-template.v1', `Expected 'unit-template.v1', got '${gridRectKind}'`);

        // DTO normalization should convert gridRect to rect
        const { dto: gridRectDto } = loadTemplate(fixtures.unitWithGridRects);
        console.assert(gridRectDto.type === 'unit', `Expected dto.type='unit', got '${gridRectDto.type}'`);
        console.assert(Array.isArray(gridRectDto.rooms) && gridRectDto.rooms.length === 2, 'Should have 2 rooms');

        // Check first room normalization
        const room1 = gridRectDto.rooms[0];
        console.assert(room1.id === 'room-1', `Expected room1.id='room-1', got '${room1.id}'`);
        console.assert(room1.rect && !room1.gridRect, 'Room1 should have rect, not gridRect');
        console.assert(room1.rect.x === 12 && room1.rect.y === 12, 'Room1 rect position should match gridRect');
        console.assert(room1.rect.w === 4 && room1.rect.h === 3, 'Room1 rect size should match gridRect');

        // Check second room normalization
        const room2 = gridRectDto.rooms[1];
        console.assert(room2.id === 'room-2', `Expected room2.id='room-2', got '${room2.id}'`);
        console.assert(room2.rect && !room2.gridRect, 'Room2 should have rect, not gridRect');
        console.assert(room2.rect.x === 16 && room2.rect.y === 12, 'Room2 rect position should match gridRect');
        console.assert(room2.rect.w === 3 && room2.rect.h === 4, 'Room2 rect size should match gridRect');

        console.log('✅ GridRect normalization passed\n');
        passed++;
    } catch (error) {
        console.log('❌ GridRect normalization failed:', error.message, '\n');
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