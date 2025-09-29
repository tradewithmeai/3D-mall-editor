/**
 * Agent Integration System
 * Demonstrates how to integrate AI agents with the existing 3D scene
 */

class AgentIntegration {
    constructor() {
        this.agents = new Map();
        this.componentFactory = null;
        this.scene = null;
    }
    
    /**
     * Initialize the agent system with existing scene
     * @param {THREE.Scene} scene - The existing Three.js scene
     */
    async initialize(scene) {
        this.scene = scene;
        
        // Initialize component factory
        this.componentFactory = new ComponentFactory();
        const loaded = await this.componentFactory.loadConfigurations();
        
        if (!loaded) {
            console.error('🤖 Failed to initialize agent system');
            return false;
        }
        
        // Tag existing objects in the scene for agent recognition
        this.tagExistingObjects();
        
        // Initialize Diana the Decorator
        const diana = new DianaDecorator(scene, this.componentFactory.getRegistry());
        this.agents.set('diana', diana);
        
        console.log('🤖 Agent system initialized successfully');
        console.log('🎨 Diana the Decorator is ready to make your space beautiful!');
        
        return true;
    }
    
    /**
     * Tag existing objects in the scene so agents can recognize them
     */
    tagExistingObjects() {
        console.log('🏷️ Tagging existing objects for agent recognition...');
        
        // Define semantic mapping for existing objects
        const objectMappings = [
            {
                test: (obj) => obj.geometry instanceof THREE.PlaneGeometry && 
                               obj.position.y === 0 && 
                               obj.rotation.x < 0,
                tag: { componentType: 'floor' }
            },
            {
                test: (obj) => obj.geometry instanceof THREE.PlaneGeometry && 
                               obj.position.y > 5 && 
                               obj.rotation.x > 0,
                tag: { componentType: 'ceiling' }
            },
            {
                test: (obj) => obj.geometry instanceof THREE.PlaneGeometry && 
                               obj.position.y > 1 && obj.position.y < 6,
                tag: (obj) => {
                    const tag = { componentType: 'wall' };
                    // Determine compass direction based on position
                    if (obj.position.z >= 29) tag.compass = 'north';
                    else if (obj.position.z <= 1) tag.compass = 'south';
                    else if (obj.position.x >= 39) tag.compass = 'east';
                    else if (obj.position.x <= 1) tag.compass = 'west';
                    return tag;
                }
            },
            {
                test: (obj) => obj.geometry instanceof THREE.CylinderGeometry && 
                               obj.position.x === 0 && obj.position.z === 0,
                tag: { componentType: 'referencePole' }
            },
            {
                test: (obj) => obj.geometry instanceof THREE.SphereGeometry && 
                               obj.material.color.getHex() === 0x44ff44,
                tag: { componentType: 'debugBall' }
            }
        ];
        
        let taggedCount = 0;
        
        this.scene.traverse((object) => {
            if (object.isMesh && !object.userData.componentType) {
                for (const mapping of objectMappings) {
                    if (mapping.test(object)) {
                        const tag = typeof mapping.tag === 'function' ? 
                                   mapping.tag(object) : mapping.tag;
                        
                        Object.assign(object.userData, tag);
                        taggedCount++;
                        
                        console.log(`🏷️ Tagged ${tag.componentType}${tag.compass ? ` (${tag.compass})` : ''}`);
                        break;
                    }
                }
            }
        });
        
        console.log(`🏷️ Tagged ${taggedCount} objects for agent recognition`);
    }
    
    /**
     * Execute agent command
     * @param {string} agentName - Name of the agent
     * @param {string} command - Command to execute
     * @param {...any} args - Command arguments
     */
    executeCommand(agentName, command, ...args) {
        const agent = this.agents.get(agentName);
        if (!agent) {
            console.error(`🤖 Agent '${agentName}' not found`);
            return false;
        }
        
        if (typeof agent[command] !== 'function') {
            console.error(`🤖 Agent '${agentName}' doesn't support command '${command}'`);
            return false;
        }
        
        console.log(`🤖 Executing: ${agentName}.${command}(${args.join(', ')})`);
        return agent[command](...args);
    }
    
    /**
     * Get agent by name
     * @param {string} agentName - Name of the agent
     */
    getAgent(agentName) {
        return this.agents.get(agentName);
    }
    
    /**
     * List all available agents
     */
    listAgents() {
        const agentList = [];
        for (let [name, agent] of this.agents) {
            agentList.push({
                name: name,
                displayName: agent.name || name,
                role: agent.role || 'AI Agent',
                capabilities: agent.capabilities || []
            });
        }
        return agentList;
    }
    
    /**
     * Demonstrate Diana's capabilities
     */
    demonstrateDiana() {
        const diana = this.getAgent('diana');
        if (!diana) {
            console.error('🎨 Diana not available');
            return;
        }
        
        diana.speak('greeting');
        
        console.log('\n🎨 Diana\'s Demo Sequence:');
        
        // Show what Diana can edit
        console.log('\n📋 Editable Objects:');
        console.table(diana.getEditableObjects());
        
        // Show available palettes
        console.log('\n🎨 Available Color Palettes:');
        console.log(diana.getAvailablePalettes());
        
        // Demo: Change floor color
        setTimeout(() => {
            console.log('\n🎨 Demo 1: Changing floor to sky blue...');
            diana.changeColor('floor', '#87CEEB');
        }, 2000);
        
        // Demo: Apply pastel palette to walls
        setTimeout(() => {
            console.log('\n🎨 Demo 2: Applying pastel palette to walls...');
            diana.applyColorPalette('pastels', ['north-wall', 'south-wall', 'east-wall', 'west-wall']);
        }, 4000);
        
        // Demo: Adjust material properties
        setTimeout(() => {
            console.log('\n🎨 Demo 3: Making walls more glossy...');
            diana.adjustMaterialProperties('north-wall', { roughness: 0.2, metalness: 0.8 });
            diana.adjustMaterialProperties('south-wall', { roughness: 0.2, metalness: 0.8 });
            diana.adjustMaterialProperties('east-wall', { roughness: 0.2, metalness: 0.8 });
            diana.adjustMaterialProperties('west-wall', { roughness: 0.2, metalness: 0.8 });
        }, 6000);
        
        // Show change history
        setTimeout(() => {
            console.log('\n📜 Change History:');
            console.table(diana.getChangeHistory());
            diana.speak('success');
        }, 8000);
    }
}

// Create global instance
window.agentSystem = new AgentIntegration();

// Convenience functions for easy agent interaction
window.diana = {
    changeColor: (object, color) => window.agentSystem.executeCommand('diana', 'changeColor', object, color),
    applyPalette: (palette, targets) => window.agentSystem.executeCommand('diana', 'applyColorPalette', palette, targets),
    adjustMaterial: (object, props) => window.agentSystem.executeCommand('diana', 'adjustMaterialProperties', object, props),
    reset: (object) => window.agentSystem.executeCommand('diana', 'resetToDefault', object),
    demo: () => window.agentSystem.demonstrateDiana(),
    status: () => {
        const agent = window.agentSystem.getAgent('diana');
        if (agent) {
            console.log('🎨 Diana Status:');
            console.table(agent.getEditableObjects());
            return agent.getChangeHistory();
        }
    }
};

console.log('🤖 Agent Integration System loaded');
console.log('💡 Try: diana.demo() or diana.changeColor("floor", "#FF6B6B")');