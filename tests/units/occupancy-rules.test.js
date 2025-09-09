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
        return { success: false, code: error.status || 1, output: error.stdout?.toString() || '' };
    }
}

// Backup original active.json
const originalActivePath = 'floor-plans/active.json';
let originalContent = null;
if (fs.existsSync(originalActivePath)) {
    originalContent = fs.readFileSync(originalActivePath, 'utf8');
}

try {
    // Test 1: Valid occupied unit requires tenantId
    test('Valid occupied unit with tenantId passes', () => {
        const testData = {
            instances: [{ position: [0, 0, 0], type: 'Floor' }],
            units: [{
                id: 'unit-101',
                name: 'Test Unit',
                gridRect: { x: 0, y: 0, w: 1, h: 1 },
                entrance: { side: 'north', offset: 0 },
                type: 'retail',
                occupancy: { 
                    status: 'occupied', 
                    tenantId: 'tenant-abc123',
                    since: '2025-09-09'
                }
            }]
        };
        
        createTestFile('active.json', testData);
        const result = runValidator();
        assertEquals(result.success, true, 'Valid occupied unit should pass');
    });

    // Test 2: Valid vacant unit forbids tenantId
    test('Valid vacant unit without tenantId passes', () => {
        const testData = {
            instances: [{ position: [0, 0, 0], type: 'Floor' }],
            units: [{
                id: 'unit-102',
                name: 'Test Unit',
                gridRect: { x: 0, y: 0, w: 1, h: 1 },
                entrance: { side: 'south', offset: 0 },
                type: 'kiosk',
                occupancy: { status: 'vacant' }
            }]
        };
        
        createTestFile('active.json', testData);
        const result = runValidator();
        assertEquals(result.success, true, 'Valid vacant unit should pass');
    });

    // Test 3: Valid reserved unit with since but no tenantId
    test('Valid reserved unit with since passes', () => {
        const testData = {
            instances: [{ position: [0, 0, 0], type: 'Floor' }],
            units: [{
                id: 'unit-103',
                name: 'Test Unit',
                gridRect: { x: 0, y: 0, w: 1, h: 1 },
                entrance: { side: 'east', offset: 0 },
                type: 'service',
                occupancy: { 
                    status: 'reserved',
                    since: '2025-10-01'
                }
            }]
        };
        
        createTestFile('active.json', testData);
        const result = runValidator();
        assertEquals(result.success, true, 'Valid reserved unit should pass');
    });

    // Test 4: Invalid occupied without tenantId should fail
    test('Invalid occupied without tenantId fails', () => {
        const testData = {
            instances: [{ position: [0, 0, 0], type: 'Floor' }],
            units: [{
                id: 'unit-104',
                name: 'Test Unit',
                gridRect: { x: 0, y: 0, w: 1, h: 1 },
                entrance: { side: 'west', offset: 0 },
                occupancy: { status: 'occupied' }
            }]
        };
        
        createTestFile('active.json', testData);
        const result = runValidator();
        assertEquals(result.success, false, 'Occupied without tenantId should fail');
        assertEquals(result.code, 1, 'Exit code should be 1');
    });

    // Test 5: Invalid vacant with tenantId should fail
    test('Invalid vacant with tenantId fails', () => {
        const testData = {
            instances: [{ position: [0, 0, 0], type: 'Floor' }],
            units: [{
                id: 'unit-105',
                name: 'Test Unit',
                gridRect: { x: 0, y: 0, w: 1, h: 1 },
                entrance: { side: 'north', offset: 0 },
                occupancy: { 
                    status: 'vacant',
                    tenantId: 'tenant-should-not-be-here'
                }
            }]
        };
        
        createTestFile('active.json', testData);
        const result = runValidator();
        assertEquals(result.success, false, 'Vacant with tenantId should fail');
        assertEquals(result.code, 1, 'Exit code should be 1');
    });

    // Test 6: Invalid type value should fail
    test('Invalid type value fails', () => {
        const testData = {
            instances: [{ position: [0, 0, 0], type: 'Floor' }],
            units: [{
                id: 'unit-106',
                name: 'Test Unit',
                gridRect: { x: 0, y: 0, w: 1, h: 1 },
                entrance: { side: 'south', offset: 0 },
                type: 'invalid-type'
            }]
        };
        
        createTestFile('active.json', testData);
        const result = runValidator();
        assertEquals(result.success, false, 'Invalid type should fail');
        assertEquals(result.code, 1, 'Exit code should be 1');
    });

    // Test 7: Invalid tenant pattern should fail
    test('Invalid tenant pattern fails', () => {
        const testData = {
            instances: [{ position: [0, 0, 0], type: 'Floor' }],
            units: [{
                id: 'unit-107',
                name: 'Test Unit',
                gridRect: { x: 0, y: 0, w: 1, h: 1 },
                entrance: { side: 'east', offset: 0 },
                occupancy: { 
                    status: 'occupied',
                    tenantId: 'bad-pattern'
                }
            }]
        };
        
        createTestFile('active.json', testData);
        const result = runValidator();
        assertEquals(result.success, false, 'Invalid tenant pattern should fail');
        assertEquals(result.code, 1, 'Exit code should be 1');
    });

    // Test 8: Back-compat - units without type/occupancy should pass
    test('Back-compat units without type/occupancy pass', () => {
        const testData = {
            instances: [{ position: [0, 0, 0], type: 'Floor' }],
            units: [{
                id: 'unit-108',
                name: 'Legacy Unit',
                gridRect: { x: 0, y: 0, w: 1, h: 1 },
                entrance: { side: 'west', offset: 0 }
            }]
        };
        
        createTestFile('active.json', testData);
        const result = runValidator();
        assertEquals(result.success, true, 'Legacy units should pass');
    });

    console.log('\n✅ All occupancy rules tests passed!');

} finally {
    // Restore original active.json
    if (originalContent) {
        fs.writeFileSync(originalActivePath, originalContent);
    } else if (fs.existsSync(originalActivePath)) {
        fs.unlinkSync(originalActivePath);
    }
}