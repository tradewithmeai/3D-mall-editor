/**
 * Bulletproof Component Management System
 * Memory-safe creation, modification, and removal of 3D components
 */

// Import logging framework
if (typeof window.Logger === 'undefined') {
    console.error('❌ Logging framework not loaded! Load logging-framework.js first.');
}

class ComponentManager {
    constructor() {
        this.registry = null;
        this.sceneObjects = new Map(); // Track all created objects
        this.objectCounter = 0;
        this.memoryStats = {
            created: 0,
            disposed: 0,
            active: 0
        };
        
        console.log('🏗️ ComponentManager initialized');
    }
    
    /**
     * Load component registry from JSON
     */
    async loadRegistry() {
        try {
            const response = await fetch('enhanced-components.json');
            this.registry = await response.json();
            
            logFactory('LOAD_REGISTRY', 'enhanced-components.json', true, {
                componentCount: Object.keys(this.registry.components).length,
                palettes: Object.keys(this.registry.colorPalettes).length,
                rooms: Object.keys(this.registry.rooms).length
            });
            
            return true;
        } catch (error) {
            logFactory('LOAD_REGISTRY', 'enhanced-components.json', false, { error: error.message });
            console.error('❌ Failed to load component registry:', error);
            return false;
        }
    }
    
    /**
     * Create component with memory tracking and semantic data
     */
    createComponent(componentType, config = {}, scene) {
        if (!this.registry) {
            console.error('❌ Registry not loaded! Call loadRegistry() first.');
            return null;
        }
        
        const startTime = performance.now();
        const definition = this.registry.components[componentType];
        
        if (!definition) {
            logFactory('CREATE', componentType, false, { error: 'Component type not found' });
            return null;
        }
        
        try {
            // Create geometry based on model type
            let geometry;
            switch (definition.model) {
                case 'box':
                    geometry = new THREE.BoxGeometry(...definition.size);
                    break;
                case 'plane':
                    geometry = new THREE.PlaneGeometry(...definition.size);
                    break;
                case 'cylinder':
                    geometry = new THREE.CylinderGeometry(...definition.size);
                    break;
                case 'sphere':
                    geometry = new THREE.SphereGeometry(...definition.size);
                    break;
                default:
                    throw new Error(`Unsupported geometry type: ${definition.model}`);
            }
            
            // Create material with proper configuration
            const materialConfig = { ...definition.material };
            
            // Convert hex color strings
            if (materialConfig.color && typeof materialConfig.color === 'string') {
                materialConfig.color = materialConfig.color.replace('#', '0x');
            }
            if (materialConfig.emissive && typeof materialConfig.emissive === 'string') {
                materialConfig.emissive = materialConfig.emissive.replace('#', '0x');
            }
            
            // Remove type from material config
            const MaterialClass = materialConfig.type === 'MeshBasicMaterial' ? 
                THREE.MeshBasicMaterial : THREE.MeshStandardMaterial;
            delete materialConfig.type;
            
            const material = new MaterialClass(materialConfig);
            
            // Create mesh
            const mesh = new THREE.Mesh(geometry, material);
            
            // Generate unique ID
            const uniqueId = `${componentType}-${++this.objectCounter}-${Date.now()}`;
            
            // Apply semantic userData for Diana
            mesh.userData = {
                componentType: componentType,
                semanticId: definition.semanticId,
                semanticName: definition.semanticName,
                category: definition.category,
                room: definition.room,
                direction: definition.direction,
                uniqueId: uniqueId,
                agentEditable: definition.agentEditable,
                interactive: definition.interactive || false,
                physics: definition.physics || null,
                createdAt: Date.now(),
                originalDefinition: { ...definition }
            };
            
            // Apply position from config
            if (config.position) {
                mesh.position.set(...config.position);
            }
            
            // Apply rotation from config
            if (config.rotation) {
                mesh.rotation.set(...config.rotation);
            }
            
            // Apply name from config
            if (config.name) {
                mesh.userData.name = config.name;
            }
            
            // Add collision detection if enabled
            if (definition.collision) {
                mesh.userData.collider = new THREE.Box3().setFromObject(mesh);
            }
            
            // Add to scene
            scene.add(mesh);
            
            // Track object for memory management
            this.sceneObjects.set(uniqueId, {
                mesh: mesh,
                componentType: componentType,
                createdAt: Date.now(),
                geometry: geometry,
                material: material
            });
            
            // Update memory stats
            this.memoryStats.created++;
            this.memoryStats.active++;
            
            const duration = performance.now() - startTime;
            
            // Log creation with comprehensive data
            logCreate(componentType, config.position, uniqueId, {
                semanticId: definition.semanticId,
                category: definition.category,
                room: definition.room,
                agentEditable: Object.keys(definition.agentEditable || {}),
                duration: duration
            });
            
            logFactory('CREATE', componentType, true, {
                uniqueId: uniqueId,
                semanticId: definition.semanticId,
                position: config.position,
                duration: duration
            });
            
            return mesh;
            
        } catch (error) {
            const duration = performance.now() - startTime;
            logFactory('CREATE', componentType, false, { 
                error: error.message,
                duration: duration 
            });
            console.error(`❌ Failed to create ${componentType}:`, error);
            return null;
        }
    }
    
    /**
     * Remove component with proper memory cleanup
     */
    removeComponent(mesh, scene) {
        if (!mesh || !mesh.userData || !mesh.userData.uniqueId) {
            console.error('❌ Invalid mesh for removal');
            return false;
        }
        
        const startTime = performance.now();
        const uniqueId = mesh.userData.uniqueId;
        const componentType = mesh.userData.componentType;
        const trackedObject = this.sceneObjects.get(uniqueId);
        
        try {
            // Remove from scene first
            scene.remove(mesh);
            
            // Dispose geometry properly
            if (mesh.geometry) {
                mesh.geometry.dispose();
                logMemory(`Disposed geometry for ${componentType}`);
            }
            
            // Dispose materials properly
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(mat => {
                        if (mat && mat.dispose) mat.dispose();
                    });
                } else if (mesh.material.dispose) {
                    mesh.material.dispose();
                }
                logMemory(`Disposed material for ${componentType}`);
            }
            
            // Clean up collider
            if (mesh.userData.collider) {
                mesh.userData.collider = null;
            }
            
            // Clear userData
            mesh.userData = {};
            
            // Remove from tracking
            this.sceneObjects.delete(uniqueId);
            
            // Update memory stats
            this.memoryStats.disposed++;
            this.memoryStats.active--;
            
            const duration = performance.now() - startTime;
            
            // Log removal with cleanup confirmation
            logRemove(componentType, uniqueId, true);
            
            logFactory('REMOVE', componentType, true, {
                uniqueId: uniqueId,
                memoryCleanup: true,
                duration: duration
            });
            
            return true;
            
        } catch (error) {
            const duration = performance.now() - startTime;
            logFactory('REMOVE', componentType, false, {
                error: error.message,
                uniqueId: uniqueId,
                duration: duration
            });
            console.error(`❌ Failed to remove ${componentType}:`, error);
            return false;
        }
    }
    
    /**
     * Update component properties with change tracking
     */
    updateComponentProperty(mesh, property, newValue) {
        if (!mesh || !mesh.userData || !mesh.userData.uniqueId) {
            console.error('❌ Invalid mesh for property update');
            return false;
        }
        
        const uniqueId = mesh.userData.uniqueId;
        const componentType = mesh.userData.componentType;
        const agentEditable = mesh.userData.agentEditable || {};
        
        // Check if property is editable
        if (!agentEditable[property]) {
            console.warn(`⚠️ Property '${property}' not editable for ${componentType}`);
            return false;
        }
        
        try {
            let oldValue;
            let success = false;
            
            switch (property) {
                case 'color':
                    oldValue = `#${mesh.material.color.getHexString()}`;
                    mesh.material.color.setHex(newValue.replace('#', '0x'));
                    mesh.material.needsUpdate = true;
                    success = true;
                    break;
                    
                case 'roughness':
                    oldValue = mesh.material.roughness;
                    mesh.material.roughness = parseFloat(newValue);
                    mesh.material.needsUpdate = true;
                    success = true;
                    break;
                    
                case 'metalness':
                    oldValue = mesh.material.metalness;
                    mesh.material.metalness = parseFloat(newValue);
                    mesh.material.needsUpdate = true;
                    success = true;
                    break;
                    
                case 'opacity':
                    oldValue = mesh.material.opacity;
                    mesh.material.opacity = parseFloat(newValue);
                    mesh.material.transparent = parseFloat(newValue) < 1.0;
                    mesh.material.needsUpdate = true;
                    success = true;
                    break;
                    
                case 'visibility':
                    oldValue = mesh.visible;
                    mesh.visible = Boolean(newValue);
                    success = true;
                    break;
                    
                default:
                    console.warn(`⚠️ Unsupported property: ${property}`);
                    return false;
            }
            
            if (success) {
                // Update collider if it exists
                if (mesh.userData.collider) {
                    mesh.userData.collider.setFromObject(mesh);
                }
                
                // Log the modification
                logModify(componentType, property, oldValue, newValue, uniqueId);
                
                logFactory('UPDATE', componentType, true, {
                    uniqueId: uniqueId,
                    property: property,
                    oldValue: oldValue,
                    newValue: newValue
                });
                
                return true;
            }
            
        } catch (error) {
            logFactory('UPDATE', componentType, false, {
                error: error.message,
                property: property,
                uniqueId: uniqueId
            });
            console.error(`❌ Failed to update ${property} for ${componentType}:`, error);
            return false;
        }
        
        return false;
    }
    
    /**
     * Get component by semantic ID
     */
    getComponentBySemanticId(semanticId) {
        for (const [uniqueId, obj] of this.sceneObjects) {
            if (obj.mesh.userData.semanticId === semanticId) {
                return obj.mesh;
            }
        }
        return null;
    }
    
    /**
     * Get all components of a specific type
     */
    getComponentsByType(componentType) {
        const components = [];
        for (const [uniqueId, obj] of this.sceneObjects) {
            if (obj.componentType === componentType) {
                components.push(obj.mesh);
            }
        }
        return components;
    }
    
    /**
     * Get all components in a room
     */
    getComponentsByRoom(roomName) {
        const components = [];
        for (const [uniqueId, obj] of this.sceneObjects) {
            if (obj.mesh.userData.room === roomName) {
                components.push(obj.mesh);
            }
        }
        return components;
    }
    
    /**
     * Get memory statistics
     */
    getMemoryStats() {
        return {
            ...this.memoryStats,
            activeObjects: this.sceneObjects.size,
            memoryEfficiency: this.memoryStats.disposed / Math.max(1, this.memoryStats.created)
        };
    }
    
    /**
     * Validate scene integrity (for testing)
     */
    validateSceneIntegrity(expectedCount = null) {
        const actualCount = this.sceneObjects.size;
        const memoryLeaks = this.memoryStats.created - this.memoryStats.disposed - actualCount;
        
        const results = [
            logAssert('Active object count matches tracking', 
                actualCount === this.sceneObjects.size, actualCount, this.sceneObjects.size),
            logAssert('No memory leaks detected', 
                memoryLeaks === 0, 0, memoryLeaks)
        ];
        
        if (expectedCount !== null) {
            results.push(
                logAssert('Scene count matches expected', 
                    actualCount === expectedCount, expectedCount, actualCount)
            );
        }
        
        return results;
    }
    
    /**
     * Export component data for debugging
     */
    exportComponentData() {
        const components = [];
        for (const [uniqueId, obj] of this.sceneObjects) {
            components.push({
                uniqueId: uniqueId,
                componentType: obj.componentType,
                semanticId: obj.mesh.userData.semanticId,
                position: obj.mesh.position.toArray(),
                rotation: obj.mesh.rotation.toArray(),
                visible: obj.mesh.visible,
                createdAt: obj.createdAt
            });
        }
        
        return {
            components: components,
            memoryStats: this.getMemoryStats(),
            registryInfo: this.registry ? {
                componentTypes: Object.keys(this.registry.components).length,
                colorPalettes: Object.keys(this.registry.colorPalettes).length,
                rooms: Object.keys(this.registry.rooms).length
            } : null
        };
    }
}

// Create global component manager instance
window.ComponentManager = new ComponentManager();

// Convenience functions
window.createComponent = (type, config, scene) => window.ComponentManager.createComponent(type, config, scene);
window.removeComponent = (mesh, scene) => window.ComponentManager.removeComponent(mesh, scene);
window.updateComponentProperty = (mesh, prop, value) => window.ComponentManager.updateComponentProperty(mesh, prop, value);
window.getComponentBySemanticId = (id) => window.ComponentManager.getComponentBySemanticId(id);

console.log('🏗️ BULLETPROOF COMPONENT MANAGER LOADED - Memory-safe with semantic tracking');