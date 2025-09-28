# 2D Schema Audit - scene.v1 Format

## Overview
This document provides a precise, implementation-level map of the 2D scene.v1 schema used in the 3D mall editor. The schema represents floor tiles and wall edges in a grid-based coordinate system.

## Canonical Builders
- **Primary**: `toSceneV1()` method in `src/editor/editor.js:2162`
- **Export**: `buildSceneV1()` function in `src/editor/core/ExportBuilder.js:150`

Both produce identical scene.v1 format but `toSceneV1()` extracts from editor state while `buildSceneV1()` accepts preprocessed arrays.

## Complete Field Table

| Field | Type | Units | Example | Constraints | Notes |
|-------|------|-------|---------|-------------|--------|
| `meta.schema` | string | - | `"scene.v1"` | Must be exactly "scene.v1" | Schema identifier |
| `meta.version` | string | - | `"1.0"` | Must be exactly "1.0" | Version identifier |
| `meta.created` | string | ISO8601 | `"2025-09-28T11:30:33.000Z"` | Valid ISO8601 timestamp | Creation time |
| `meta.modified` | string | ISO8601 | `"2025-09-28T11:30:33.000Z"` | Valid ISO8601 timestamp | Last modification time |
| `grid.width` | number | grid cells | `60` | Positive integer | Number of columns |
| `grid.height` | number | grid cells | `40` | Positive integer | Number of rows |
| `grid.cellSize` | number | pixels | `20` | Positive number | Size of each grid cell in pixels |
| `tiles.floor` | array | - | `[[2,3], [4,5]]` | Array of [x,y] coordinates | Floor tile positions |
| `edges.horizontal` | array | - | `[[1,2], [3,4]]` | Array of [x,y] coordinates | Horizontal wall positions |
| `edges.vertical` | array | - | `[[1,2], [3,4]]` | Array of [x,y] coordinates | Vertical wall positions |

## Coordinate System

### Axis Directions
```
(0,0) ──────x─────> +X (RIGHT)
  │
  │
  y
  │
  │
  ▼ +Y (DOWN)
```

- **Origin**: Top-left corner at (0,0)
- **X-Axis**: Positive X goes RIGHT (→)
- **Y-Axis**: Positive Y goes DOWN (↓)
- **Canvas Mapping**: `pixelX = gridX * cellSize`, `pixelY = gridY * cellSize`

### Mouse to Grid Conversion
```javascript
const gridX = Math.floor(mouseX / this.cellSize);
const gridY = Math.floor(mouseY / this.cellSize);
```

## Edge Indexing System

### Horizontal Edges
Horizontal edges are indexed by their top-left grid coordinate and span horizontally.

**Example**: Edge at [x=2, y=1] spans from (2,1) to (3,1)
```
Grid:    (0,0) (1,0) (2,0) (3,0)
         (0,1) (1,1) (2,1)═══(3,1)  ← Horizontal edge [2,1]
         (0,2) (1,2) (2,2) (3,2)
```

**Rendering**:
```javascript
if (this.horizontalEdges[y][x]) {
    const startX = x * this.cellSize;      // Left end
    const endX = (x + 1) * this.cellSize;  // Right end
    const edgeY = y * this.cellSize;       // Y position
    // Draw line from (startX, edgeY) to (endX, edgeY)
}
```

### Vertical Edges
Vertical edges are indexed by their top-left grid coordinate and span vertically.

**Example**: Edge at [x=1, y=2] spans from (1,2) to (1,3)
```
Grid:    (0,0) (1,0) (2,0)
         (0,1) (1,1) (2,1)
         (0,2) (1,2) (2,2)
               ║           ← Vertical edge [1,2]
         (0,3) (1,3) (2,3)
```

**Rendering**:
```javascript
if (this.verticalEdges[y][x]) {
    const edgeX = x * this.cellSize;       // X position
    const startY = y * this.cellSize;      // Top end
    const endY = (y + 1) * this.cellSize;  // Bottom end
    // Draw line from (edgeX, startY) to (edgeX, endY)
}
```

## Data Structure Creation

### Floor Tiles
```javascript
// From editor grid to coordinate array
const floorTiles = [];
for (let y = 0; y < this.gridHeight; y++) {
    for (let x = 0; x < this.gridWidth; x++) {
        if (this.grid[y][x] === 'floor') {
            floorTiles.push([x, y]);  // Store as [x,y] coordinate
        }
    }
}
```

### Edges
```javascript
// From editor edge arrays to coordinate arrays
const horizontalEdges = [];
const verticalEdges = [];

for (let y = 0; y < this.gridHeight; y++) {
    for (let x = 0; x < this.gridWidth; x++) {
        if (this.horizontalEdges[y] && this.horizontalEdges[y][x]) {
            horizontalEdges.push([x, y]);
        }
        if (this.verticalEdges[y] && this.verticalEdges[y][x]) {
            verticalEdges.push([x, y]);
        }
    }
}
```

## Export Filename Patterns

| Export Type | Filename Pattern | Example |
|-------------|------------------|---------|
| Scene | `scene.json` | `scene.json` |
| Mall Template | `${mallId}.json` | `mall-123.json` |
| Mall Template (timestamped) | `${safeId}-${timestamp}.mall-template.v1.json` | `mall-20250928t113033.mall-template.v1.json` |
| Gallery Template | `${unitId}.unit-template.v1.json` | `gallery-456.unit-template.v1.json` |
| Room Template | `${roomId}.room-template.v1.json` | `room-789.room-template.v1.json` |
| Object Template | `${objectId}.${schemaName}.json` | `object-101.object-template.v1.json` |

## Implementation Constants

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| Default Grid Width | `60` | `editor.js:17` | Canvas columns |
| Default Grid Height | `40` | `editor.js:18` | Canvas rows |
| Default Cell Size | `20` | `editor.js:19` | Pixels per cell |
| Edge Line Width | `3` | `editor.js:1714` | Wall thickness in pixels |
| Canvas Size | `1200x800` | `index.html:91` | Fixed canvas dimensions |

## Wall Properties (Implied)

While not explicitly stored in scene.v1, the following properties are implied by the rendering:

| Property | Value | Source |
|----------|-------|--------|
| Wall Thickness | 3 pixels | `renderEdges()` line width |
| Wall Color | Black (#000) | `renderEdges()` stroke style |
| Wall Height | *Not specified* | Not defined in 2D - needs 3D mapping |
| Door/Entrance Markers | *Not implemented* | No door system exists yet |

## Coordinate Examples

### Sample Scene Data
```json
{
  "meta": {
    "schema": "scene.v1",
    "version": "1.0",
    "created": "2025-09-28T11:30:33.000Z",
    "modified": "2025-09-28T11:30:33.000Z"
  },
  "grid": {
    "width": 60,
    "height": 40,
    "cellSize": 20
  },
  "tiles": {
    "floor": [[10,15], [11,15], [10,16], [11,16]]
  },
  "edges": {
    "horizontal": [[10,15], [11,15], [10,17], [11,17]],
    "vertical": [[10,15], [12,15], [10,16], [12,16]]
  }
}
```

This represents a 2x2 floor area (tiles at 10,15 through 11,16) enclosed by walls on all sides.