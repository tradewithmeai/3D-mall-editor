# 3D Base Template 🏗️

A powerful foundation for building 3D virtual environments with Three.js, featuring formal coordinate systems, comprehensive debug tools, and systematic development principles.

## 🌟 Features

### 🧭 **Formal Coordinate System**
- **Corner-based origin** (0,0,0) at Southwest corner
- **Compass wall references** (North, South, East, West)
- **Clear spatial language** for precise 3D building
- **40×30×8 unit lobby foundation** ready for expansion

### 🔴 **Advanced Debug System**
- **Laser grid visualization** - Red coordinate grids on all surfaces
- **Kick-to-toggle functionality** - Green debug ball toggles system on/off
- **Wall compass labels** - Clear directional indicators in debug mode
- **Reference pole** - Black marker at origin (0,0,0)

### 🎮 **Player System**
- **Progressive movement speed** - Slow start, 4x acceleration after 2 seconds
- **Proper collision detection** - Boundary constraints within room
- **Mouse look controls** - First-person camera movement
- **Physics integration** - Ready for interactive elements

### 🎨 **Clean Visual Foundation**
- **Pastel green floor** - Pleasant, professional appearance
- **Gray ceiling** - Neutral overhead surface
- **White walls** - Clean canvas for customization
- **Proper lighting system** - Ambient, directional, and mood lighting

### 🏢 **Mall Units Scaffold**
Optional units system for future mall logic development. Schema validation at [docs/schema/README.md](docs/schema/README.md). No changes to rendering. Editor unchanged.

Unit types (`retail`, `service`, `food`, `kiosk`, `corridor`) and occupancy rules (`vacant`, `occupied`, `reserved`) with enforced conditional requirements. Occupied units require `tenantId`, vacant units forbid `tenantId`/`since` fields. Full backward compatibility maintained.

## 🚀 **Quick Start**

1. **Clone the repository:**
   ```bash
   git clone https://github.com/tradewithmeai/3D-Base-Template.git
   cd 3D-Base-Template
   ```

2. **Start local server:**
   ```bash
   python -m http.server 8000
   ```

3. **Open in browser:**
   ```
   http://localhost:8000
   ```

4. **Activate debug mode:**
   - Walk up to the green glowing ball
   - Get close to kick it automatically
   - Red laser grids and compass labels will appear

## 🛠️ **Development Principles**

### **#Remember: Complete Removal Before Replacement**
Always remove ALL previous rendering and objects completely before adding new ones to prevent:
- Black screen crashes from conflicting geometry
- Z-fighting between old and new objects
- Memory leaks and performance issues

### **Systematic Building Approach**
1. **Plan with coordinate system** - Use formal spatial language
2. **Build incrementally** - Add one system at a time
3. **Test with debug mode** - Verify positioning and alignment
4. **Maintain clean code** - Remove unused objects completely

## 📐 **Coordinate System Reference**

```
Origin (0,0,0) = Southwest corner of room floor

X-axis: 0 to 40 (WEST → EAST)
Z-axis: 0 to 30 (SOUTH → NORTH)  
Y-axis: 0 to 8  (FLOOR → CEILING)

🧭 NORTH WALL: Z = 30 (back wall)
🧭 SOUTH WALL: Z = 0  (front wall)
🧭 EAST WALL:  X = 40 (right wall)
🧭 WEST WALL:  X = 0  (left wall)
```

## 🎯 **Controls**

- **WASD:** Movement (progressive speed)
- **Mouse:** Look around
- **E:** Interact with characters (when implemented)
- **Space:** Dance (when implemented)
- **Kick green ball:** Toggle debug mode

## 🏗️ **Building Your Project**

1. **Start with the foundation** - Room dimensions and coordinate system
2. **Add your content** - Use corner-based coordinates for positioning
3. **Test with debug mode** - Verify alignment with laser grids
4. **Customize materials** - Replace default floor/wall/ceiling materials
5. **Add interactions** - Build on the existing player and physics systems

## 📁 **Project Structure**

```
3D-Base-Template/
├── index.html          # Main application (complete 3D environment)
├── README.md           # This documentation
├── CLAUDE.md           # Development history and notes
└── .gitignore          # Git ignore rules
```

## 🎨 **Customization Examples**

### Change Room Dimensions
```javascript
const LOBBY_WIDTH = 60;   // X-axis: 0 to 60
const LOBBY_DEPTH = 40;   // Z-axis: 0 to 40  
const LOBBY_HEIGHT = 12;  // Y-axis: 0 to 12
```

### Add Custom Objects
```javascript
// Use corner-based coordinates
const customObject = new THREE.Mesh(geometry, material);
customObject.position.set(20, 2, 15); // Center of room, 2 units high
scene.add(customObject);
```

### Customize Floor Color
```javascript
// In the lobby floor section
color: 0x87CEEB,  // Sky blue instead of pastel green
```

## 🚀 **Ready-to-Use Features**

✅ **Coordinate system** - Formal spatial reference  
✅ **Debug visualization** - Laser grids and labels  
✅ **Player movement** - Progressive speed system  
✅ **Clean rendering** - Professional materials  
✅ **Lighting system** - Multi-layer illumination  
✅ **Physics foundation** - Ball physics and collision  
✅ **Modular architecture** - Easy to extend  

## 🎯 **Perfect For**

- **Virtual showrooms**
- **3D galleries** 
- **Interactive environments**
- **Architectural visualization**
- **Game development prototypes**
- **Educational 3D spaces**

## 🏆 **Development Philosophy**

**Professional Yet Systematic:** Balance between clean presentation and powerful development tools  
**Debug-First Development:** Always build with visualization and testing in mind  
**Formal Spatial Language:** Use precise coordinate terminology for clear communication  
**Incremental Building:** Start simple, add complexity systematically  

---

**Built with Three.js r128 | Ready for production deployment | Systematic 3D development foundation**

🌟 **Star this repo if it helps your 3D development projects!**