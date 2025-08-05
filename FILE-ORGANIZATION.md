# 3D Office - File Organization & Workflow

## 📁 Current Directory Structure

```
3D Office/
├── 📄 index.html                     # 🚀 PRODUCTION - Current live version
├── 📄 index.html.backup              # Working backup from July 20th 
├── 📄 index-original-backup.html     # Historical backup
├── 📁 backups/                       # 📦 Dated working versions
│   └── 2025-07-20-gallery-complete.html
├── 📁 archive/                       # 🗄️ Old tests & unused files (47 files)
│   ├── test-*.html (all test files)
│   ├── wall-test-*.html 
│   ├── debug-*.html
│   ├── experimental JS files
│   └── misc development files
├── 📁 images/                        # 🖼️ Gallery artwork files
├── 📄 CLAUDE.md                      # 📝 Development log
├── 📄 material-issues.md             # 🔧 Technical documentation
└── 📄 README.md                      # 📖 Project documentation
```

## 🏷️ File Naming Convention

### Production Files
- **`index.html`** - Current production version deployed to Vercel
- **`index.html.backup`** - Last known working version (safety net)

### Backup Files  
- **`backups/YYYY-MM-DD-feature-name.html`** - Dated working snapshots
  - Example: `2025-07-20-gallery-complete.html`
  - Example: `2025-08-04-factory-system.html`

### Development Files
- **`working-draft.html`** - Current development version (when needed)
- **`experimental-feature.html`** - Feature prototypes (move to archive when done)

### Archived Files (in `/archive/`)
- **`test-*.html`** - All experimental/test files  
- **`wall-test-*.html`** - Specific feature tests
- **`debug-*.html`** - Debugging/diagnostic files
- **`*.js`** - Experimental JavaScript modules
- **`*.json`** - Configuration experiments

## 🔄 Improved Development Workflow

### Before Starting Major Changes
1. **Create backup**: `cp index.html backups/YYYY-MM-DD-current-feature.html`
2. **Document current state** in CLAUDE.md
3. **Work in draft file** if major changes expected

### After Successful Development  
1. **Test thoroughly** in draft version
2. **Replace index.html** with working version
3. **Create new dated backup** 
4. **Update CLAUDE.md** with changes
5. **Commit to git** with descriptive message

### When Experiments Fail
1. **Move failed attempts** to `/archive/`
2. **Restore from backup** if needed  
3. **Document lessons learned** in CLAUDE.md

## 📊 Current File Status (as of 2025-08-04)

### ✅ Production Ready
- `index.html` - Current version (needs testing)
- `index.html.backup` - July 20th working version with gallery
- `backups/2025-07-20-gallery-complete.html` - Verified working backup

### 🗄️ Archived (47 files)
- All test-*.html files moved to archive
- All experimental JS files moved to archive  
- All debug/diagnostic files moved to archive
- Misc development files cleaned up

### 📝 Documentation
- `CLAUDE.md` - Complete development history
- `material-issues.md` - Technical issue documentation
- `FILE-ORGANIZATION.md` - This organization guide
- `README.md` - Project overview

---

## 🎯 Next Steps

1. **Test current index.html** to verify functionality
2. **If broken**: Restore from `index.html.backup` 
3. **Create working-draft.html** for future development
4. **Always backup before major changes**

*This organization prevents the loss of working versions and maintains a clean development environment.*