# 2D→3D Interface Addendum: Engine Unit Mapping

**Version**: 1.0
**Date**: 2025-09-28
**Relates to**: [2d→3d-interface-v1.md](./2d→3d-interface-v1.md)

---

## Core Invariant

**1 tile ⇔ 1 engine unit (X/Z dimensions)**

This establishes a direct, consistent mapping between 2D grid coordinates and 3D engine coordinates along the horizontal plane.

---

## Position vs Length Handling

### Positions (Tile Indices)
- **Grid coordinates**: Use integer tile indices directly
- **Engine coordinates**: Convert via `tileIndex × units.cellMeters`
- **Example**: Tile at [2,1] → Engine position (2.0×cellMeters, 1.0×cellMeters)

### Lengths (Tile Counts)
- **Grid dimensions**: Measured in tile counts
- **Engine dimensions**: Convert via `tileCount × units.cellMeters`
- **Example**: 3×2 grid → Engine size (3.0×cellMeters, 2.0×cellMeters)

---

## Meter→Engine Unit Conversion

All JSON meter values convert to engine units by **dividing by `units.cellMeters`**:

```
engineUnits = jsonMeters ÷ units.cellMeters
```

### Examples

**Case 1: cellMeters = 1.0**
- 3.0m wall height → 3.0 engine units
- 0.2m wall thickness → 0.2 engine units
- 0.1m floor thickness → 0.1 engine units

**Case 2: cellMeters = 0.5**
- 3.0m wall height → 6.0 engine units
- 0.2m wall thickness → 0.4 engine units
- 0.1m floor thickness → 0.2 engine units

**Case 3: cellMeters = 2.0**
- 3.0m wall height → 1.5 engine units
- 0.2m wall thickness → 0.1 engine units
- 0.1m floor thickness → 0.05 engine units

---

## Implementation Reference

### Grid→Engine Position Transform
```javascript
// For tile at grid coordinates [x, y]
const engineX = x * units.cellMeters;
const engineZ = y * units.cellMeters;
```

### Meter→Engine Dimension Transform
```javascript
// For any meter measurement from JSON
const engineUnits = jsonMeters / units.cellMeters;

// Examples:
const wallHeightUnits = units.wallHeightMeters / units.cellMeters;
const wallThicknessUnits = units.wallThicknessMeters / units.cellMeters;
const floorThicknessUnits = units.floorThicknessMeters / units.cellMeters;
```

---

## Key Benefits

1. **Predictable Scaling**: All dimensions scale consistently with `cellMeters`
2. **Engine Agnostic**: Works regardless of engine's internal unit system
3. **Tile Fidelity**: Each 2D tile maps to exactly one engine unit square
4. **Flexible Resolution**: `cellMeters` controls world scale without breaking the tile mapping

---

**Status**: Specification Complete ✓
**Implementation**: No code changes required ✓