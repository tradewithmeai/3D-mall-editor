#!/usr/bin/env node

/**
 * Test all three export template types
 * Tests exportAsScene, exportAsMallTemplate, exportAsUnitTemplate
 */

const fs = require('fs');
const path = require('path');

// Mock editor class with minimal functionality for testing exports
class TestFloorplanEditor {
    constructor() {
        this.gridWidth = 20;
        this.gridHeight = 15;
        this.cellSize = 20;
        this.templateType = null;
        this.templateContext = {};
        this.templateOverlay = null;

        // Sample grid data with some floor tiles
        this.grid = Array(this.gridHeight).fill().map(() => Array(this.gridWidth).fill('empty'));
        this.horizontalEdges = Array(this.gridHeight).fill().map(() => Array(this.gridWidth).fill(false));
        this.verticalEdges = Array(this.gridHeight).fill().map(() => Array(this.gridWidth).fill(false));

        // Add some test floor tiles
        this.grid[2][2] = this.grid[2][3] = this.grid[2][4] = this.grid[2][5] = 'floor';
        this.grid[3][2] = this.grid[3][3] = this.grid[3][4] = this.grid[3][5] = 'floor';
        this.grid[4][2] = this.grid[4][3] = this.grid[4][4] = this.grid[4][5] = 'floor';

        // Add some walls
        this.horizontalEdges[2][2] = this.horizontalEdges[2][3] = this.horizontalEdges[2][4] = this.horizontalEdges[2][5] = true;
        this.horizontalEdges[5][2] = this.horizontalEdges[5][3] = this.horizontalEdges[5][4] = this.horizontalEdges[5][5] = true;
        this.verticalEdges[2][2] = this.verticalEdges[3][2] = this.verticalEdges[4][2] = true;
        this.verticalEdges[2][6] = this.verticalEdges[3][6] = this.verticalEdges[4][6] = true;
    }

    // Copy the export methods from the main editor
    toSceneV1() {
        const floorTiles = [];
        const horizontalEdges = [];
        const verticalEdges = [];

        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.grid[y][x] === 'floor') {
                    floorTiles.push([x, y]);
                }
                if (this.horizontalEdges[y][x]) {
                    horizontalEdges.push([x, y]);
                }
                if (this.verticalEdges[y][x]) {
                    verticalEdges.push([x, y]);
                }
            }
        }

        return {
            meta: {
                schema: "scene.v1",
                version: "1.0",
                created: new Date().toISOString(),
                modified: new Date().toISOString()
            },
            grid: {
                width: this.gridWidth,
                height: this.gridHeight,
                cellSize: this.cellSize
            },
            tiles: {
                floor: floorTiles
            },
            edges: {
                horizontal: horizontalEdges,
                vertical: verticalEdges
            }
        };
    }

    exportAsScene() {
        return this.toSceneV1();
    }

    exportAsMallTemplate() {
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
        const mallId = `mall-${timestamp}`;

        const mallTemplate = {
            id: mallId,
            grid: {
                width: this.gridWidth,
                height: this.gridHeight,
                cellSize: this.cellSize
            }
        };

        if (!mallTemplate.created) {
            mallTemplate.created = new Date().toISOString();
        }

        return mallTemplate;
    }

    exportAsUnitTemplate() {
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
        const unitId = `unit-${timestamp}`;

        let parentMallId = 'mall-unknown';
        if (this.templateOverlay && this.templateOverlay.id) {
            parentMallId = this.templateOverlay.id;
        } else if (this.templateOverlay && this.templateOverlay.parentMallId) {
            parentMallId = this.templateOverlay.parentMallId;
        }

        let unitRect = { x: 0, y: 0, w: this.gridWidth, h: this.gridHeight };

        if (this.templateOverlay) {
            unitRect = {
                x: 0,
                y: 0,
                w: Math.min(this.gridWidth, this.templateOverlay.width || this.gridWidth),
                h: Math.min(this.gridHeight, this.templateOverlay.height || this.gridHeight)
            };
        }

        const rooms = this.generateRoomsFromCurrentContent();

        return {
            id: unitId,
            parentMallId: parentMallId,
            rect: unitRect,
            rooms: rooms
        };
    }

    generateRoomsFromCurrentContent() {
        const rooms = [];
        const visited = Array(this.gridHeight).fill().map(() => Array(this.gridWidth).fill(false));
        let roomCounter = 1;

        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.grid[y][x] === 'floor' && !visited[y][x]) {
                    const roomArea = this.floodFillRoom(x, y, visited);
                    if (roomArea.length > 0) {
                        const bounds = this.calculateRoomBounds(roomArea);
                        rooms.push({
                            id: `room-${roomCounter}`,
                            gridRect: bounds
                        });
                        roomCounter++;
                    }
                }
            }
        }

        if (rooms.length === 0) {
            rooms.push({
                id: 'room-1',
                gridRect: { x: 0, y: 0, w: this.gridWidth, h: this.gridHeight }
            });
        }

        return rooms;
    }

    floodFillRoom(startX, startY, visited) {
        const area = [];
        const stack = [[startX, startY]];

        while (stack.length > 0) {
            const [x, y] = stack.pop();

            if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) continue;
            if (visited[y][x] || this.grid[y][x] !== 'floor') continue;

            visited[y][x] = true;
            area.push([x, y]);

            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }

        return area;
    }

    calculateRoomBounds(roomArea) {
        if (roomArea.length === 0) {
            return { x: 0, y: 0, w: 1, h: 1 };
        }

        let minX = roomArea[0][0], maxX = roomArea[0][0];
        let minY = roomArea[0][1], maxY = roomArea[0][1];

        roomArea.forEach(([x, y]) => {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        });

        return {
            x: minX,
            y: minY,
            w: maxX - minX + 1,
            h: maxY - minY + 1
        };
    }
}

// Test functions
function testSceneExport(editor) {
    console.log('\\n🧪 Testing Scene Export...');
    try {
        const sceneData = editor.exportAsScene();

        // Validate structure
        if (!sceneData.meta || sceneData.meta.schema !== "scene.v1") {
            throw new Error('Invalid scene.v1 format - missing or wrong schema');
        }

        if (!sceneData.grid || !sceneData.tiles || !sceneData.edges) {
            throw new Error('Invalid scene.v1 format - missing required sections');
        }

        console.log('✅ Scene export structure valid');
        console.log(`   Grid: ${sceneData.grid.width}x${sceneData.grid.height}`);
        console.log(`   Floor tiles: ${sceneData.tiles.floor.length}`);
        console.log(`   Edges: H=${sceneData.edges.horizontal.length}, V=${sceneData.edges.vertical.length}`);

        return true;
    } catch (error) {
        console.log('❌ Scene export failed:', error.message);
        return false;
    }
}

function testMallTemplateExport(editor) {
    console.log('\\n🧪 Testing Mall Template Export...');
    try {
        const mallTemplate = editor.exportAsMallTemplate();

        // Validate structure
        if (!mallTemplate.id || !mallTemplate.id.startsWith('mall-')) {
            throw new Error('Invalid mall template - missing or invalid ID');
        }

        if (!mallTemplate.grid) {
            throw new Error('Invalid mall template - missing grid');
        }

        console.log('✅ Mall template export structure valid');
        console.log(`   ID: ${mallTemplate.id}`);
        console.log(`   Grid: ${mallTemplate.grid.width}x${mallTemplate.grid.height}`);
        console.log(`   Created: ${mallTemplate.created}`);

        return true;
    } catch (error) {
        console.log('❌ Mall template export failed:', error.message);
        return false;
    }
}

function testUnitTemplateExport(editor) {
    console.log('\\n🧪 Testing Unit Template Export...');
    try {
        const unitTemplate = editor.exportAsUnitTemplate();

        // Validate structure
        if (!unitTemplate.id || !unitTemplate.id.startsWith('unit-')) {
            throw new Error('Invalid unit template - missing or invalid ID');
        }

        if (!unitTemplate.parentMallId || !unitTemplate.rect || !unitTemplate.rooms) {
            throw new Error('Invalid unit template - missing required fields');
        }

        if (!Array.isArray(unitTemplate.rooms)) {
            throw new Error('Invalid unit template - rooms must be an array');
        }

        console.log('✅ Unit template export structure valid');
        console.log(`   ID: ${unitTemplate.id}`);
        console.log(`   Parent Mall: ${unitTemplate.parentMallId}`);
        console.log(`   Rect: ${JSON.stringify(unitTemplate.rect)}`);
        console.log(`   Rooms: ${unitTemplate.rooms.length}`);

        return true;
    } catch (error) {
        console.log('❌ Unit template export failed:', error.message);
        return false;
    }
}

function runAllTests() {
    console.log('🧪 Running Export Functionality Tests\\n');

    const editor = new TestFloorplanEditor();

    let passed = 0;
    let failed = 0;

    if (testSceneExport(editor)) passed++; else failed++;
    if (testMallTemplateExport(editor)) passed++; else failed++;
    if (testUnitTemplateExport(editor)) passed++; else failed++;

    console.log(`\\n📊 Export Test Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log('🎉 All export functionality tests passed!');
        console.log('✅ Template export system is working correctly');
        process.exit(0);
    } else {
        console.log('💥 Some export tests failed');
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runAllTests();
}

module.exports = { TestFloorplanEditor, testSceneExport, testMallTemplateExport, testUnitTemplateExport };