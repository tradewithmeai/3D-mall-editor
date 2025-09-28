# 2D→3D Mapping Draft

## Overview
This document defines provisional formulas for converting 2D scene.v1 data into 3D world coordinates for the mall rendering system. All conversions are designed to preserve spatial relationships while transitioning from pixel-based 2D coordinates to meter-based 3D world units.

---

## From 2D

### Coordinate System Conversion

#### Basic Unit Conversion
```
worldUnit = cellSize * pixelToMeterScale
where:
  cellSize = grid.cellSize (pixels per grid cell)
  pixelToMeterScale = 0.05 (meters per pixel) [provisional]

Example:
  cellSize = 20 pixels
  worldUnit = 20 * 0.05 = 1.0 meter per grid cell
```

#### World Coordinate Mapping
```
2D Grid: (gridX, gridY)
3D World: (worldX, worldY, worldZ)

worldX = gridX * worldUnit
worldY = 0  (floor level)
worldZ = gridY * worldUnit

Axis mapping:
  2D +X (right) → 3D +X (east)
  2D +Y (down)  → 3D +Z (south)
  2D implicit  → 3D +Y (up)
```

### Floor Tile Conversion

#### Floor Geometry
```javascript
// From scene.v1 tiles.floor array
for (const [gridX, gridY] of scene.tiles.floor) {
    const floorTile = {
        // Center position
        centerX: gridX * worldUnit + (worldUnit / 2),
        centerY: 0,  // Floor at Y=0
        centerZ: gridY * worldUnit + (worldUnit / 2),

        // Dimensions
        width: worldUnit,   // X dimension
        height: 0.1,        // Y dimension (floor thickness)
        depth: worldUnit,   // Z dimension

        // Bounds
        minX: gridX * worldUnit,
        maxX: (gridX + 1) * worldUnit,
        minY: 0,
        maxY: 0.1,
        minZ: gridY * worldUnit,
        maxZ: (gridY + 1) * worldUnit
    };
}
```

### Wall Edge Conversion

#### Horizontal Walls (2D horizontal → 3D X-aligned)
```javascript
// From scene.v1 edges.horizontal array
for (const [gridX, gridY] of scene.edges.horizontal) {
    const horizontalWall = {
        // Start and end positions
        startX: gridX * worldUnit,
        startY: 0,
        startZ: gridY * worldUnit,

        endX: (gridX + 1) * worldUnit,
        endY: wallHeight,
        endZ: gridY * worldUnit,

        // Dimensions
        length: worldUnit,      // Along X axis
        height: wallHeight,     // Along Y axis (up)
        thickness: wallThickness, // Along Z axis

        // Normal vector (pointing south)
        normalX: 0,
        normalY: 0,
        normalZ: 1,

        // Wall type
        orientation: 'horizontal'
    };
}
```

#### Vertical Walls (2D vertical → 3D Z-aligned)
```javascript
// From scene.v1 edges.vertical array
for (const [gridX, gridY] of scene.edges.vertical) {
    const verticalWall = {
        // Start and end positions
        startX: gridX * worldUnit,
        startY: 0,
        startZ: gridY * worldUnit,

        endX: gridX * worldUnit,
        endY: wallHeight,
        endZ: (gridY + 1) * worldUnit,

        // Dimensions
        length: worldUnit,      // Along Z axis
        height: wallHeight,     // Along Y axis (up)
        thickness: wallThickness, // Along X axis

        // Normal vector (pointing east)
        normalX: 1,
        normalY: 0,
        normalZ: 0,

        // Wall type
        orientation: 'vertical'
    };
}
```

### Default 3D Parameters

#### Wall Properties
```
wallHeight = 3.0 meters        // Standard room height
wallThickness = 0.2 meters     // Standard wall thickness
doorHeight = 2.1 meters        // Standard door height
doorWidth = 0.9 meters         // Standard door width
```

#### Material Properties
```
floorMaterial = 'concrete'     // Default floor material
wallMaterial = 'drywall'       // Default wall material
floorColor = '#D3D3D3'         // Light gray
wallColor = '#F5F5F5'          // Off-white
```

### Grid Bounds Conversion

#### Scene Boundaries
```javascript
// From scene.v1 grid dimensions
const sceneBounds = {
    minX: 0,
    maxX: scene.grid.width * worldUnit,
    minY: 0,
    maxY: wallHeight,
    minZ: 0,
    maxZ: scene.grid.height * worldUnit,

    // Center point
    centerX: (scene.grid.width * worldUnit) / 2,
    centerY: wallHeight / 2,
    centerZ: (scene.grid.height * worldUnit) / 2,

    // Total dimensions
    totalWidth: scene.grid.width * worldUnit,   // X dimension
    totalHeight: wallHeight,                    // Y dimension
    totalDepth: scene.grid.height * worldUnit   // Z dimension
};
```

### Example Conversion

#### Sample Input (scene.v1)
```json
{
  "grid": { "width": 4, "height": 3, "cellSize": 20 },
  "tiles": { "floor": [[1,1], [2,1], [1,2], [2,2]] },
  "edges": {
    "horizontal": [[1,1], [2,1], [1,3], [2,3]],
    "vertical": [[1,1], [3,1], [1,2], [3,2]]
  }
}
```

#### Converted Output (3D coordinates)
```javascript
// worldUnit = 20 * 0.05 = 1.0 meter

// Floor tiles (4 tiles forming 2x2 square)
floors = [
    { centerX: 1.5, centerY: 0.05, centerZ: 1.5, width: 1.0, height: 0.1, depth: 1.0 },
    { centerX: 2.5, centerY: 0.05, centerZ: 1.5, width: 1.0, height: 0.1, depth: 1.0 },
    { centerX: 1.5, centerY: 0.05, centerZ: 2.5, width: 1.0, height: 0.1, depth: 1.0 },
    { centerX: 2.5, centerY: 0.05, centerZ: 2.5, width: 1.0, height: 0.1, depth: 1.0 }
];

// Horizontal walls (4 walls - top and bottom edges)
horizontalWalls = [
    { startX: 1.0, startZ: 1.0, endX: 2.0, endZ: 1.0, height: 3.0, orientation: 'horizontal' },
    { startX: 2.0, startZ: 1.0, endX: 3.0, endZ: 1.0, height: 3.0, orientation: 'horizontal' },
    { startX: 1.0, startZ: 3.0, endX: 2.0, endZ: 3.0, height: 3.0, orientation: 'horizontal' },
    { startX: 2.0, startZ: 3.0, endX: 3.0, endZ: 3.0, height: 3.0, orientation: 'horizontal' }
];

// Vertical walls (4 walls - left and right edges)
verticalWalls = [
    { startX: 1.0, startZ: 1.0, endX: 1.0, endZ: 2.0, height: 3.0, orientation: 'vertical' },
    { startX: 3.0, startZ: 1.0, endX: 3.0, endZ: 2.0, height: 3.0, orientation: 'vertical' },
    { startX: 1.0, startZ: 2.0, endX: 1.0, endZ: 3.0, height: 3.0, orientation: 'vertical' },
    { startX: 3.0, startZ: 2.0, endX: 3.0, endZ: 3.0, height: 3.0, orientation: 'vertical' }
];

// Scene bounds
sceneBounds = {
    minX: 0, maxX: 4.0,    // 4 grid cells wide
    minY: 0, maxY: 3.0,    // 3 meters tall
    minZ: 0, maxZ: 3.0     // 3 grid cells deep
};
```

### Integration Notes

#### Camera Positioning
```
// Recommended initial camera position for viewing converted scene
cameraPosition = {
    x: sceneBounds.centerX,
    y: sceneBounds.centerY + 2.0,  // Above scene center
    z: sceneBounds.maxZ + 2.0      // South of scene, looking north
};

cameraTarget = {
    x: sceneBounds.centerX,
    y: 0,                          // Looking at floor level
    z: sceneBounds.centerZ
};
```

#### Lighting
```
// Recommended lighting setup
ambientLight = 0.4;               // 40% ambient lighting
directionalLight = {
    intensity: 0.8,
    direction: { x: -1, y: -1, z: -1 },  // Northwest and down
    color: '#FFFFFF'
};
```

#### Performance Considerations
```
// Mesh optimization for large scenes
if (scene.tiles.floor.length > 1000) {
    // Consider merged floor geometry
    useMergedFloorMesh = true;
}

if (scene.edges.horizontal.length + scene.edges.vertical.length > 500) {
    // Consider instanced wall geometry
    useInstancedWallMesh = true;
}
```

This mapping provides a complete conversion pipeline from the 2D grid-based scene.v1 format to 3D world coordinates suitable for WebGL rendering or other 3D visualization systems.