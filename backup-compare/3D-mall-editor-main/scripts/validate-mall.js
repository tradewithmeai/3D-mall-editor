#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

// Get file path from args or use default
const filePath = process.argv[2] || 'floor-plans/mall/mall.json';
const schemaPath = 'docs/schema/mall.schema.json';

try {
    // Load schema
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(schemaContent);
    
    // Load mall JSON
    const mallContent = fs.readFileSync(filePath, 'utf8');
    const mallData = JSON.parse(mallContent);
    
    // Setup AJV with strict validation
    const ajv = new Ajv({ 
        allErrors: false, 
        strict: true 
    });
    
    // Validate
    const validate = ajv.compile(schema);
    const valid = validate(mallData);
    
    if (valid) {
        const { width, height, cellSize } = mallData.grid;
        console.log(`Mall validation passed: ${width}x${height}@${cellSize}`);
        process.exit(0);
    } else {
        const error = validate.errors[0];
        const jsonPointer = error.instancePath || '/';
        console.log(`Mall validation failed: ${jsonPointer} ${error.message}`);
        process.exit(1);
    }
    
} catch (error) {
    if (error.code === 'ENOENT') {
        console.log(`Mall validation failed: / file not found: ${error.path}`);
    } else {
        console.log(`Mall validation failed: / ${error.message}`);
    }
    process.exit(1);
}