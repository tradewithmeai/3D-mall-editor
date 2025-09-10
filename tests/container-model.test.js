#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let totalAssertions = 0;
let passedAssertions = 0;

function runAssertion(description, assertion) {
    totalAssertions++;
    try {
        assertion();
        passedAssertions++;
        console.log(`✓ ${description}`);
    } catch (error) {
        console.error(`✗ ${description}: ${error.message}`);
    }
}

try {
    // Load mall.json
    const mallPath = 'floor-plans/mall/mall.json';
    const mallData = JSON.parse(fs.readFileSync(mallPath, 'utf8'));
    console.log('Loaded mall.json');
    
    // Load units-index.json
    const unitsIndexPath = 'floor-plans/mall/units-index.json';
    const unitsIndex = JSON.parse(fs.readFileSync(unitsIndexPath, 'utf8'));
    console.log('Loaded units-index.json');
    
    // Assert units-index has length >= 1
    runAssertion('units-index has at least 1 unit', () => {
        assert(unitsIndex.units && unitsIndex.units.length >= 1, 
               `Expected at least 1 unit, found ${unitsIndex.units ? unitsIndex.units.length : 0}`);
    });
    
    // Get mall grid dimensions
    const mallWidth = mallData.grid.width;
    const mallHeight = mallData.grid.height;
    
    // For each unit in the index, load and validate bounds
    unitsIndex.units.forEach(unitRef => {
        const unitPath = path.join('floor-plans/units', `${unitRef.id}.json`);
        
        runAssertion(`${unitRef.id} file exists`, () => {
            assert(fs.existsSync(unitPath), `Unit file not found: ${unitPath}`);
        });
        
        if (fs.existsSync(unitPath)) {
            const unitData = JSON.parse(fs.readFileSync(unitPath, 'utf8'));
            
            runAssertion(`${unitRef.id} has valid rect`, () => {
                assert(unitData.rect, 'Unit missing rect property');
                assert(typeof unitData.rect.x === 'number', 'rect.x must be a number');
                assert(typeof unitData.rect.y === 'number', 'rect.y must be a number');
                assert(typeof unitData.rect.w === 'number', 'rect.w must be a number');
                assert(typeof unitData.rect.h === 'number', 'rect.h must be a number');
            });
            
            runAssertion(`${unitRef.id} rect fits inside mall grid (${mallWidth}x${mallHeight})`, () => {
                const rect = unitData.rect;
                assert(rect.x >= 0, `rect.x (${rect.x}) must be >= 0`);
                assert(rect.y >= 0, `rect.y (${rect.y}) must be >= 0`);
                assert(rect.x + rect.w <= mallWidth, 
                       `rect right edge (${rect.x + rect.w}) exceeds mall width (${mallWidth})`);
                assert(rect.y + rect.h <= mallHeight, 
                       `rect bottom edge (${rect.y + rect.h}) exceeds mall height (${mallHeight})`);
            });
            
            runAssertion(`${unitRef.id} has minimum size 2x2`, () => {
                const rect = unitData.rect;
                assert(rect.w >= 2, `rect.w (${rect.w}) must be >= 2`);
                assert(rect.h >= 2, `rect.h (${rect.h}) must be >= 2`);
            });
        }
    });
    
    // Print summary
    console.log(`\nTest Summary: ${passedAssertions}/${totalAssertions} assertions passed`);
    
    if (passedAssertions === totalAssertions) {
        console.log('All container model tests passed!');
        process.exit(0);
    } else {
        console.log('Some container model tests failed');
        process.exit(1);
    }
    
} catch (error) {
    console.error('Test execution error:', error.message);
    console.log(`Test Summary: ${passedAssertions}/${totalAssertions} assertions passed`);
    process.exit(1);
}