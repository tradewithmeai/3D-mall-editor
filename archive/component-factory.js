/**
 * Component Factory System
 * Loads JSON configurations and creates 3D objects with agent-editable metadata
 */

class ComponentFactory {
    constructor() {
        this.registry = null;
        this.roomLayout = null;
    }
    
    /**
     * Load component registry and room layout
     */
    async loadConfigurations() {
        try {
            // Load components registry
            const componentsResponse = await fetch('components.json');
            this.registry = await componentsResponse.json();
            
            // Load room layout
            const layoutResponse = await fetch('room-layout.json');
            this.roomLayout = await layoutResponse.json();
            
            console.log('🏗️ ComponentFactory: Configurations loaded successfully');
            return true;
        } catch (error) {
            console.error('🏗️ ComponentFactory: Failed to load configurations:', error);
            return false;
        }
    }
    
    /**
     * Create a Three.js material from JSON configuration
     * @param {Object} materialConfig - Material configuration from JSON
     */
    createMaterial(materialConfig) {
        const materialTypes = {
            'MeshStandardMaterial': THREE.MeshStandardMaterial,
            'MeshBasicMaterial': THREE.MeshBasicMaterial,
            'MeshPhongMaterial': THREE.MeshPhongMaterial
        };
        
        const MaterialClass = materialTypes[materialConfig.type] || THREE.MeshStandardMaterial;
        const params = { ...materialConfig };
        delete params.type; // Remove type as it's not a material parameter
        
        // Convert hex color strings to proper format
        if (params.color && typeof params.color === 'string') {
            params.color = params.color.replace('#', '0x');
        }
        if (params.emissive && typeof params.emissive === 'string') {
            params.emissive = params.emissive.replace('#', '0x');
        }
        
        return new MaterialClass(params);
    }
    
    /**
     * Create a Three.js geometry from JSON configuration
     * @param {string} type - Geometry type (plane, box, sphere, cylinder)
     * @param {Array} dimensions - Geometry dimensions
     */
    createGeometry(type, dimensions) {
        switch (type) {
            case 'plane':
                return new THREE.PlaneGeometry(...dimensions);
            case 'box':
                return new THREE.BoxGeometry(...dimensions);
            case 'sphere':
                return new THREE.SphereGeometry(...dimensions);
            case 'cylinder':
                return new THREE.CylinderGeometry(...dimensions);
            default:
                console.warn(`🏗️ Unknown geometry type: ${type}`);
                return new THREE.BoxGeometry(1, 1, 1);
        }
    }
    
    /**
     * Create a component from registry and configuration
     * @param {string} componentType - Type from components.json
     * @param {Object} config - Instance configuration (position, rotation, etc.)
     * @param {THREE.Scene} scene - Scene to add the component to
     */
    createComponent(componentType, config, scene) {
        const componentDef = this.registry.components[componentType];
        if (!componentDef) {
            console.error(`🏗️ Component type '${componentType}' not found in registry`);
            return null;
        }
        
        // Create geometry
        const geometry = this.createGeometry(
            componentDef.model,
            config.dimensions || componentDef.size
        );
        
        // Create material (use default material if not specified in config)
        const materialConfig = config.material || componentDef.material;
        const material = this.createMaterial(materialConfig);
        
        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);
        
        // Apply transforms
        if (config.position) {
            mesh.position.set(...config.position);
        }
        
        if (config.rotation || componentDef.rotation) {
            const rotation = config.rotation || componentDef.rotation;
            mesh.rotation.set(...rotation);
        }
        
        // Apply properties
        if (componentDef.properties) {
            Object.entries(componentDef.properties).forEach(([prop, value]) => {
                mesh[prop] = value;
            });
        }
        
        if (config.properties) {
            Object.entries(config.properties).forEach(([prop, value]) => {
                mesh[prop] = value;
            });
        }
        
        // Add metadata for AI agents
        mesh.userData = {
            componentType: componentType,
            compass: config.compass || (config.properties && config.properties.compass) || null,
            agentEditable: componentDef.agentEditable || {},
            createdBy: 'ComponentFactory',
            createdAt: Date.now()
        };
        
        // Add to scene
        scene.add(mesh);
        
        console.log(`🏗️ Created ${componentType} component`, {
            position: config.position,
            editable: Object.keys(componentDef.agentEditable || {})
        });
        
        return mesh;
    }
    
    /**
     * Build entire room from room layout configuration
     * @param {THREE.Scene} scene - Scene to build the room in
     */
    buildRoomFromLayout(scene) {
        if (!this.roomLayout) {
            console.error('🏗️ Room layout not loaded');
            return false;
        }
        
        const layout = this.roomLayout;
        console.log(`🏗️ Building room: ${layout.name}`);
        
        // Create all component instances
        layout.instances.forEach(instance => {
            const mesh = this.createComponent(instance.componentType, instance, scene);
            
            // Add any special physics properties for debug ball
            if (instance.componentType === 'debugBall' && instance.properties && instance.properties.physics) {
                mesh.userData.physics = instance.properties.physics;
            }
        });
        
        console.log(`🏗️ Room '${layout.name}' built successfully with ${layout.instances.length} components`);
        return layout;
    }
    
    /**
     * Get room layout
     */
    getRoomLayout() {
        return this.roomLayout;
    }
    
    /**
     * Get component registry
     */
    getRegistry() {
        return this.registry;
    }
    
    /**
     * Create a new room configuration with different dimensions
     * @param {Object} newDimensions - {width, depth, height}
     * @param {string} roomName - Name for the new room
     */
    createRoomVariant(newDimensions, roomName = 'Custom Room') {
        if (!this.roomConfig) return null;
        
        const variant = JSON.parse(JSON.stringify(this.roomConfig)); // Deep clone
        
        // Update dimensions
        variant.name = roomName;
        variant.dimensions = { ...variant.dimensions, ...newDimensions };
        
        const { width, depth, height } = variant.dimensions;
        const centerX = width / 2;
        const centerZ = depth / 2;
        const centerY = height / 2;
        
        // Update positions based on new dimensions
        variant.surfaces.floor.size = [width, depth];
        variant.surfaces.floor.position = [centerX, 0, centerZ];
        
        variant.surfaces.ceiling.size = [width, depth];
        variant.surfaces.ceiling.position = [centerX, height, centerZ];
        
        // Update wall positions
        variant.surfaces.walls.north.size = [width, height];
        variant.surfaces.walls.north.position = [centerX, centerY, depth];
        
        variant.surfaces.walls.south.size = [width, height];
        variant.surfaces.walls.south.position = [centerX, centerY, 0];
        
        variant.surfaces.walls.east.size = [depth, height];
        variant.surfaces.walls.east.position = [width, centerY, centerZ];
        
        variant.surfaces.walls.west.size = [depth, height];
        variant.surfaces.walls.west.position = [0, centerY, centerZ];
        
        // Update player boundaries
        variant.player.movement.boundaries = {
            x: { min: 0.5, max: width - 0.5 },
            z: { min: 0.5, max: depth - 0.5 }
        };
        
        console.log(`🏗️ Created room variant: ${roomName} (${width}×${depth}×${height})`);
        return variant;
    }
}

// Export for use in main application
window.ComponentFactory = ComponentFactory;