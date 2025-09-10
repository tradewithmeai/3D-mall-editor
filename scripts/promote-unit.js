#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get unit ID from command line
const unitId = process.argv[2];

if (!unitId) {
    console.error('Usage: node scripts/promote-unit.js unit-XXX');
    process.exit(1);
}

const sourceFile = `floor-plans/units_generated/${unitId}.json`;
const destFile = `floor-plans/units/${unitId}.json`;

try {
    // Check if source file exists
    if (!fs.existsSync(sourceFile)) {
        console.error(`Source file not found: ${sourceFile}`);
        process.exit(1);
    }
    
    // Check if destination already exists
    if (fs.existsSync(destFile)) {
        console.error(`Destination already exists: ${destFile}`);
        process.exit(1);
    }
    
    // Ensure destination directory exists
    const destDir = path.dirname(destFile);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Copy file
    fs.copyFileSync(sourceFile, destFile);
    
    // Validate the copied file
    try {
        execSync(`node scripts/validate-units.js "${destFile}"`, { 
            stdio: 'pipe' 
        });
    } catch (validationError) {
        // Remove the invalid file
        fs.unlinkSync(destFile);
        console.error(`Validation failed, removed ${destFile}`);
        process.exit(1);
    }
    
    console.log(`Promoted: ${unitId}`);
    process.exit(0);
    
} catch (error) {
    console.error(`Promotion failed: ${error.message}`);
    process.exit(1);
}