# 2D→3D Interface Contract v1

**Version**: 1.0
**Date**: 2025-09-28
**Scope**: Maps scene.v1 (2D) to 3D construction API
**Status**: Locked specification

**See addendum**: [2d→3d-interface-addendum.md](./2d→3d-interface-addendum.md) - Engine unit mapping clarifications

---

## Quick Reference

**Filename**: `<safeId>.scene.3d.v1.json`
**Axis Mapping**: 2D(x,y) → 3D(x,z) with Y-up

---

## 1. Core Conversions

### 1.1 Unit Transform
```
worldUnit = cellSize × 0.05 meters/pixel
Example: 20px cellSize → 1.0 meter grid spacing
```

### 1.2 Coordinate Transform
```
2D Grid (x,y) → 3D World (x,z) with Y-up
2D: +X=right, +Y=down, origin=(0,0) top-left
3D: +X=east, +Y=up, +Z=south, origin=(0,0,0) floor-level

Transform:
  worldX = 2D_x × worldUnit
  worldY = height_value (0 for floor, wallHeight for ceiling)
  worldZ = 2D_y × worldUnit
```

## 2. Field-by-Field Mapping Table

| 2D Field | 3D API/DTO | Transform Formula | Example |
|----------|------------|-------------------|---------|
| `scene.grid.cellSize` | `worldUnit` | `cellSize × 0.05` | `20 → 1.0` |
| `scene.grid.width` | `bounds.maxX` | `width × worldUnit` | `4 → 4.0` |
| `scene.grid.height` | `bounds.maxZ` | `height × worldUnit` | `3 → 3.0` |
| `scene.tiles.floor[x,y]` | `Floor3D{center, size}` | `{x×worldUnit+0.5, 0.05, y×worldUnit+0.5}` | `[1,1] → {1.5,0.05,1.5}` |
| `scene.edges.horizontal[x,y]` | `Wall3D{start, end, height}` | `start:{x×worldUnit,0,y×worldUnit}, end:{(x+1)×worldUnit,0,y×worldUnit}` | `[1,2] → {1,0,2}→{2,0,2}` |
| `scene.edges.vertical[x,y]` | `Wall3D{start, end, height}` | `start:{x×worldUnit,0,y×worldUnit}, end:{x×worldUnit,0,(y+1)×worldUnit}` | `[2,1] → {2,0,1}→{2,0,2}` |

## 3. 3D Object Specifications

### 3.1 Floor Tiles
```javascript
FloorTile3D = {
  center: {
    x: gridX × worldUnit + (worldUnit / 2),
    y: 0.05,  // 5cm above ground
    z: gridY × worldUnit + (worldUnit / 2)
  },
  size: {
    width: worldUnit,   // X dimension
    height: 0.1,        // Y dimension (thickness)
    depth: worldUnit    // Z dimension
  },
  material: 'concrete',
  color: '#D3D3D3'
}
```

### 3.2 Wall Segments
```javascript
// Horizontal walls (X-aligned)
HorizontalWall3D = {
  start: { x: gridX × worldUnit, y: 0, z: gridY × worldUnit },
  end: { x: (gridX + 1) × worldUnit, y: 0, z: gridY × worldUnit },
  height: 3.0,        // meters
  thickness: 0.2,     // meters
  normal: { x: 0, y: 0, z: 1 },  // pointing south
  material: 'drywall',
  color: '#F5F5F5'
}

// Vertical walls (Z-aligned)
VerticalWall3D = {
  start: { x: gridX × worldUnit, y: 0, z: gridY × worldUnit },
  end: { x: gridX × worldUnit, y: 0, z: (gridY + 1) × worldUnit },
  height: 3.0,        // meters
  thickness: 0.2,     // meters
  normal: { x: 1, y: 0, z: 0 },  // pointing east
  material: 'drywall',
  color: '#F5F5F5'
}
```

### 3.3 Scene Bounds
```javascript
SceneBounds3D = {
  min: { x: 0, y: 0, z: 0 },
  max: {
    x: scene.grid.width × worldUnit,
    y: 3.0,  // standard ceiling height
    z: scene.grid.height × worldUnit
  },
  center: {
    x: (scene.grid.width × worldUnit) / 2,
    y: 1.5,
    z: (scene.grid.height × worldUnit) / 2
  }
}
```

## 4. Worked Example

### 4.1 Input: 2×2 Floor with Walls
```json
{
  "meta": { "schema": "scene.v1", "version": "1.0" },
  "grid": { "width": 4, "height": 3, "cellSize": 20 },
  "tiles": { "floor": [[1,1], [2,1], [1,2], [2,2]] },
  "edges": {
    "horizontal": [[1,1], [2,1], [1,3], [2,3]],
    "vertical": [[1,1], [3,1], [1,2], [3,2]]
  }
}
```

### 4.2 Output: 3D API Calls
```javascript
// worldUnit = 20 × 0.05 = 1.0 meter

// Create 4 floor tiles
createFloor({ center: {1.5, 0.05, 1.5}, size: {1.0, 0.1, 1.0} });
createFloor({ center: {2.5, 0.05, 1.5}, size: {1.0, 0.1, 1.0} });
createFloor({ center: {1.5, 0.05, 2.5}, size: {1.0, 0.1, 1.0} });
createFloor({ center: {2.5, 0.05, 2.5}, size: {1.0, 0.1, 1.0} });

// Create 4 horizontal walls (top and bottom borders)
createWall({ start: {1,0,1}, end: {2,0,1}, height: 3.0, orientation: 'horizontal' });
createWall({ start: {2,0,1}, end: {3,0,1}, height: 3.0, orientation: 'horizontal' });
createWall({ start: {1,0,3}, end: {2,0,3}, height: 3.0, orientation: 'horizontal' });
createWall({ start: {2,0,3}, end: {3,0,3}, height: 3.0, orientation: 'horizontal' });

// Create 4 vertical walls (left and right borders)
createWall({ start: {1,0,1}, end: {1,0,2}, height: 3.0, orientation: 'vertical' });
createWall({ start: {3,0,1}, end: {3,0,2}, height: 3.0, orientation: 'vertical' });
createWall({ start: {1,0,2}, end: {1,0,3}, height: 3.0, orientation: 'vertical' });
createWall({ start: {3,0,2}, end: {3,0,3}, height: 3.0, orientation: 'vertical' });

// Set scene bounds
setBounds({ min: {0,0,0}, max: {4.0,3.0,3.0} });
```

## 5. Export Filename Rules

### 5.1 Filename Pattern
```
Format: <safeId>.scene.3d.v1.json
Where: safeId = scene.meta.name || 'scene' (sanitized)
Sanitization: lowercase, alphanumeric + hyphens only
Examples:
  - "unit-room-1.scene.3d.v1.json"
  - "mall-gallery-2.scene.3d.v1.json"
  - "scene.scene.3d.v1.json" (fallback)
```

### 5.2 Output Schema
```json
{
  "meta": {
    "schema": "scene.3d.v1",
    "version": "1.0",
    "sourceSchema": "scene.v1",
    "created": "2025-09-28T12:00:00.000Z"
  },
  "units": {
    "worldUnit": 1.0,
    "lengthUnit": "meters",
    "coordinateSystem": "right-handed-y-up"
  },
  "bounds": {
    "min": { "x": 0, "y": 0, "z": 0 },
    "max": { "x": 4.0, "y": 3.0, "z": 3.0 }
  },
  "floors": [ /* Floor3D objects */ ],
  "walls": [ /* Wall3D objects */ ]
}
```

## 6. Door/Entrance Handling

### 6.1 Current Implementation
**Status**: Placeholder - skip walls where edge.type === 'door'
**Future**: When door system is implemented, check edge.type before creating walls

```javascript
// Placeholder logic
if (edge.type === 'door') {
  // Skip wall creation, create door opening instead
  createDoorOpening({
    start: wallStart,
    end: wallEnd,
    height: 2.1,  // standard door height
    width: 0.9    // standard door width
  });
} else {
  createWall(wallSpec);
}
```

## 7. E2E Test Fixture

### 7.1 Fixture: "unit-1×1-with-wall-gap"
```json
{
  "meta": {
    "schema": "scene.v1",
    "version": "1.0",
    "name": "unit-1x1-with-wall-gap"
  },
  "grid": { "width": 3, "height": 3, "cellSize": 20 },
  "tiles": { "floor": [[1,1]] },
  "edges": {
    "horizontal": [[1,1], [1,2]],
    "vertical": [[1,1], [2,1]]
  }
}
```

**Expected 3D Output**:
- 1 floor tile at center {1.5, 0.05, 1.5}
- 2 walls forming L-shape with gap for entrance
- Scene bounds: {0,0,0} to {3.0,3.0,3.0}
- Filename: `unit-1x1-with-wall-gap.scene.3d.v1.json`

## 8. Implementation Validation Checklist

### 8.1 Coordinate System ✓
- [ ] 2D origin (0,0) maps to 3D origin (0,0,0)
- [ ] 2D +X (right) maps to 3D +X (east)
- [ ] 2D +Y (down) maps to 3D +Z (south)
- [ ] 3D +Y points up (ceiling direction)

### 8.2 Unit Conversion ✓
- [ ] worldUnit = cellSize × 0.05 formula applied
- [ ] Grid dimensions converted: width×worldUnit, height×worldUnit
- [ ] Floor positions: center at gridX×worldUnit + 0.5, gridY×worldUnit + 0.5

### 8.3 Geometry Generation ✓
- [ ] Floor tiles: 1m×1m×0.1m positioned at grid centers
- [ ] Horizontal walls: X-aligned, spanning grid cell width
- [ ] Vertical walls: Z-aligned, spanning grid cell depth
- [ ] Wall height: 3.0 meters standard
- [ ] Wall thickness: 0.2 meters standard

### 8.4 Export Format ✓
- [ ] Filename follows <safeId>.scene.3d.v1.json pattern
- [ ] Output schema includes meta, units, bounds, floors, walls
- [ ] Source schema reference preserved in meta.sourceSchema

### 8.5 Edge Cases ✓
- [ ] Empty scenes (no floors/walls) generate valid bounds
- [ ] Large scenes (>1000 tiles) handled efficiently
- [ ] Edge coordinates at grid boundaries don't create out-of-bounds walls

## 9. Constants Reference

| Constant | Value | Unit | Usage |
|----------|-------|------|-------|
| `worldUnit` | `cellSize × 0.05` | meters | Grid-to-world scaling |
| `floorThickness` | `0.1` | meters | Floor tile Y dimension |
| `floorHeight` | `0.05` | meters | Floor center Y position |
| `wallHeight` | `3.0` | meters | Standard room height |
| `wallThickness` | `0.2` | meters | Wall depth |
| `doorHeight` | `2.1` | meters | Door opening height |
| `doorWidth` | `0.9` | meters | Door opening width |

---

**Contract Status**: Locked ✓
**Implementation Ready**: Yes ✓
**Breaking Changes**: Require version increment ✓