# Mall Units Schema

The "units" property is an optional scaffold for future mall logic. It does not affect rendering and the editor remains unchanged.

## Purpose

Units define logical spaces within the floorplan grid that can be used for:
- Space allocation and management
- Future business logic (leasing, navigation, etc.)
- Organizational structure for mall layouts

## Schema

Units are validated against `mall-units.schema.json`. Each unit must have:
- `id`: Unique identifier (pattern: `unit-[a-z0-9-]+`)
- `name`: Display name
- `gridRect`: Position and size (`x`, `y`, `w`, `h`)
- `entrance`: Entry point with `side` and `offset`
- `meta`: Optional metadata object

## Example

```json
{
  "instances": [...],
  "units": [
    {
      "id": "unit-101",
      "name": "Coffee Shop",
      "gridRect": { "x": 0, "y": 0, "w": 3, "h": 2 },
      "entrance": { "side": "north", "offset": 1 },
      "meta": { "category": "food", "size": "small" }
    },
    {
      "id": "unit-102", 
      "name": "Electronics Store",
      "gridRect": { "x": 3, "y": 0, "w": 2, "h": 2 },
      "entrance": { "side": "west", "offset": 0 }
    }
  ]
}
```

The units array is completely optional - existing floorplans without units continue to work unchanged.