/**
 * Component Factory System
 * Loads JSON configurations and creates 3D objects
 */

export async function loadComponents() {
    const res = await fetch('components.json');
    return res.json();
}

export function createComponent(type, config, registry, scene) {
    const def = registry[type];
    if (!def) {
        console.error(`Unknown component type: ${type}`);
        return null;
    }

    // 1. Create geometry based on def.model and def.size
    let geometry;
    switch (def.model) {
        case 'box':
            geometry = new THREE.BoxGeometry(...def.size);
            break;
        case 'plane':
            geometry = new THREE.PlaneGeometry(...def.size);
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(...def.size);
            break;
        case 'sphere':
            geometry = new THREE.SphereGeometry(...def.size);
            break;
        default:
            console.error(`Unsupported geometry type: ${def.model}`);
            return null;
    }

    // 2. Create MeshStandardMaterial from def.material
    const materialParams = { ...def.material };
    
    // Convert hex color strings to proper format
    if (materialParams.color && typeof materialParams.color === 'string') {
        materialParams.color = materialParams.color.replace('#', '0x');
    }
    
    const material = new THREE.MeshStandardMaterial(materialParams);

    // 3. Create mesh and apply config position & rotation
    const mesh = new THREE.Mesh(geometry, material);
    
    // Apply position
    if (config.position) {
        mesh.position.set(...config.position);
    }
    
    // Apply rotation
    if (config.rotation) {
        mesh.rotation.set(...config.rotation);
    }
    
    // Store metadata
    mesh.userData.componentType = type;
    if (config.name) {
        mesh.userData.name = config.name;
    }

    // 4. Add to scene
    scene.add(mesh);

    // 5. If def.collision, create collider
    if (def.collision) {
        mesh.userData.collider = new THREE.Box3().setFromObject(mesh);
    }

    console.log(`🏗️ ComponentFactory: Created ${type} at position [${config.position?.join(', ') || '0,0,0'}]`);
    
    return mesh;
}