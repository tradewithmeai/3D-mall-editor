2D→3D Interface Addendum — Tile↔Unit Mapping

Invariant
• One 2D tile corresponds to exactly one engine unit in 3D X/Z.
• Positions use tile indices; lengths use tile counts.
• Up axis is Y. 2D +X → 3D +X. 2D +Y → 3D +Z.

Positions and lengths
• worldX = x + 0.5 (units)
• worldZ = y + 0.5 (units)
• A run of N edges has length N units.
• A W×D tile area measures W units by D units.

Metres to engine units
• scale = 1 / units.cellMeters
• wallHeight_units = units.wallHeightMeters × scale
• wallThickness_units = units.wallThicknessMeters × scale
• floorThickness_units = units.floorThicknessMeters × scale

Scope
• The importer reconstructs canonical geometry (merged floor areas, coalesced wall runs).
• Overlays are ignored. No meta.schema reads at runtime beyond validating "scene.3d.v1".