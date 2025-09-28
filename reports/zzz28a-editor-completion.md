# zzz28a-editor: Scene.3D.v1 JSON Schema + Export-Time Validation

**Version**: 1.0
**Date**: 2025-09-28
**Scope**: Add scene.3d.v1 JSON Schema validation to 3D export flow
**Status**: Implemented ✅

---

## Task Summary

**Goal**: Validate the "Scene (3D Pipe)" JSON against a canonical schema before download. If invalid, show a modal listing the first 5 errors and allow "Export anyway". Keep behaviour unchanged for valid files.

**Method**: Surgical implementation of schema-based validation with warn-only behavior

---

## Implementation Details

### ✅ AC1: Schema Definition

**File**: `schemas/scene.3d.v1.schema.json`
**SHA256**: `c81f5845f142d985a473f2f34ddc4ac58851da8b62132b5b38c5eaff38d3ef1b`

**Schema Structure**:
- **JSON Schema Draft 07** compliance
- **Required fields**: meta, units, bounds, tiles, edges, originOffset
- **Strict validation**: const values for schema identifiers, coordinate systems
- **Type safety**: Number constraints, array item validation, date-time format validation
- **No additional properties** allowed for strict compliance

**Key Validations**:
```json
{
  "meta.schema": "scene.3d.v1",
  "meta.version": "1.0",
  "meta.sourceSchema": "scene.v1",
  "units.lengthUnit": "meters",
  "units.coordinateSystem": "right-handed-y-up",
  "bounds": { "min": {x,y,z}, "max": {x,y,z}, "center": {x,y,z} },
  "tiles.floor": [[x,y], ...],
  "edges.horizontal": [[x,y], ...],
  "edges.vertical": [[x,y], ...]
}
```

### ✅ AC2: Validator Implementation

**File**: `src/editor/core/validateScene3D.js`
**Dependencies**: None (pure JavaScript as requested)

**Features**:
- **Schema Loading**: Fetches schema from `/schemas/scene.3d.v1.schema.json`
- **Recursive Validation**: Full object tree validation with JSON Schema Draft 07 support
- **Error Reporting**: Returns `{ errors: [{path, msg}], count }` format
- **Performance**: Lightweight implementation without third-party libraries

**Core Validation Types**:
```javascript
// Type validation
if (actualType !== schema.type) {
    errors.push({ path, msg: `Expected type '${schema.type}', got '${actualType}'` });
}

// Const validation
if (schema.const !== undefined && value !== schema.const) {
    errors.push({ path, msg: `Expected constant value '${schema.const}', got '${value}'` });
}

// Number constraints
if (schema.minimum !== undefined && value < schema.minimum) {
    errors.push({ path, msg: `Value ${value} is less than minimum ${schema.minimum}` });
}
```

### ✅ AC3: Export Flow Integration

**Modified**: `src/editor/editor.js` - `exportAsScene3D()` method
**Behavior**: Surgical insertion into existing 3D export flow

**Validation Flow**:
1. **Build scene.3d.v1 JSON** using existing `ExportBuilder3D.toScene3D()`
2. **Validate against schema** using `validateScene3D(scene3D)`
3. **Log validation results** with `[VALIDATION]` prefix
4. **If errors found**: Show modal with first 5 errors, user choice Cancel/Export anyway
5. **If valid or user proceeds**: Continue to existing `exportWithWarnings()` flow

**Code Implementation**:
```javascript
// Validate against scene.3d.v1 schema
try {
    const validation = await validateScene3D(scene3D);

    // Log validation results
    console.info('[VALIDATION]', { phase: 'export', errors: validation.count });

    if (validation.count > 0) {
        // Show validation errors modal
        this.showValidationErrorsModal(validation.errors, filename, scene3D);
        return;
    }
} catch (error) {
    console.error('[VALIDATION] Schema validation failed:', error);
    this.showToast('error', 'Validation Error', 'Schema validation failed - exporting anyway');
}
```

### ✅ AC4: Validation Modal UI

**Implementation**: `showValidationErrorsModal()` method
**Design**: Consistent with existing warning modal patterns

**Modal Features**:
- **Error Display**: First 5 errors with `path: message` format
- **Monospace Formatting**: Clear error path display for technical users
- **User Choice**: Cancel vs "Export Anyway" buttons
- **Error Count**: Shows total error count with "... and X more errors" if >5
- **Modal Styling**: Consistent with existing editor UI patterns

**Modal Content**:
```
❌ Schema Validation Errors

The generated scene.3d.v1 JSON has N validation error(s).
You can still export, but the file may not be valid:

• meta.schema: Expected constant value 'scene.3d.v1', got 'scene.v1'
• units.cellMeters: Value -1 must be greater than 0
• bounds.min.x: Expected type 'number', got 'string'
• tiles.floor[0]: Array length 3 is greater than maxItems 2
• edges.horizontal: Missing required property 'horizontal'
... and 3 more errors

[Cancel] [Export Anyway]
```

### ✅ AC5: Logging Integration

**[VALIDATION] Log Format**:
```javascript
console.info('[VALIDATION]', { phase: 'export', errors: validation.count });

// Examples:
// [VALIDATION] { phase: 'export', errors: 0 }        // Valid file
// [VALIDATION] { phase: 'export', errors: 7 }        // Invalid file
```

**Existing Log Preservation**:
- **[EXPORT:3d] logs**: Still generated for export details
- **[BOUNDS] logs**: Still generated by existing warning system
- **[DOWNLOAD] logs**: Still generated by file download process

---

## Testing Results

### ✅ Valid Scene Export

**Scenario**: Export scene with valid floor tiles and walls
**Expected**: No validation errors, direct export
**Result**: ✅ Validation passes, `[VALIDATION] { phase: 'export', errors: 0 }`

### ✅ Invalid Scene Scenarios

**Tested Validation Errors**:
1. **Missing required fields**: `meta`, `units`, `bounds`, etc.
2. **Wrong schema identifier**: `meta.schema` not equal to `"scene.3d.v1"`
3. **Invalid types**: String instead of number, object instead of array
4. **Constraint violations**: Negative numbers for positive-only fields
5. **Array format errors**: Wrong array item structure for tiles/edges

**Modal Display**: ✅ Shows first 5 errors with proper formatting
**User Choice**: ✅ Cancel vs Export anyway works correctly
**Export Anyway**: ✅ Proceeds to existing `exportWithWarnings()` flow

### ✅ Error Handling

**Schema Load Failure**: ✅ Graceful fallback with error toast
**Validation Failure**: ✅ Logs error, shows toast, continues export
**Modal Interaction**: ✅ Proper cleanup, overlay click handling

---

## Integration Verification

### ✅ No Regression

**Existing Functionality**: All editor tools continue to work unchanged
**Valid Exports**: No additional friction for valid scene.3d.v1 files
**Warning System**: Existing SceneRules validation still functional
**Export Options**: All other export types (mall, gallery, room) unaffected

### ✅ Rendering Integrity

**Confirmed**: No rendering logic touched (still branches on `dto.type` only)
**Schema Usage**: Limited to validation only, not runtime behavior
**Template System**: Unchanged overlay/bounds behavior

---

## File Changes Summary

### New Files
```
schemas/scene.3d.v1.schema.json          - JSON Schema definition
src/editor/core/validateScene3D.js      - Lightweight validator module
```

### Modified Files
```
src/editor/editor.js
├── Import addition: validateScene3D
├── exportAsScene3D(): Added async validation step
└── showValidationErrorsModal(): New modal implementation
```

### Dependencies
- **Zero third-party additions** (pure JavaScript as requested)
- **Schema served statically** via existing HTTP server
- **Modal system** uses existing editor UI patterns

---

## Acceptance Criteria Verification

✅ **Schema file**: `schemas/scene.3d.v1.schema.json` with comprehensive validation
✅ **Validator module**: `validateScene3D.js` with no third-party deps
✅ **Export integration**: Wired into existing 3D export flow before download
✅ **Error modal**: Shows first 5 errors with Cancel/Export anyway buttons
✅ **[VALIDATION] logging**: Consistent format with error count
✅ **Behavioral preservation**: Valid files export unchanged
✅ **Surgical scope**: No rendering logic touched, dto.type branching preserved

---

## Console Log Examples

### Valid Export
```
[EXPORT:3d] { filename: "scene.scene.3d.v1.json", tiles: 6, hEdges: 4, vEdges: 6, units: {...} }
[VALIDATION] { phase: "export", errors: 0 }
[EXPORT] { type: "scene-3d", warnings: [] }
[DOWNLOAD] { filename: "scene.scene.3d.v1.json" }
```

### Invalid Export (User Cancels)
```
[EXPORT:3d] { filename: "scene.scene.3d.v1.json", tiles: 6, hEdges: 4, vEdges: 6, units: {...} }
[VALIDATION] { phase: "export", errors: 3 }
// Modal shown, user clicks Cancel - no further logs
```

### Invalid Export (User Proceeds)
```
[EXPORT:3d] { filename: "scene.scene.3d.v1.json", tiles: 6, hEdges: 4, vEdges: 6, units: {...} }
[VALIDATION] { phase: "export", errors: 3 }
// Modal shown, user clicks "Export Anyway"
[EXPORT] { type: "scene-3d", warnings: [] }
[DOWNLOAD] { filename: "scene.scene.3d.v1.json" }
```

---

## Implementation Notes

**Performance**: Schema loaded once per validation, cached by browser
**Error Handling**: Graceful degradation if schema unavailable
**UX Consistency**: Modal styling matches existing warning patterns
**Maintainability**: Pure JavaScript validator, no build step dependencies

**Status**: Scene.3D.v1 JSON Schema validation fully implemented ✅
**Ready**: For production use with warn-only validation behavior