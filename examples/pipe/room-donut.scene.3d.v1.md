# room-donut.scene.3d.v1.json

Donut-shaped floor plan with hole in center (8 tiles).

## Expected Values

- **Dimensions**: 3×3 bounding box with center removed (donut)
- **cellMeters**: 1.0
- **wallHeightMeters**: 3.0
- **Coordinate System**: right-handed-z-up
- **Axes Convention**: Z_up_XY_ground

## Parity Summary

- **tiles**: 8
- **edgesH**: 10 (horizontal wall segments, including inner perimeter)
- **edgesV**: 11 (vertical wall segments, including inner perimeter)
- **floorArea**: 8 (grid units)
- **edgeLenH**: 10 (grid units)
- **edgeLenV**: 11 (grid units)

## Bounds

- **min**: {x: 0, y: 0, z: 0}
- **max**: {x: 3.0, y: 3.0, z: 3.0} (3m wide × 3m deep × 3m tall)
- **center**: {x: 1.5, y: 1.5, z: 1.5}

## Digest

- **meta.digest**: 5e6f7a8b (computed from canonicalized tiles and edges)

## Floor Layout

```
(0,3) [F] [F] [F]
      |   |   |
(0,2) [F] [X] [F]
      |   |   |
(0,1) [F] [X] [F]
      |   |   |
(0,0) [F] [F] [F]
```

Where [F] represents a floor tile and [X] is a hole/void in the center. This creates a donut shape with an inner perimeter requiring walls around the hole.
