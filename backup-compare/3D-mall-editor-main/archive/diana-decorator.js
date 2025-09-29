/**
 * Diana the Decorator Bot
 * AI Agent for color and material modifications in 3D environments
 */

class DianaDecorator {
    constructor(scene, componentRegistry) {
        this.scene = scene;
        this.registry = componentRegistry;
        this.name = "Diana the Decorator";
        this.role = "Color and material specialist";
        
        // Track all scene objects that can be modified
        this.editableObjects = new Map();
        this.changeHistory = [];
        
        this.initializeEditableObjects();
    }
    
    /**
     * Initialize tracking of editable objects in the scene
     */
    initializeEditableObjects() {
        console.log(`🎨 ${this.name}: Initializing editable object registry...`);
        
        // Find and register all editable objects in the scene
        this.scene.traverse((object) => {
            if (object.isMesh && object.userData.componentType) {
                const componentType = object.userData.componentType;
                const component = this.registry.components[componentType];
                
                if (component && component.agentEditable) {
                    this.editableObjects.set(object.uuid, {
                        object: object,
                        type: componentType,
                        originalMaterial: object.material.clone(),
                        permissions: component.agentEditable
                    });
                    
                    console.log(`🎨 Registered editable: ${componentType} (${object.uuid.substring(0, 8)})`);
                }
            }
        });
        
        console.log(`🎨 ${this.name}: Ready! Found ${this.editableObjects.size} editable objects.`);
    }
    
    /**
     * Change color of a specific object
     * @param {string} objectId - UUID of the object or semantic name (e.g., "floor", "north-wall")
     * @param {string} color - Hex color string (e.g., "#FF6B6B")
     */
    changeColor(objectId, color) {
        const target = this.findObject(objectId);
        if (!target) {
            console.warn(`🎨 ${this.name}: Object '${objectId}' not found or not editable.`);
            return false;
        }
        
        const editable = this.editableObjects.get(target.uuid);
        if (!editable.permissions.color) {
            console.warn(`🎨 ${this.name}: No permission to change color of ${editable.type}.`);
            return false;
        }
        
        // Record change for history
        const change = {
            timestamp: Date.now(),
            action: 'changeColor',
            objectId: target.uuid,
            objectType: editable.type,
            oldValue: `#${target.material.color.getHexString()}`,
            newValue: color
        };
        
        // Apply color change
        target.material.color.setHex(color.replace('#', '0x'));
        this.changeHistory.push(change);
        
        console.log(`🎨 ${this.name}: Changed ${editable.type} color from ${change.oldValue} to ${color}`);
        return true;
    }
    
    /**
     * Apply a color palette to multiple objects
     * @param {string} paletteName - Name of palette from registry
     * @param {Array<string>} targets - Array of object IDs to apply palette to
     */
    applyColorPalette(paletteName, targets = []) {
        const palette = this.registry.colorPalettes[paletteName];
        if (!palette) {
            console.warn(`🎨 ${this.name}: Palette '${paletteName}' not found.`);
            return false;
        }
        
        // If no targets specified, apply to all walls
        if (targets.length === 0) {
            targets = ['north-wall', 'south-wall', 'east-wall', 'west-wall'];
        }
        
        console.log(`🎨 ${this.name}: Applying '${paletteName}' palette to ${targets.length} objects...`);
        
        targets.forEach((targetId, index) => {
            const colorIndex = index % palette.length;
            this.changeColor(targetId, palette[colorIndex]);
        });
        
        return true;
    }
    
    /**
     * Adjust material properties (roughness, metalness, etc.)
     * @param {string} objectId - Target object ID
     * @param {Object} properties - Properties to change {roughness: 0.5, metalness: 0.2}
     */
    adjustMaterialProperties(objectId, properties) {
        const target = this.findObject(objectId);
        if (!target) return false;
        
        const editable = this.editableObjects.get(target.uuid);
        const changes = [];
        
        Object.entries(properties).forEach(([property, value]) => {
            if (editable.permissions[property]) {
                const oldValue = target.material[property];
                target.material[property] = value;
                
                changes.push({
                    timestamp: Date.now(),
                    action: 'adjustMaterial',
                    objectId: target.uuid,
                    objectType: editable.type,
                    property: property,
                    oldValue: oldValue,
                    newValue: value
                });
                
                console.log(`🎨 ${this.name}: Changed ${editable.type} ${property} from ${oldValue} to ${value}`);
            }
        });
        
        this.changeHistory.push(...changes);
        return changes.length > 0;
    }
    
    /**
     * Find object by ID or semantic name
     * @param {string} identifier - UUID or semantic name
     */
    findObject(identifier) {
        // First try direct UUID lookup
        for (let [uuid, data] of this.editableObjects) {
            if (uuid === identifier || uuid.startsWith(identifier)) {
                return data.object;
            }
        }
        
        // Then try semantic name lookup
        const semanticMap = {
            'floor': (obj) => obj.userData.componentType === 'floor',
            'ceiling': (obj) => obj.userData.componentType === 'ceiling',
            'north-wall': (obj) => obj.userData.componentType === 'wall' && obj.userData.compass === 'north',
            'south-wall': (obj) => obj.userData.componentType === 'wall' && obj.userData.compass === 'south',
            'east-wall': (obj) => obj.userData.componentType === 'wall' && obj.userData.compass === 'east',
            'west-wall': (obj) => obj.userData.componentType === 'wall' && obj.userData.compass === 'west',
            'reference-pole': (obj) => obj.userData.componentType === 'referencePole',
            'debug-ball': (obj) => obj.userData.componentType === 'debugBall'
        };
        
        if (semanticMap[identifier]) {
            for (let [uuid, data] of this.editableObjects) {
                if (semanticMap[identifier](data.object)) {
                    return data.object;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Reset object to original material
     * @param {string} objectId - Target object ID
     */
    resetToDefault(objectId) {
        const target = this.findObject(objectId);
        if (!target) return false;
        
        const editable = this.editableObjects.get(target.uuid);
        target.material.copy(editable.originalMaterial);
        
        this.changeHistory.push({
            timestamp: Date.now(),
            action: 'reset',
            objectId: target.uuid,
            objectType: editable.type
        });
        
        console.log(`🎨 ${this.name}: Reset ${editable.type} to default material.`);
        return true;
    }
    
    /**
     * Get available color palettes
     */
    getAvailablePalettes() {
        return Object.keys(this.registry.colorPalettes);
    }
    
    /**
     * Get editable objects summary
     */
    getEditableObjects() {
        const summary = [];
        for (let [uuid, data] of this.editableObjects) {
            summary.push({
                id: uuid.substring(0, 8),
                type: data.type,
                compass: data.object.userData.compass || null,
                permissions: Object.keys(data.permissions),
                currentColor: `#${data.object.material.color.getHexString()}`
            });
        }
        return summary;
    }
    
    /**
     * Get change history
     */
    getChangeHistory() {
        return this.changeHistory.slice(-20); // Last 20 changes
    }
    
    /**
     * Diana's AI personality responses
     */
    speak(message) {
        const responses = {
            greeting: [
                "🎨 Hi there! I'm Diana, your decorator bot. I love making spaces beautiful with the perfect colors!",
                "🎨 Hello! Diana here, ready to splash some personality into this space. What colors inspire you today?",
                "🎨 Hey! I'm Diana the Decorator. Think of me as your personal interior design AI - but just for colors!"
            ],
            success: [
                "🎨 Perfect! That color really brings out the character of the space.",
                "🎨 Beautiful choice! The room feels more alive already.",
                "🎨 Wonderful! I love how that color transforms the entire atmosphere."
            ],
            error: [
                "🎨 Oops! I can't modify that object. Let me check what I have permission to change.",
                "🎨 Hmm, something went wrong there. Let me try a different approach.",
                "🎨 That didn't work as expected. Don't worry, I'll figure it out!"
            ]
        };
        
        const category = responses[message] || ['🎨 ' + message];
        const response = category[Math.floor(Math.random() * category.length)];
        console.log(response);
        return response;
    }
}

// Export for use in main application
window.DianaDecorator = DianaDecorator;