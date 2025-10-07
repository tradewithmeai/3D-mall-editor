# unit-2x3.scene.3d.v1.json

Simple 2×3 rectangle floor plan.

## Expected Values

- **Dimensions**: 2 tiles wide × 3 tiles deep
- **cellMeters**: 1.0
- **wallHeightMeters**: 3.0
- **Coordinate System**: right-handed-z-up
- **Axes Convention**: Z_up_XY_ground

## Parity Summary

- **tiles**: 6
- **edgesH**: 4 (top and bottom edges of the rectangle)
- **edgesV**: 6 (left, middle, and right edges at 3 positions)
- **floorArea**: 6 (grid units)
- **edgeLenH**: 4 (grid units)
- **edgeLenV**: 6 (grid units)

## Bounds

- **min**: {x: 0, y: 0, z: 0}
- **max**: {x: 2.0, y: 3.0, z: 3.0} (2m wide × 3m deep × 3m tall)
- **center**: {x: 1.0, y: 1.5, z: 1.5}

## Digest

- **meta.digest**: 2a3b4c5d (computed from canonicalized tiles and edges)

## Floor Layout

```
(0,2) [F] [F] (2,2)
      |   |
(0,1) [F] [F] (2,1)
      |   |
(0,0) [F] [F] (2,0)
```

Where [F] represents a floor tile and | represents vertical edges.
Horizontal edges are at y=0 (bottom) and y=3 (top).
