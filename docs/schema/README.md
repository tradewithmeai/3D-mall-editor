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
- `type`: Optional unit type (`retail`, `service`, `food`, `kiosk`, `corridor`)
- `occupancy`: Optional occupancy tracking with status-based rules
- `meta`: Optional metadata object

### Occupancy Rules

The `occupancy` object supports conditional requirements:
- **occupied**: Must include `tenantId` (pattern: `tenant-[a-z0-9-]+`), optional `since` date
- **vacant**: Cannot include `tenantId` or `since` fields
- **reserved**: Optional `since` date, no `tenantId` allowed

All occupancy fields are optional for backward compatibility.

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
      "type": "food",
      "occupancy": { 
        "status": "occupied", 
        "tenantId": "tenant-abc123",
        "since": "2025-01-15"
      }
    },
    {
      "id": "unit-102", 
      "name": "Electronics Store",
      "gridRect": { "x": 3, "y": 0, "w": 2, "h": 2 },
      "entrance": { "side": "west", "offset": 0 },
      "type": "retail",
      "occupancy": { "status": "vacant" }
    },
    {
      "id": "unit-103",
      "name": "Service Counter", 
      "gridRect": { "x": 5, "y": 0, "w": 1, "h": 1 },
      "entrance": { "side": "east", "offset": 0 },
      "type": "kiosk",
      "occupancy": { 
        "status": "reserved",
        "since": "2025-02-01" 
      }
    }
  ]
}
```

The units array is completely optional - existing floorplans without units continue to work unchanged.