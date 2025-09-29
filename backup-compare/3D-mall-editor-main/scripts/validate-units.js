#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Import AJV - handle both v8 and older versions
let Ajv;
try {
  Ajv = require('ajv').default || require('ajv');
} catch (e) {
  console.error('Error: AJV not found. Please install ajv: npm install ajv');
  process.exit(1);
}

function validateUnits() {
  try {
    // Read the active floorplan
    const floorplanPath = path.join(process.cwd(), 'floor-plans', 'active.json');
    
    if (!fs.existsSync(floorplanPath)) {
      console.log('No active.json found - validation skipped');
      return true;
    }
    
    const floorplanData = JSON.parse(fs.readFileSync(floorplanPath, 'utf8'));
    
    // If no units key, validation passes
    if (!floorplanData.units) {
      console.log('No units property found - validation passed');
      return true;
    }
    
    // Read the schema
    const schemaPath = path.join(process.cwd(), 'docs', 'schema', 'mall-units.schema.json');
    
    if (!fs.existsSync(schemaPath)) {
      console.error('Error: Schema file not found at docs/schema/mall-units.schema.json');
      return false;
    }
    
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    
    // Validate units against schema
    const ajv = new Ajv({ formats: true });
    // Add date format manually since AJV built-in might not be available
    ajv.addFormat('date', /^\d{4}-\d{2}-\d{2}$/);
    const validate = ajv.compile(schema);
    
    // Create validation data with just the units property
    const validationData = { units: floorplanData.units };
    const valid = validate(validationData);
    
    if (valid) {
      console.log(`Units validation passed (${floorplanData.units.length} units)`);
      return true;
    } else {
      console.error('Units validation failed:');
      validate.errors.forEach(error => {
        console.error(`  - ${error.instancePath}: ${error.message}`);
      });
      return false;
    }
    
  } catch (error) {
    console.error('Error during validation:', error.message);
    return false;
  }
}

// Run validation and exit with appropriate code
const success = validateUnits();
process.exit(success ? 0 : 1);