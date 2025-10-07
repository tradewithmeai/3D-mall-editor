# Scene 3D Pipe Export Documentation

## Overview

The Scene (3D Pipe) export format (`scene.3d.v1`) is the canonical format for exporting 2D floor plans to the 3D simulator. This document describes the export format, coordinate conventions, and backward compatibility considerations.

## Coordinate System

### Axes Convention

The standard axes convention is **Z_up_XY_ground**:

- **X axis**: Width dimension (ground plane, left-right)
- **Y axis**: Depth dimension (ground plane, front-back)
- **Z axis**: Height dimension (vertical, up)
- **Handedness**: Right-handed coordinate system (right-handed-z-up)

### Coordinate Mapping

The 2D editor grid maps to 3D space as follows:

```
2D Editor Grid (x, y)  →  3D Space (X, Y, Z)
─────────────────────────────────────────────
Grid X coordinate      →  3D X axis (width)
Grid Y coordinate      →  3D Y axis (depth)
N/A (always up)        →  3D Z axis (height)
```

### Bounds Calculation

Bounds are computed from floor tile content:

- **min**: `{x: 0, y: 0, z: 0}` (floor minimum, Z always starts at 0)
- **max**: `{x: widthMeters, y: depthMeters, z: wallHeightMeters}`
  - `widthMeters` = tile width × cellMeters
  - `depthMeters` = tile height × cellMeters
  - `wallHeightMeters` = wall height (default 3.0m)
- **center**: Geometric center of the bounding box

## Canonical Output Rules

### Floor Tiles

1. **Integer Coordinates**: All tile indices `[x, y]` must be integers
2. **Deduplication**: Duplicate tiles are removed
3. **Sorting**: Tiles sorted by (y ascending, then x ascending)
4. **Non-negative**: All indices must be ≥ 0

### Wall Edges

1. **Unit Edges Only**:
   - Horizontal edge `[x, y]` represents segment from `(x, y)` to `(x+1, y)`
   - Vertical edge `[x, y]` represents segment from `(x, y)` to `(x, y+1)`

2. **Deduplication**: Duplicate edges are removed

3. **Sorting**:
   - Horizontal edges: sorted by (y ascending, then x ascending)
   - Vertical edges: sorted by (x ascending, then y ascending)

4. **No Diagonals**: Diagonal edges are not supported (hard error)

5. **Integer Coordinates**: All edge indices must be integers

### Parity Summary

The `meta.parity` object provides fast cross-checking counts:

```json
{
  "tiles": 6,        // Total number of floor tiles
  "edgesH": 4,       // Total number of horizontal edges
  "edgesV": 6,       // Total number of vertical edges
  "floorArea": 6,    // Floor area in grid units (= tiles count)
  "edgeLenH": 4,     // Horizontal edge length in grid units (= edgesH count)
  "edgeLenV": 6      // Vertical edge length in grid units (= edgesV count)
}
```

### Deterministic Digest

The `meta.digest` field contains a deterministic hash of the canonicalized tiles and edges. Re-exporting the same floor plan should produce the same digest.

Format: 8-character lowercase hexadecimal string (e.g., `"2a3b4c5d"`)

## Backward Compatibility

### Legacy originOffset Format

**Legacy Format** (old files):
```json
{
  "originOffset": {
    "x": 0,
    "z": 0
  }
}
```

**Standard Format** (new files):
```json
{
  "originOffset": {
    "x": 0,
    "y": 0
  }
}
```

**Migration Rule**: If legacy `originOffset.z` is present:
1. Map `z` value to `y` in the output
2. Set `meta.compat = "originOffset_z_as_y"` flag

### Legacy Coordinate System

Older files may have:
- `coordinateSystem: "right-handed-y-up"` (legacy, Y is up)

Standard files use:
- `coordinateSystem: "right-handed-z-up"` (standard, Z is up)

The schema accepts both values for compatibility, but new exports use `right-handed-z-up`.

## Required Fields

All exports must include:

### Meta Fields
- `meta.schema` = `"scene.3d.v1"`
- `meta.version` = `"1.0"`
- `meta.axes` = `"Z_up_XY_ground"`
- `meta.parity` (object with all counts)
- `meta.digest` (8-char hex string)

### Units Fields
- `units.cellMeters` (number > 0, default 1.0)
- `units.wallHeightMeters` (number > 0, default 3.0)

### OriginOffset Fields
- `originOffset.x` (number, default 0)
- `originOffset.y` (number, default 0)

## Validation Rules

### Hard Errors (Export Fails)

1. `units.cellMeters` ≤ 0 or missing
2. `units.wallHeightMeters` ≤ 0 or missing
3. Non-integer tile or edge indices
4. Negative tile or edge indices
5. Diagonal edges (not axis-aligned)
6. Content exceeds simulation limits:
   - Max width: 60 tiles
   - Max height: 40 tiles

### Warnings (Export Continues)

1. Isolated floor tiles (tiles with no 4-neighbor connections)
2. Perimeter gaps (missing walls on room boundaries)
3. Duplicate tiles or edges (automatically deduped)
4. T-junctions or irregular wall configurations

## Examples

See the `examples/pipe/` directory for golden fixtures:

- `unit-2x3.scene.3d.v1.json` - Simple 2×3 rectangle
- `room-L.scene.3d.v1.json` - L-shaped room
- `room-U.scene.3d.v1.json` - U-shaped room
- `room-donut.scene.3d.v1.json` - Room with hole in center

Each fixture includes a `.md` file with expected values and visual layout.

## Console Output

When exporting, the console displays:

```
[EXPORT:3d] Parity: tiles=6, edgesH=4, edgesV=6, floorArea=6, edgeLenH=4, edgeLenV=6, digest=2a3b4c5d
[EXPORT:3d] contentTiles=2×3, bounds=2m×3m×3m, offset={x:0,y:0}, axes=Z_up_XY_ground
```

This provides a quick visual check of the export results.

## Schema Location

The JSON Schema is located at:
- `/schemas/scene.3d.v1.schema.json`

Validation is performed using the lightweight validator:
- `/src/editor/core/validateScene3D.js`
