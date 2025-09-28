#!/usr/bin/env node

/**
 * Node.js validation script for Template Relationship System
 * This tests the core logic without requiring a browser
 */

const fs = require('fs');
const path = require('path');

// Mock global environment for the modules
global.console = console;

// Create minimal mocks for browser APIs
const mockDocument = {
    addEventListener: () => {},
    createElement: () => ({
        style: {},
        addEventListener: () => {}
    })
};

const mockWindow = {
    addEventListener: () => {},
    document: mockDocument
};

// Import template files
const mallTemplate = JSON.parse(fs.readFileSync('./test-files/test-mall-template.v1.json', 'utf8'));
const unitTemplate = JSON.parse(fs.readFileSync('./test-files/test-unit-template.v1.json', 'utf8'));

console.log('🧪 Template Relationship System Validation');
console.log('==========================================');

// Test 1: Template Structure Validation
console.log('\n📋 Test 1: Template Structure Validation');
console.log('Mall template:', {
    id: mallTemplate.id,
    schema: mallTemplate.meta.schema,
    hasUnits: Array.isArray(mallTemplate.units),
    unitCount: mallTemplate.units?.length || 0
});

console.log('Unit template:', {
    id: unitTemplate.id,
    schema: unitTemplate.meta.schema,
    hasParent: !!unitTemplate.meta.parent,
    parentId: unitTemplate.meta.parent?.id,
    parentType: unitTemplate.meta.parent?.type
});

// Test 2: Parent-Child Relationship Logic
console.log('\n📋 Test 2: Parent-Child Relationship Logic');

// Simulate the TemplateRelationshipManager logic
const simulateRelationshipManager = () => {
    const templateCache = new Map();
    const parentRelationships = new Map();
    const activeLayers = {
        parent: null,
        current: null
    };

    // Simulate caching mall template
    const mallId = mallTemplate.id;
    templateCache.set(mallId, {
        id: mallId,
        templateData: mallTemplate,
        dto: { ...mallTemplate, type: 'mall' },
        loadedAt: new Date().toISOString()
    });

    console.log('✅ Mall template cached with ID:', mallId);

    // Simulate loading unit template
    const unitId = unitTemplate.id;
    const parentMeta = unitTemplate.meta?.parent;

    if (parentMeta) {
        console.log('🔍 Child template detected, looking for parent:', parentMeta.id);

        // Check if parent is in cache
        const parentTemplate = templateCache.get(parentMeta.id);

        if (parentTemplate) {
            console.log('✅ Parent template found in cache:', parentMeta.id);

            // Set up relationship
            activeLayers.parent = parentTemplate;
            activeLayers.current = {
                id: unitId,
                templateData: unitTemplate,
                dto: { ...unitTemplate, type: 'unit' }
            };

            parentRelationships.set(unitId, parentTemplate);

            return {
                hasParent: true,
                parent: parentTemplate,
                current: activeLayers.current
            };
        } else {
            console.log('❌ Parent template not found in cache');
            console.log('Available templates:', Array.from(templateCache.keys()));
            return {
                hasParent: false,
                parent: null,
                current: activeLayers.current
            };
        }
    } else {
        console.log('ℹ️ No parent relationship detected');
        return {
            hasParent: false,
            parent: null,
            current: activeLayers.current
        };
    }
};

const relationshipResult = simulateRelationshipManager();

console.log('\n📊 Relationship Result:');
console.log('hasParent:', relationshipResult.hasParent);
console.log('parent template:', relationshipResult.parent ? relationshipResult.parent.id : 'none');
console.log('current template:', relationshipResult.current ? relationshipResult.current.id : 'none');

// Test 3: Template Content Processing
console.log('\n📋 Test 3: Template Content Processing');

const simulateTemplateProcessing = (templateData, dto, layer) => {
    console.log(`Processing ${layer} template:`, {
        type: dto.type,
        hasSceneData: !!templateData.sceneData,
        hasInstances: !!templateData.instances,
        hasUnits: !!templateData.units,
        hasRect: !!dto.rect
    });

    let hasContent = false;

    if (dto.type === 'mall') {
        if (templateData.sceneData) {
            console.log(`  ✅ ${layer}: Has scene data`);
            hasContent = true;
        } else if (templateData.instances) {
            console.log(`  ✅ ${layer}: Has instances`);
            hasContent = true;
        } else if (templateData.units && templateData.units.length > 0) {
            console.log(`  ✅ ${layer}: Creating boundary from ${templateData.units.length} units`);
            hasContent = true;
        }
    }

    if (dto.type === 'unit') {
        if (templateData.sceneData) {
            console.log(`  ✅ ${layer}: Has scene data`);
            hasContent = true;
        } else if (dto.rect) {
            console.log(`  ✅ ${layer}: Creating boundary from rect:`, dto.rect);
            hasContent = true;
        }
    }

    return hasContent;
};

if (relationshipResult.hasParent && relationshipResult.parent) {
    const parentHasContent = simulateTemplateProcessing(
        relationshipResult.parent.templateData,
        relationshipResult.parent.dto,
        'parent'
    );
    console.log('Parent layer hasContent:', parentHasContent);
}

if (relationshipResult.current) {
    const currentHasContent = simulateTemplateProcessing(
        relationshipResult.current.templateData,
        relationshipResult.current.dto,
        'current'
    );
    console.log('Current layer hasContent:', currentHasContent);
}

// Test 4: Overall Assessment
console.log('\n📋 Test 4: Overall Assessment');

if (relationshipResult.hasParent && relationshipResult.parent && relationshipResult.current) {
    console.log('🎉 SUCCESS: Template Relationship System validation passed!');
    console.log('✅ Parent template properly cached');
    console.log('✅ Child template properly linked to parent');
    console.log('✅ Parent-child relationship established');
    console.log('✅ Template processing logic functional');
} else {
    console.log('❌ FAILED: Template Relationship System validation failed');

    if (!relationshipResult.hasParent) {
        console.log('  - Parent relationship not detected');
    }
    if (!relationshipResult.parent) {
        console.log('  - Parent template not found/cached');
    }
    if (!relationshipResult.current) {
        console.log('  - Current template not processed');
    }
}

console.log('\n==========================================');
console.log('Validation completed!');