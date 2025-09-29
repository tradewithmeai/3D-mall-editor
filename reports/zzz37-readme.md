# zzz37 — Rules Switchboard Documentation

**Version**: 1.0
**Date**: 2025-09-29
**Purpose**: Per-rule enable/disable and mode control without code changes

---

## Overview

The Rules Switchboard provides centralized runtime control over validation rules in the 3D Mall Floorplan Editor. Rules can be enabled/disabled or forced to warn-only mode without modifying rule logic.

**Key Features**:
- ✅ Runtime rule configuration via JSON file
- ✅ Per-rule enable/disable toggles
- ✅ Mode control: 'warn' vs 'block' (future-ready)
- ✅ Graceful fallback to hardcoded defaults
- ✅ Startup console summary of rule states

---

## Quick Start

### Default Behavior
By default, all rules are enabled with current behavior:
- `unenclosed-floors`: enabled, warn-only
- `oob-content`: enabled, warn-only

### Toggling Rules
1. Create `/schemas/rules.switchboard.dev.json` in your project
2. Add rule configurations:

```json
{
  "unenclosed-floors": { "enabled": false },
  "oob-content": { "enabled": true, "mode": "warn" }
}
```

3. Reload the editor - changes take effect immediately

---

## Configuration Format

### File Location
`/schemas/rules.switchboard.dev.json` (optional development config)

### Schema
```json
{
  "<rule-id>": {
    "enabled": true|false,
    "mode": "warn"|"block"
  }
}
```

### Rule IDs
| Rule ID | Purpose | Default |
|---------|---------|---------|
| `unenclosed-floors` | Detect floor tiles missing perimeter walls | `enabled: true, mode: 'warn'` |
| `oob-content` | Detect content outside template boundaries | `enabled: true, mode: 'warn'` |

---

## Examples

### Disable Unenclosed Floor Warnings
```json
{
  "unenclosed-floors": { "enabled": false }
}
```

### Keep All Rules but Force Warn-Only
```json
{
  "unenclosed-floors": { "mode": "warn" },
  "oob-content": { "mode": "warn" }
}
```

### Future: Block Mode (when UI supports it)
```json
{
  "unenclosed-floors": { "mode": "block" }
}
```
*Note: Block mode will prevent exports when implemented in export UI*

---

## Console Output

### Startup Summary
The editor logs rule states at startup:
```
[RULES] Loaded dev config from schemas/rules.switchboard.dev.json
[RULES] Rule states: { unenclosed-floors: { enabled: true, mode: 'warn' }, ... }
[RULES] unenclosed-floors: enabled=true, mode=warn
[RULES] oob-content: enabled=true, mode=warn
```

### No Dev Config
```
[RULES] No dev config found, using defaults
[RULES] Rule states: { unenclosed-floors: { enabled: true, mode: 'warn' }, ... }
[RULES] unenclosed-floors: enabled=true, mode=warn
[RULES] oob-content: enabled=true, mode=warn
```

---

## Technical Implementation

### Files Modified
- `src/editor/core/RulesSwitchboard.js` - New switchboard module
- `src/editor/core/SceneRules.js` - Updated to check switchboard before rule execution
- `src/editor/editor.js` - Added switchboard initialization

### API
```javascript
import { isRuleEnabled, getRuleMode, getRuleConfig } from './core/RulesSwitchboard.js';

// Check if rule should run
if (isRuleEnabled('unenclosed-floors')) {
    // Execute rule logic
}

// Check rule mode for severity
const mode = getRuleMode('unenclosed-floors'); // 'warn' or 'block'
```

### Architecture
- **Singleton Pattern**: Global switchboard instance with lazy loading
- **Graceful Fallback**: Missing dev config file doesn't break anything
- **Runtime Config**: Changes take effect on page reload (no restart needed)
- **Future-Ready**: Block mode infrastructure ready for export UI integration

---

## Development Notes

### Adding New Rules
1. Add rule ID to `DEFAULT_RULES` in `RulesSwitchboard.js`
2. Update rule implementation to check `isRuleEnabled(ruleId)`
3. Update this documentation with new rule ID

### Testing Rule Changes
1. Create test config: `/schemas/rules.switchboard.dev.json`
2. Reload editor page
3. Check console for rule state confirmation
4. Verify rule behavior matches config

### Production Deployment
- Dev config file is optional and ignored in production
- All rules default to current production behavior
- No breaking changes to existing validation flow

---

## Troubleshooting

### Rule Not Disabled
- Check file path: `/schemas/rules.switchboard.dev.json` (not `schemas/` folder)
- Verify JSON syntax with online validator
- Check browser console for [RULES] loading messages
- Ensure rule ID matches exactly (case-sensitive)

### Console Errors
- File not found: Normal, falls back to defaults
- JSON parse error: Fix syntax in dev config file
- Unknown rule ID: Warning logged, rule ignored

### Cache Issues
- Hard refresh browser (Ctrl+F5)
- Check Network tab in DevTools for 304 vs 200 on JSON file
- Temporary: Add query parameter `?v=123` to config file URL

---

## Status

**Current**: Rules switchboard infrastructure complete
**Next**: Integration with export UI for block mode support

**Backwards Compatibility**: ✅ 100% - identical behavior with defaults
**Forward Compatibility**: ✅ Ready for block mode and additional rules