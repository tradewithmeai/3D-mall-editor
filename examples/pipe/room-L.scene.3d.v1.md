# room-L.scene.3d.v1.json

L-shaped floor plan (5 tiles).

## Expected Values

- **Dimensions**: 3×3 bounding box with L-shape cut
- **cellMeters**: 1.0
- **wallHeightMeters**: 3.0
- **Coordinate System**: right-handed-z-up
- **Axes Convention**: Z_up_XY_ground

## Parity Summary

- **tiles**: 5
- **edgesH**: 8 (horizontal wall segments)
- **edgesV**: 8 (vertical wall segments)
- **floorArea**: 5 (grid units)
- **edgeLenH**: 8 (grid units)
- **edgeLenV**: 8 (grid units)

## Bounds

- **min**: {x: 0, y: 0, z: 0}
- **max**: {x: 3.0, y: 3.0, z: 3.0} (3m wide × 3m deep × 3m tall)
- **center**: {x: 1.5, y: 1.5, z: 1.5}

## Digest

- **meta.digest**: 3c4d5e6f (computed from canonicalized tiles and edges)

## Floor Layout

```
(0,3) [F] [F] [F]
      |   |   |
(0,2) [F]
      |
(0,1) [F]
      |
(0,0)
```

Where [F] represents a floor tile. Walls close the perimeter around the L-shape.
