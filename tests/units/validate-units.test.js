#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Simple test framework
function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
}

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
    } catch (error) {
        console.error(`❌ ${name}: ${error.message}`);
        process.exit(1);
    }
}

// Test utilities
function createTestFile(filename, content) {
    const testPath = path.join('floor-plans', filename);
    fs.writeFileSync(testPath, JSON.stringify(content, null, 2));
    return testPath;
}

function runValidator() {
    try {
        execSync('node scripts/validate-units.js', { stdio: 'pipe' });
        return { success: true, code: 0 };
    } catch (error) {
        return { success: false, code: error.status || 1 };
    }
}

// Backup original active.json
const originalActivePath = 'floor-plans/active.json';
let originalContent = null;
if (fs.existsSync(originalActivePath)) {
    originalContent = fs.readFileSync(originalActivePath, 'utf8');
}

try {
    // Test 1: No-units plan should pass
    test('No units plan loads successfully', () => {
        const testData = {
            instances: [
                { position: [0, 0, 0], type: 'Floor' },
                { position: [2, 0, 0], type: 'Floor' }
            ]
        };
        
        createTestFile('active.json', testData);
        const result = runValidator();
        assertEquals(result.success, true, 'Validator should pass for no-units plan');
    });

    // Test 2: Valid-units plan should pass
    test('Valid units plan loads successfully', () => {
        const testData = {
            instances: [
                { position: [0, 0, 0], type: 'Floor' },
                { position: [2, 0, 0], type: 'Floor' }
            ],
            units: [
                {
                    id: 'unit-101',
                    name: 'Test Unit 1',
                    gridRect: { x: 0, y: 0, w: 2, h: 1 },
                    entrance: { side: 'north', offset: 0 }
                },
                {
                    id: 'unit-102',
                    name: 'Test Unit 2',
                    gridRect: { x: 1, y: 1, w: 1, h: 1 },
                    entrance: { side: 'east', offset: 0 }
                }
            ]
        };
        
        createTestFile('active.json', testData);
        const result = runValidator();
        assertEquals(result.success, true, 'Validator should pass for valid-units plan');
    });

    // Test 3: Invalid-units plan should fail
    test('Invalid units plan fails validation', () => {
        const testData = {
            instances: [
                { position: [0, 0, 0], type: 'Floor' }
            ],
            units: [
                {
                    id: 'invalid-id',  // Invalid pattern
                    name: 'Test Unit',
                    gridRect: { x: 0, y: 0, w: -1, h: 1 }, // Invalid negative width
                    entrance: { side: 'invalid', offset: -1 } // Invalid side and negative offset
                }
            ]
        };
        
        createTestFile('active.json', testData);
        const result = runValidator();
        assertEquals(result.success, false, 'Validator should fail for invalid-units plan');
        assertEquals(result.code, 1, 'Exit code should be 1 for invalid units');
    });

    console.log('\n✅ All tests passed!');

} finally {
    // Restore original active.json
    if (originalContent) {
        fs.writeFileSync(originalActivePath, originalContent);
    } else if (fs.existsSync(originalActivePath)) {
        fs.unlinkSync(originalActivePath);
    }
}