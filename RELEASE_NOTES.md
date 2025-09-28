# 3D Mall Editor - Release Notes

## pipe-v1 (2025-09-28)

**Working 2D→3D Pipeline Implementation**

This release establishes a complete, validated pipeline from 2D floorplan editing to 3D scene generation. The editor now exports scene.3d.v1 JSON files that can be imported and rendered in 3D applications.

---

## 🚀 Highlights

### ✅ Complete 2D→3D Export Pipeline (zzz26)
- **New Export Option**: "Scene (3D Pipe)" in export dropdown
- **Interface Contract v1**: Full implementation per 2D→3D specification
- **Coordinate Transform**: 2D(x,y) → 3D(x,z) with Y-up axis mapping
- **Unit Conversion**: cellSize × 0.05 = cellMeters formula
- **File Format**: `<safeId>.scene.3d.v1.json` with complete metadata

### ✅ Export Validation & Safety (zzz28a)
- **JSON Schema**: Complete scene.3d.v1 schema validation
- **Warn-Only Behavior**: Users see validation errors but can export anyway
- **Error Display**: Modal showing first 5 validation errors with technical details
- **[VALIDATION] Logging**: Diagnostic logs for export quality assessment

### ✅ Editor Regression Testing (zzz27)
- **Tool Verification**: Drag-rectangle floors, wall segments work correctly
- **Bounds Checking**: Template constraints properly enforced
- **Export Warnings**: SceneRules validation (unenclosed floors, out-of-bounds content)
- **Architecture Integrity**: Rendering switches on dto.type exclusively

### ✅ Interface Contract & Documentation (zzz25a)
- **Contract Specification**: Comprehensive 2D→3D mapping documentation
- **Engine Unit Mapping**: 1 tile ⇔ 1 engine unit clarifications
- **Implementation Guide**: Field-by-field transformation formulas

---

## 📖 How to Use

### Export 3D Scene
1. **Create Content**: Use editor tools to place floor tiles and walls
2. **Select Export**: Choose "Scene (3D Pipe)" from export dropdown
3. **Validation Check**: If errors appear, review and choose "Export Anyway" if needed
4. **Download**: Receive `<name>.scene.3d.v1.json` file for 3D import

### Export Flow
```
Editor Content → ExportBuilder3D → Schema Validation → User Choice → Download
```

### File Format Example
```json
{
  "meta": {
    "schema": "scene.3d.v1",
    "version": "1.0",
    "sourceSchema": "scene.v1",
    "created": "2025-09-28T12:00:00.000Z",
    "name": "my-scene"
  },
  "units": {
    "cellMeters": 1.0,
    "wallHeightMeters": 3.0,
    "wallThicknessMeters": 0.2,
    "floorThicknessMeters": 0.1,
    "lengthUnit": "meters",
    "coordinateSystem": "right-handed-y-up"
  },
  "bounds": { "min": {...}, "max": {...}, "center": {...} },
  "tiles": { "floor": [[x,y], ...] },
  "edges": { "horizontal": [[x,y], ...], "vertical": [[x,y], ...] },
  "originOffset": { "x": 0, "z": 0 }
}
```

---

## ⚠️ Known Limitations

### Content Support
- **Floors & Walls Only**: Only floor tiles and wall edges are exported
- **No Furniture**: Object placement not yet supported in 3D export
- **No Doors**: Door openings not implemented (walls span full edge)
- **No Materials**: All surfaces use default materials in 3D

### Template System
- **Scene Mode Only**: 3D export works best in scene editing mode
- **Template Boundaries**: Export respects template bounds if active
- **Coordinate Origin**: Exports relative to template origin

### Validation
- **Warn-Only**: Schema validation provides warnings but doesn't block exports
- **Format Only**: Validates JSON structure, not content quality
- **No 3D Preview**: No real-time 3D preview in editor

---

## 🔧 Technical Details

### Export Architecture
- **Builder Pattern**: `ExportBuilder3D.toScene3D()` handles coordinate transformation
- **Schema Validation**: `validateScene3D()` provides comprehensive JSON Schema checking
- **Modal System**: Validation errors displayed with user choice preservation
- **Logging**: `[EXPORT:3d]`, `[VALIDATION]`, `[BOUNDS]` diagnostic logs

### Coordinate System
- **2D Grid**: Top-left origin, +X right, +Y down
- **3D World**: Floor-level origin, +X east, +Y up, +Z south
- **Transform**: `worldX = gridX × cellMeters + 0.5`, `worldZ = gridY × cellMeters + 0.5`

### File Integration
- **Export Dropdown**: New "Scene (3D Pipe)" option
- **Filename Pattern**: `<safeId>.scene.3d.v1.json`
- **Warning System**: Integrates with existing SceneRules validation

---

## 📋 Interface Contract References

### Specification Documents
- **2D→3D Interface Contract v1**: `reports/2d→3d-interface-v1.md`
  - SHA256: `b503dbbe41b9399b84e706fb3d9a929378e83c07c85a7566d11ae651d75d28cf`
- **Engine Unit Mapping Addendum**: `reports/2d→3d-interface-addendum.md`
  - SHA256: `baa5603e3fd4fd02ddc11090adb07208df04664d6737f602f1654d9a64900afa`
- **JSON Schema Definition**: `schemas/scene.3d.v1.schema.json`
  - SHA256: `c81f5845f142d985a473f2f34ddc4ac58851da8b62132b5b38c5eaff38d3ef1b`

### Version Compatibility
- **Editor**: pipe-v1 (this release)
- **3D Importer**: Compatible with 3D-Base-Template pipe-v1
- **Schema Version**: scene.3d.v1 (stable)

---

## 🧪 Testing & Quality

### Smoke Testing
- **Export Functionality**: Multiple cellSize configurations tested (zzz26c)
- **Validation Coverage**: Valid and invalid JSON scenarios verified
- **Tool Regression**: All editor tools confirmed working post-implementation

### Console Logging
```javascript
[EXPORT:3d] { filename: "scene.scene.3d.v1.json", tiles: 6, hEdges: 4, vEdges: 6, units: {...} }
[VALIDATION] { phase: "export", errors: 0 }
[BOUNDS] { tool: "rect", placed: 6, skipped: 0 }
```

---

## 🎯 Next Steps

### Planned Enhancements
- **3D Preview**: Real-time 3D preview in editor
- **Door Support**: Edge type detection and door opening export
- **Material System**: Surface material specification and export
- **Object Templates**: Furniture and object placement with 3D export

### Integration Opportunities
- **GLB Export**: Binary 3D format support via 3D-Base-Template
- **Validation Enhancement**: Content quality checks beyond schema
- **Performance**: Optimization for large scene exports

---

**Pipeline Status**: ✅ Complete and Ready for Production
**Documentation**: Comprehensive with pinned specification SHAs
**Quality**: Extensively tested with regression verification

For 3D import and rendering, see companion **3D-Base-Template** repository with matching pipe-v1 tag.