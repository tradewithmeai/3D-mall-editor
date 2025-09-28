#!/usr/bin/env node

/**
 * Test script to verify template hierarchy consistency
 * Tests the complete 4-level hierarchy: Mall → Gallery → Room → Object
 */

import { readFileSync } from 'fs';
import { TemplateRelationshipManager } from './src/editor/core/TemplateRelationshipManager.js';
import { load as loadTemplate } from './src/editor/core/TemplateLoader.js';

// Test hierarchy consistency
async function testHierarchyConsistency() {
    console.log('🧪 Testing Template Hierarchy Consistency...\n');

    const relationshipManager = new TemplateRelationshipManager();

    try {
        // Load all templates in the hierarchy
        const templates = {
            mall: JSON.parse(readFileSync('test-files/test-mall-template.v1.json', 'utf8')),
            unit: JSON.parse(readFileSync('test-files/test-unit-template.v1.json', 'utf8')),
            room: JSON.parse(readFileSync('test-files/test-room-template.v1.json', 'utf8')),
            object: JSON.parse(readFileSync('test-object-template.v1.json', 'utf8'))
        };

        console.log('📁 Loaded Templates:');
        console.log(`  Mall:   ${templates.mall.id}`);
        console.log(`  Unit:   ${templates.unit.id} (parent: ${templates.unit.meta?.parent?.id})`);
        console.log(`  Room:   ${templates.room.id} (parent: ${templates.room.meta?.parent?.id})`);
        console.log(`  Object: ${templates.object.id} (parent: ${templates.object.meta?.parent?.id})\n`);

        // Test 1: Template normalization consistency
        console.log('🔍 Test 1: Template Normalization Consistency');
        for (const [type, templateData] of Object.entries(templates)) {
            const { dto, mode } = loadTemplate(templateData);
            console.log(`  ✅ ${type}: normalized to ${dto.type} (${mode})`);

            // Verify standardized DTO structure for child templates
            if (['unit', 'room', 'object'].includes(dto.type)) {
                if (!dto.children || !Array.isArray(dto.children)) {
                    throw new Error(`${type}: missing standardized children array`);
                }
                if (!dto.parentId) {
                    console.log(`  ⚠️  ${type}: no parentId found (may be OK for root templates)`);
                }
                console.log(`    - children: ${dto.children.length} items`);
                console.log(`    - parentId: ${dto.parentId || 'none'}`);
            }
        }
        console.log();

        // Test 2: Template relationship loading
        console.log('🔍 Test 2: Template Relationship Loading');

        // Cache all templates first (simulating loading order)
        const dtos = {};
        for (const [type, templateData] of Object.entries(templates)) {
            const { dto } = loadTemplate(templateData);
            dtos[type] = dto;
            relationshipManager.cacheTemplate(dto.id, templateData, dto);
            console.log(`  📦 Cached: ${dto.id} (${dto.type})`);
        }
        console.log();

        // Test loading object template (deepest child) - should load full hierarchy
        console.log('🔍 Test 3: Full Hierarchy Resolution');
        const { dto: objectDto } = loadTemplate(templates.object);
        const relationshipResult = await relationshipManager.loadTemplate(templates.object, objectDto);

        console.log(`  📊 Hierarchy Result:`);
        console.log(`    - Levels: ${relationshipResult.hierarchy.length}`);
        console.log(`    - Has Parent: ${relationshipResult.hasParent}`);
        console.log(`    - Stack: ${relationshipResult.hierarchy.map(t => `${t.dto.type}:${t.id}`).join(' → ')}`);

        // Verify complete hierarchy
        if (relationshipResult.hierarchy.length !== 4) {
            throw new Error(`Expected 4-level hierarchy, got ${relationshipResult.hierarchy.length}`);
        }

        const expectedTypes = ['mall', 'unit', 'room', 'object'];
        relationshipResult.hierarchy.forEach((template, index) => {
            if (template.dto.type !== expectedTypes[index]) {
                throw new Error(`Expected ${expectedTypes[index]} at level ${index}, got ${template.dto.type}`);
            }
        });

        console.log('  ✅ Full 4-level hierarchy correctly resolved');
        console.log();

        // Test 4: Validate standardized structures
        console.log('🔍 Test 4: Standardized Structure Validation');
        const childTemplates = ['unit', 'room', 'object'];

        for (const type of childTemplates) {
            const dto = dtos[type];

            // Check standardized properties
            const requiredProps = ['type', 'id', 'rect', 'children'];
            for (const prop of requiredProps) {
                if (!(prop in dto)) {
                    throw new Error(`${type} DTO missing required property: ${prop}`);
                }
            }

            // Check rect format
            const rect = dto.rect;
            const requiredRectProps = ['x', 'y', 'w', 'h'];
            for (const prop of requiredRectProps) {
                if (typeof rect[prop] !== 'number') {
                    throw new Error(`${type} rect.${prop} is not a number`);
                }
            }

            console.log(`  ✅ ${type}: standardized structure valid`);
        }
        console.log();

        // Test 5: Debug info verification
        console.log('🔍 Test 5: Relationship Manager Debug Info');
        const debugInfo = relationshipManager.getDebugInfo();
        console.log(`  📦 Cache Size: ${debugInfo.cacheSize}`);
        console.log(`  🏷️  Cached Templates: ${debugInfo.cachedTemplates.join(', ')}`);
        console.log(`  🔗 Active Layers: parent=${debugInfo.activeLayers.parent}, current=${debugInfo.activeLayers.current}`);
        console.log();

        console.log('🎉 All Tests Passed! Template hierarchy consistency verified.\n');

        return {
            success: true,
            hierarchyLevels: relationshipResult.hierarchy.length,
            templatesProcessed: Object.keys(templates).length,
            relationshipManager: debugInfo
        };

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        console.error(error.stack);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run the test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testHierarchyConsistency()
        .then(result => {
            if (result.success) {
                console.log('✅ Template hierarchy consistency test completed successfully');
                process.exit(0);
            } else {
                console.error('❌ Template hierarchy consistency test failed');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Test execution failed:', error);
            process.exit(1);
        });
}

export { testHierarchyConsistency };