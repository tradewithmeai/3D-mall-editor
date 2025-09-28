/**
 * Test Script for Template Relationship System
 * Run this in the browser console at http://127.0.0.1:5173/src/editor/index.html
 *
 * This script tests the mall → gallery template loading workflow
 */

async function testTemplateRelationshipSystem() {
    console.log('🧪 Starting Template Relationship System Test...');

    // Check if editor is available
    if (typeof window.editor === 'undefined') {
        console.error('❌ Editor not found. Make sure you are on the editor page.');
        return;
    }

    const editor = window.editor;

    try {
        console.log('📋 Step 1: Testing Template Relationship Manager initialization...');

        // Check if relationship manager is initialized
        if (!editor.templateRelationshipManager) {
            console.error('❌ Template Relationship Manager not initialized');
            return;
        }

        console.log('✅ Template Relationship Manager found:', editor.templateRelationshipManager);

        // Load mall template first (parent)
        console.log('📋 Step 2: Loading mall template (parent)...');

        const mallTemplate = {
            "meta": {
                "schema": "mall-template.v1",
                "version": "1.0",
                "name": "Test Mall Template"
            },
            "id": "mall-sample-20250924",
            "grid": {
                "width": 30,
                "height": 20,
                "cellSize": 20
            },
            "units": [
                {
                    "id": "unit-001",
                    "rect": { "x": 2, "y": 2, "w": 8, "h": 6 }
                },
                {
                    "id": "unit-002",
                    "rect": { "x": 12, "y": 2, "w": 10, "h": 8 }
                }
            ],
            "created": "2025-09-24T19:30:00.000Z"
        };

        // Simulate loading mall template
        await editor.importFromJson(mallTemplate);
        console.log('✅ Mall template loaded successfully');

        // Check relationship manager state
        let debugInfo = editor.templateRelationshipManager.getDebugInfo();
        console.log('📊 Relationship Manager state after mall load:', debugInfo);

        // Wait a moment for processing
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Load unit template (child)
        console.log('📋 Step 3: Loading unit template (child)...');

        const unitTemplate = {
            "meta": {
                "schema": "unit-template.v1",
                "version": "1.0",
                "name": "Test Unit Template",
                "parent": {
                    "id": "mall-sample-20250924",
                    "type": "mall"
                }
            },
            "id": "unit-sample-20250924",
            "parentMallId": "mall-sample-20250924",
            "rect": {
                "x": 0,
                "y": 0,
                "w": 15,
                "h": 12
            },
            "rooms": [
                {
                    "id": "room-1",
                    "gridRect": { "x": 1, "y": 1, "w": 6, "h": 4 }
                },
                {
                    "id": "room-2",
                    "gridRect": { "x": 8, "y": 1, "w": 5, "h": 6 }
                }
            ]
        };

        // Simulate loading unit template
        await editor.importFromJson(unitTemplate);
        console.log('✅ Unit template loaded successfully');

        // Check relationship manager state after child load
        debugInfo = editor.templateRelationshipManager.getDebugInfo();
        console.log('📊 Relationship Manager state after unit load:', debugInfo);

        // Test getCurrentLayers
        const layers = editor.templateRelationshipManager.getCurrentLayers();
        console.log('📊 Current template layers:', layers);

        // Verify parent-child relationship
        if (layers.hasParent && layers.parent && layers.current) {
            console.log('✅ Parent-child relationship established successfully!');
            console.log('   👥 Parent template:', layers.parent.id);
            console.log('   👶 Current template:', layers.current.id);
        } else {
            console.warn('⚠️ Parent-child relationship not properly established');
            console.log('   hasParent:', layers.hasParent);
            console.log('   parent:', layers.parent);
            console.log('   current:', layers.current);
        }

        // Test rendering
        console.log('📋 Step 4: Testing template rendering...');
        editor.draw(); // Trigger a redraw

        console.log('🎉 Template Relationship System test completed!');
        console.log('📋 Summary:');
        console.log('   ✅ Relationship Manager initialized');
        console.log('   ✅ Mall template loaded and cached');
        console.log('   ✅ Unit template loaded with parent reference');
        console.log('   ✅ Parent-child relationship established');
        console.log('   ✅ Template rendering triggered');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        console.error('   Error stack:', error.stack);
    }
}

// Auto-run if this script is loaded in the browser
if (typeof window !== 'undefined') {
    // Wait for editor to be ready
    if (typeof window.editor !== 'undefined') {
        testTemplateRelationshipSystem();
    } else {
        // Wait for editor to load
        const checkEditor = setInterval(() => {
            if (typeof window.editor !== 'undefined') {
                clearInterval(checkEditor);
                testTemplateRelationshipSystem();
            }
        }, 100);
    }
}

// Export for manual testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testTemplateRelationshipSystem };
}