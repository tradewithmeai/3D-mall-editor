class FloorplanEditor {
    constructor() {
        this.canvas = document.getElementById('grid-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridWidth = 60;
        this.gridHeight = 40;
        this.cellSize = 20;
        this.currentTool = 'empty';
        this.isDrawing = false;
        
        // Hard data separation: sceneModel (user content) vs overlayModel (template constraints)
        this.sceneModel = {
            grid: this.createEmptyGrid(),
            horizontalEdges: this.createEmptyEdgeSet(this.gridWidth, this.gridHeight),
            verticalEdges: this.createEmptyEdgeSet(this.gridWidth, this.gridHeight)
        };

        this.overlayModel = {
            templateData: null,
            bounds: null,
            constraints: null
        };

        // Legacy properties for backwards compatibility (proxy to sceneModel)
        this.grid = this.sceneModel.grid;
        this.horizontalEdges = this.sceneModel.horizontalEdges;
        this.verticalEdges = this.sceneModel.verticalEdges;
        
        // Colors for different elements
        this.colors = {
            empty: '#f0f0f0',
            floor: '#8B4513'
        };
        
        // Template overlay state
        this.templateOverlay = null;
        this.showTemplate = false;
        this.templateType = null; // Track what type of template is loaded
        this.templateContext = {}; // Store template metadata

        // Unit overlay state
        this.unitsIndex = null;
        this.selectedUnit = null;
        this.unitOverlay = null;

        // Initialize MRU system early to prevent crashes
        this.initializeMRUSystem();

        // Unit boundary preference (default: true)
        this.showUnitBoundaries = true;

        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.setupMRUSystem();
        this.checkUrlParams();
        this.render();
        this.updateInfo();
    }
    
    createEmptyGrid() {
        const grid = [];
        for (let y = 0; y < this.gridHeight; y++) {
            grid[y] = [];
            for (let x = 0; x < this.gridWidth; x++) {
                grid[y][x] = 'empty';
            }
        }
        return grid;
    }
    
    createEmptyEdgeSet(width, height) {
        const edges = [];
        for (let y = 0; y < height; y++) {
            edges[y] = [];
            for (let x = 0; x < width; x++) {
                edges[y][x] = false;
            }
        }
        return edges;
    }
    
    setupEventListeners() {
        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelector('.tool-btn.active').classList.remove('active');
                e.target.classList.add('active');
                this.currentTool = e.target.dataset.tool;
                document.getElementById('current-tool').textContent = this.currentTool;
            });
        });
        
        // Canvas mouse events
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDrawing = true;
            this.handleMouseAction(e);
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDrawing) {
                this.handleMouseAction(e);
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.isDrawing = false;
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.isDrawing = false;
        });
        
        // File operations
        document.getElementById('import-btn').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
        
        document.getElementById('file-input').addEventListener('change', (e) => {
            this.importJSON(e);
        });
        
        document.getElementById('export-btn').addEventListener('click', () => {
            const exportType = document.getElementById('export-type').value;
            this.handleExport(exportType);
        });
        
        document.getElementById('clear-btn').addEventListener('click', () => {
            this.clearAll();
        });
        
        // Template overlay controls - dropdown system
        this.setupLoadTemplateDropdown();
        
        document.getElementById('toggle-template-btn')?.addEventListener('click', () => {
            this.toggleTemplate();
        });
        
        // Units index controls
        document.getElementById('load-units-btn')?.addEventListener('click', () => {
            this.loadUnitsIndex();
        });

        // Unit boundary toggle
        document.getElementById('show-unit-boundaries')?.addEventListener('change', (e) => {
            this.showUnitBoundaries = e.target.checked;
            console.log('Unit boundaries toggled:', this.showUnitBoundaries);
        });
        
        document.getElementById('unit-select')?.addEventListener('change', (e) => {
            this.selectUnit(e.target.value);
        });
    }
    
    handleMouseAction(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        if (this.currentTool === 'wall-edge' || this.currentTool === 'erase') {
            this.handleEdgePaint(mouseX, mouseY);
        } else {
            this.handleTilePaint(mouseX, mouseY);
        }
    }
    
    handleTilePaint(mouseX, mouseY) {
        const x = Math.floor(mouseX / this.cellSize);
        const y = Math.floor(mouseY / this.cellSize);

        if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
            // Check template bounds first
            if (!this.isWithinTemplateBounds(x, y)) {
                this.showTemplateBoundsViolation(x, y, 'tile');
                return;
            }

            // Only allow painting floors and empty tiles - no wall tiles
            if ((this.currentTool === 'floor' || this.currentTool === 'empty') && this.grid[y][x] !== this.currentTool) {
                this.setGridCell(x, y, this.currentTool);
                this.renderCell(x, y);
            }
        }
    }
    
    handleEdgePaint(mouseX, mouseY) {
        const edge = this.snapToNearestEdge(mouseX, mouseY);
        if (!edge) return;

        const { type, x, y } = edge;

        // Check template bounds for edge painting
        if (!this.isWithinTemplateBounds(x, y)) {
            this.showTemplateBoundsViolation(x, y, 'edge');
            return;
        }

        // Set edge state based on tool
        if (type === 'horizontal') {
            if (this.currentTool === 'wall-edge') {
                this.horizontalEdges[y][x] = true;
            } else if (this.currentTool === 'erase') {
                this.horizontalEdges[y][x] = false;
            }
        } else if (type === 'vertical') {
            if (this.currentTool === 'wall-edge') {
                this.verticalEdges[y][x] = true;
            } else if (this.currentTool === 'erase') {
                this.verticalEdges[y][x] = false;
            }
        }

        this.render(); // Full re-render to update edges
    }
    
    snapToNearestEdge(mouseX, mouseY) {
        const gridX = mouseX / this.cellSize;
        const gridY = mouseY / this.cellSize;
        
        const cellX = Math.floor(gridX);
        const cellY = Math.floor(gridY);
        
        const fracX = gridX - cellX;
        const fracY = gridY - cellY;
        
        const edgeThreshold = 0.3; // Distance threshold for snapping to edges
        
        let closestEdge = null;
        let minDistance = Infinity;
        
        // Check horizontal edges (top and bottom of current cell)
        // Top edge: between (cellX, cellY) and (cellX+1, cellY)
        if (cellY >= 0 && cellY < this.gridHeight && cellX >= 0 && cellX < this.gridWidth) {
            const distToTop = Math.abs(fracY);
            if (distToTop < edgeThreshold && distToTop < minDistance) {
                minDistance = distToTop;
                closestEdge = { type: 'horizontal', x: cellX, y: cellY };
            }
        }
        
        // Bottom edge: between (cellX, cellY+1) and (cellX+1, cellY+1)
        if (cellY >= -1 && cellY < this.gridHeight - 1 && cellX >= 0 && cellX < this.gridWidth) {
            const distToBottom = Math.abs(fracY - 1);
            if (distToBottom < edgeThreshold && distToBottom < minDistance) {
                minDistance = distToBottom;
                closestEdge = { type: 'horizontal', x: cellX, y: cellY + 1 };
            }
        }
        
        // Check vertical edges (left and right of current cell)
        // Left edge: between (cellX, cellY) and (cellX, cellY+1)
        if (cellY >= 0 && cellY < this.gridHeight && cellX >= 0 && cellX < this.gridWidth) {
            const distToLeft = Math.abs(fracX);
            if (distToLeft < edgeThreshold && distToLeft < minDistance) {
                minDistance = distToLeft;
                closestEdge = { type: 'vertical', x: cellX, y: cellY };
            }
        }
        
        // Right edge: between (cellX+1, cellY) and (cellX+1, cellY+1)
        if (cellY >= 0 && cellY < this.gridHeight && cellX >= -1 && cellX < this.gridWidth - 1) {
            const distToRight = Math.abs(fracX - 1);
            if (distToRight < edgeThreshold && distToRight < minDistance) {
                minDistance = distToRight;
                closestEdge = { type: 'vertical', x: cellX + 1, y: cellY };
            }
        }
        
        return closestEdge;
    }
    
    renderCell(x, y) {
        const color = this.colors[this.grid[y][x]];
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
        
        // Draw grid lines
        this.ctx.strokeStyle = '#ccc';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
    }
    
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render all cells (floors and wall tiles)
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                this.renderCell(x, y);
            }
        }
        
        // Render edges
        this.renderEdges();
        
        // Render template overlay
        this.renderTemplate();

        // Only render unit overlay if we don't have a template overlay active
        if (!this.overlayModel.templateData) {
            this.renderUnitOverlay();
        }
    }
    
    renderEdges() {
        // Render edges as thick black lines
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 3;
        
        // Render horizontal edges
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.horizontalEdges[y][x]) {
                    const startX = x * this.cellSize;
                    const endX = (x + 1) * this.cellSize;
                    const edgeY = y * this.cellSize;
                    
                    this.ctx.beginPath();
                    this.ctx.moveTo(startX, edgeY);
                    this.ctx.lineTo(endX, edgeY);
                    this.ctx.stroke();
                }
            }
        }
        
        // Render vertical edges
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.verticalEdges[y][x]) {
                    const edgeX = x * this.cellSize;
                    const startY = y * this.cellSize;
                    const endY = (y + 1) * this.cellSize;
                    
                    this.ctx.beginPath();
                    this.ctx.moveTo(edgeX, startY);
                    this.ctx.lineTo(edgeX, endY);
                    this.ctx.stroke();
                }
            }
        }
        
        // Show erase tool preview if active
        if (this.currentTool === 'erase' && this.isDrawing) {
            this.ctx.strokeStyle = '#ff0000';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            // Re-render current edge selection in red dashed line for erase preview
            this.ctx.setLineDash([]);
        }
    }
    
    renderTemplate() {
        // Render actual template boundaries from overlayModel based on template type
        if (!this.overlayModel.templateData) return;

        const templateData = this.overlayModel.templateData;

        this.ctx.save();
        this.ctx.strokeStyle = '#8B3AF9'; // Purple constraint boundary color
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.6;
        this.ctx.setLineDash([8, 4]);

        if (templateData.units && Array.isArray(templateData.units)) {
            // Mall template: show unit boundaries
            templateData.units.forEach(unit => {
                if (unit.rect) {
                    const { x, y, w, h } = unit.rect;
                    const pixelX = x * this.cellSize;
                    const pixelY = y * this.cellSize;
                    const pixelW = w * this.cellSize;
                    const pixelH = h * this.cellSize;

                    // Draw unit boundary rectangle
                    this.ctx.strokeRect(pixelX, pixelY, pixelW, pixelH);

                    // Draw unit ID label
                    this.ctx.save();
                    this.ctx.fillStyle = '#8B3AF9';
                    this.ctx.globalAlpha = 0.8;
                    this.ctx.font = '12px Arial';
                    this.ctx.fillText(unit.id, pixelX + 4, pixelY + 16);
                    this.ctx.restore();
                }
            });

            // Draw template info
            this.ctx.save();
            this.ctx.fillStyle = '#8B3AF9';
            this.ctx.globalAlpha = 0.8;
            this.ctx.font = '14px Arial';
            this.ctx.fillText(`Template: ${templateData.id} (${templateData.units.length} units)`, 10, 25);
            this.ctx.restore();

        } else if (templateData.meta && templateData.meta.schema === "gallery-template.v1") {
            // Gallery template: show the full gallery boundary (grid-relative coordinates)
            const { w, h } = templateData.rect;
            const pixelX = 0; // Start at grid origin
            const pixelY = 0; // Start at grid origin
            const pixelW = w * this.cellSize;
            const pixelH = h * this.cellSize;

            // Draw gallery boundary rectangle
            this.ctx.strokeRect(pixelX, pixelY, pixelW, pixelH);

            // Draw gallery ID label
            this.ctx.save();
            this.ctx.fillStyle = '#8B3AF9';
            this.ctx.globalAlpha = 0.8;
            this.ctx.font = '12px Arial';
            this.ctx.fillText(templateData.id, pixelX + 4, pixelY + 16);
            this.ctx.restore();

            // Draw template info
            this.ctx.save();
            this.ctx.fillStyle = '#8B3AF9';
            this.ctx.globalAlpha = 0.8;
            this.ctx.font = '14px Arial';
            const roomCount = templateData.rooms ? templateData.rooms.length : 0;
            this.ctx.fillText(`Gallery: ${templateData.id} (${roomCount} rooms)`, 10, 25);
            this.ctx.restore();

        } else if (templateData.meta && templateData.meta.schema === "room-template.v1") {
            // Room template: show room boundary and features (grid-relative coordinates)
            const { w, h } = templateData.rect;
            const pixelX = 0; // Start at grid origin
            const pixelY = 0; // Start at grid origin
            const pixelW = w * this.cellSize;
            const pixelH = h * this.cellSize;

            // Draw room boundary rectangle
            this.ctx.strokeRect(pixelX, pixelY, pixelW, pixelH);

            // Draw room features if available
            if (templateData.features) {
                // Draw floor zones if present
                if (templateData.features.floorZones) {
                    this.ctx.save();
                    this.ctx.strokeStyle = '#4CAF50'; // Green for floor zones
                    this.ctx.setLineDash([4, 2]);

                    templateData.features.floorZones.forEach(zone => {
                        if (zone.bounds) {
                            const { x: zx, y: zy, w: zw, h: zh } = zone.bounds;
                            const zonePixelX = zx * this.cellSize;
                            const zonePixelY = zy * this.cellSize;
                            const zonePixelW = zw * this.cellSize;
                            const zonePixelH = zh * this.cellSize;

                            this.ctx.strokeRect(zonePixelX, zonePixelY, zonePixelW, zonePixelH);

                            // Draw zone label
                            this.ctx.save();
                            this.ctx.fillStyle = '#4CAF50';
                            this.ctx.globalAlpha = 0.7;
                            this.ctx.font = '10px Arial';
                            this.ctx.fillText(zone.id, zonePixelX + 2, zonePixelY + 12);
                            this.ctx.restore();
                        }
                    });

                    this.ctx.restore();
                }

                // Draw wall features if present
                if (templateData.features.walls && templateData.features.walls.length > 0) {
                    this.ctx.save();
                    this.ctx.fillStyle = '#FF5722'; // Red-orange for walls
                    this.ctx.globalAlpha = 0.6;

                    templateData.features.walls.forEach(wall => {
                        const wallPixelX = wall.x * this.cellSize + this.cellSize / 4;
                        const wallPixelY = wall.y * this.cellSize + this.cellSize / 4;
                        const wallSize = this.cellSize / 2;

                        this.ctx.fillRect(wallPixelX, wallPixelY, wallSize, wallSize);
                    });

                    this.ctx.restore();
                }
            }

            // Draw room ID label
            this.ctx.save();
            this.ctx.fillStyle = '#8B3AF9';
            this.ctx.globalAlpha = 0.8;
            this.ctx.font = '12px Arial';
            this.ctx.fillText(templateData.id, pixelX + 4, pixelY + 16);
            this.ctx.restore();

            // Draw template info
            this.ctx.save();
            this.ctx.fillStyle = '#8B3AF9';
            this.ctx.globalAlpha = 0.8;
            this.ctx.font = '14px Arial';
            const featureCount = (templateData.features?.floorZones?.length || 0) + (templateData.features?.walls?.length || 0);
            this.ctx.fillText(`Template: ${templateData.id} (room - ${featureCount} features)`, 10, 25);
            this.ctx.restore();
        }

        this.ctx.restore();
    }
    
    clearAll() {
        // Clear sceneModel (user content) but preserve overlayModel (template constraints)
        this.sceneModel.grid = this.createEmptyGrid();
        this.sceneModel.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        this.sceneModel.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);

        // Update legacy references
        this.grid = this.sceneModel.grid;
        this.horizontalEdges = this.sceneModel.horizontalEdges;
        this.verticalEdges = this.sceneModel.verticalEdges;

        this.render();
    }
    
    updateInfo() {
        document.getElementById('grid-size').textContent = `${this.gridWidth}x${this.gridHeight}`;
        document.getElementById('cell-size').textContent = `${this.cellSize}px`;
        document.getElementById('current-tool').textContent = this.currentTool;
    }
    
    // Convert current state to instances for JSON export
    gridToInstances() {
        const instances = [];
        
        // Add reference pole
        instances.push({
            type: "referencePole",
            position: [0, 0.5, 0]
        });
        
        // First, rasterize edges to wall tiles using the specified rule
        const wallTiles = this.rasterizeEdgesToWalls();
        
        // Convert floors and rasterized walls to 3D instances
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const tileType = this.grid[y][x];
                const isWall = wallTiles[y][x];
                
                if (tileType === 'floor') {
                    instances.push({
                        type: "lobbyFloor",
                        position: [x * 2, 0, y * 2],
                        rotation: [-1.5707963267948966, 0, 0]
                    });
                } else if (isWall) {
                    // Only walls from edges get exported, no tile-based walls
                    instances.push({
                        type: "lobbyWall",
                        position: [x * 2, 4, y * 2],
                        rotation: [0, 0, 0]
                    });
                }
            }
        }
        
        return instances;
    }
    
    // Rasterize edges back to wall tiles for export
    rasterizeEdgesToWalls() {
        const wallTiles = [];
        for (let y = 0; y < this.gridHeight; y++) {
            wallTiles[y] = [];
            for (let x = 0; x < this.gridWidth; x++) {
                wallTiles[y][x] = false;
            }
        }
        
        // For horizontal edges H(x,y), mark tile (x, y-1) as wall if in bounds
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.horizontalEdges[y][x]) {
                    if (y - 1 >= 0) {
                        wallTiles[y - 1][x] = true;
                    }
                }
            }
        }
        
        // For vertical edges V(x,y), mark tile (x-1, y) as wall if in bounds
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.verticalEdges[y][x]) {
                    if (x - 1 >= 0) {
                        wallTiles[y][x - 1] = true;
                    }
                }
            }
        }
        
        return wallTiles;
    }
    
    // Import instances and reconstruct edges heuristically
    instancesToGrid(instances) {
        const newGrid = this.createEmptyGrid();
        const newHorizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        const newVerticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        
        // First pass: extract floors from instances, ignore wall tiles
        instances.forEach(instance => {
            if (instance.position && instance.type) {
                const [worldX, worldY, worldZ] = instance.position;
                const gridX = Math.floor(worldX / 2);
                const gridY = Math.floor(worldZ / 2);
                
                if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
                    if (instance.type === 'lobbyFloor') {
                        newGrid[gridY][gridX] = 'floor';
                    }
                    // No longer import wall tiles - they become edges only
                }
            }
        });
        
        // Second pass: reconstruct edges from wall tiles heuristically
        const wallPositions = new Set();
        instances.forEach(instance => {
            if (instance.position && instance.type && this.isWallType(instance.type)) {
                const [worldX, worldY, worldZ] = instance.position;
                const gridX = Math.floor(worldX / 2);
                const gridY = Math.floor(worldZ / 2);
                
                if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
                    wallPositions.add(`${gridX},${gridY}`);
                }
            }
        });
        
        // Reconstruct edges from wall positions
        for (const posKey of wallPositions) {
            const [x, y] = posKey.split(',').map(Number);
            this.reconstructEdgesFromWall(x, y, wallPositions, newHorizontalEdges, newVerticalEdges);
        }
        
        return { grid: newGrid, horizontalEdges: newHorizontalEdges, verticalEdges: newVerticalEdges };
    }
    
    reconstructEdgesFromWall(x, y, wallPositions, horizontalEdges, verticalEdges) {
        // Check 4 borders of this wall tile and create edges where appropriate
        
        // Top edge: horizontal edge at (x, y)
        if (!wallPositions.has(`${x},${y-1}`)) {
            horizontalEdges[y][x] = true;
        }
        
        // Bottom edge: horizontal edge at (x, y+1)
        if (y + 1 < this.gridHeight && !wallPositions.has(`${x},${y+1}`)) {
            horizontalEdges[y + 1][x] = true;
        }
        
        // Left edge: vertical edge at (x, y)
        if (!wallPositions.has(`${x-1},${y}`)) {
            verticalEdges[y][x] = true;
        }
        
        // Right edge: vertical edge at (x+1, y)
        if (x + 1 < this.gridWidth && !wallPositions.has(`${x+1},${y}`)) {
            verticalEdges[y][x + 1] = true;
        }
    }
    
    isWallType(instanceType) {
        const wallTypes = [
            'lobbyWall',
            'lobbyNorthWall', 
            'lobbySouthWall',
            'lobbyEastWall',
            'lobbyWestWall'
        ];
        return wallTypes.includes(instanceType);
    }
    
    // Convert current editor state to scene.v1 format
    toSceneV1() {
        const now = new Date().toISOString();

        // Convert grid data to coordinate arrays
        const floorTiles = [];
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.grid[y][x] === 'floor') {
                    floorTiles.push([x, y]);
                }
            }
        }

        // Convert edge data to coordinate arrays
        const horizontalEdges = [];
        const verticalEdges = [];

        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.horizontalEdges[y] && this.horizontalEdges[y][x]) {
                    horizontalEdges.push([x, y]);
                }
                if (this.verticalEdges[y] && this.verticalEdges[y][x]) {
                    verticalEdges.push([x, y]);
                }
            }
        }

        return {
            meta: {
                schema: "scene.v1",
                version: "1.0",
                created: now,
                modified: now
            },
            grid: {
                width: this.gridWidth,
                height: this.gridHeight,
                cellSize: this.cellSize
            },
            tiles: {
                floor: floorTiles
            },
            edges: {
                horizontal: horizontalEdges,
                vertical: verticalEdges
            }
        };
    }

    // Convert scene.v1 format to editor state
    fromSceneV1(sceneData) {
        // Validate basic structure
        if (!sceneData.meta || sceneData.meta.schema !== "scene.v1") {
            throw new Error('Invalid scene.v1 format');
        }
        if (!sceneData.grid) {
            throw new Error('Missing grid data in scene.v1');
        }

        // Update grid dimensions
        this.gridWidth = sceneData.grid.width;
        this.gridHeight = sceneData.grid.height;
        this.cellSize = sceneData.grid.cellSize;

        // Initialize empty grids
        this.grid = this.createEmptyGrid();
        this.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        this.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);

        // Load floor tiles
        if (sceneData.tiles && sceneData.tiles.floor) {
            sceneData.tiles.floor.forEach(([x, y]) => {
                if (y < this.gridHeight && x < this.gridWidth) {
                    this.grid[y][x] = 'floor';
                }
            });
        }

        // Load edges
        if (sceneData.edges) {
            if (sceneData.edges.horizontal) {
                sceneData.edges.horizontal.forEach(([x, y]) => {
                    if (y < this.gridHeight && x < this.gridWidth) {
                        this.horizontalEdges[y][x] = true;
                    }
                });
            }
            if (sceneData.edges.vertical) {
                sceneData.edges.vertical.forEach(([x, y]) => {
                    if (y < this.gridHeight && x < this.gridWidth) {
                        this.verticalEdges[y][x] = true;
                    }
                });
            }
        }
    }

    // Handle different export types based on dropdown selection
    handleExport(exportType) {
        switch (exportType) {
            case 'scene':
                this.exportAsScene();
                break;
            case 'mall-template':
                this.exportAsMallTemplate();
                break;
            case 'gallery-template':
                this.exportAsGalleryTemplate();
                break;
            case 'room-template':
                this.exportAsRoomTemplate();
                break;
            default:
                this.exportAsScene();
        }
    }

    // Export as Mall Template format for unit splitting workflow
    exportAsMallTemplate() {
        // Generate a unique mall ID with timestamp
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
        const mallId = `mall-${timestamp}`;

        // Detect units from connected floor regions
        const units = this.detectUnitsFromFloorTiles();

        // Validate minimum unit requirement
        if (units.length === 0) {
            alert('No units detected; draw floor tiles first.');
            console.warn('Export blocked: No units found in current design');
            return;
        }

        // Create proper mall-template.v1 schema
        const mallTemplate = {
            meta: {
                schema: "mall-template.v1",
                version: "1.0",
                name: "Generated Mall Template"
            },
            id: mallId,
            grid: {
                width: this.gridWidth,
                height: this.gridHeight,
                cellSize: this.cellSize
            },
            units: units,
            created: new Date().toISOString()
        };

        // Add legacy metadata if available
        if (this.templateOverlay && this.templateOverlay.parentMallId) {
            mallTemplate.meta.basedOn = this.templateOverlay.parentMallId;
        }

        // Validate template before saving
        try {
            this.validateWithAJV(mallTemplate, 'mall-template.v1');
            console.log('✅ Mall template validation passed');
        } catch (error) {
            alert(`Export failed: ${error.message}`);
            console.error('❌ Mall template validation failed:', error);
            return;
        }

        const dataStr = JSON.stringify(mallTemplate, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${mallId}.json`;
        link.click();

        console.log('Exported mall template:', mallTemplate);
        alert(`Mall template saved (${units.length} units detected)\\nReady for template loading workflow`);
    }

    // Calculate template bounds for overlay constraints
    calculateTemplateBounds(templateData) {
        if (!templateData.units || !Array.isArray(templateData.units)) {
            return null;
        }

        return templateData.units.map(unit => ({
            id: unit.id,
            rect: unit.rect
        }));
    }

    // Build template constraints from template data
    buildTemplateConstraints(templateData) {
        const constraints = {
            allowedAreas: [],
            boundaryPoints: []
        };

        if (templateData.units && Array.isArray(templateData.units)) {
            templateData.units.forEach(unit => {
                if (unit.rect) {
                    constraints.allowedAreas.push(unit.rect);
                }
            });
        }

        return constraints;
    }

    // Calculate gallery template bounds for overlay constraints
    calculateGalleryTemplateBounds(templateData) {
        if (!templateData.rect) {
            return null;
        }

        return [{
            id: templateData.id,
            rect: templateData.rect
        }];
    }

    // Build gallery template constraints from template data
    buildGalleryTemplateConstraints(templateData) {
        const constraints = {
            allowedAreas: [],
            boundaryPoints: []
        };

        if (templateData.rect) {
            constraints.allowedAreas.push(templateData.rect);
        }

        return constraints;
    }

    // Calculate room template bounds for overlay constraints
    calculateRoomTemplateBounds(templateData) {
        if (!templateData.rect) {
            return null;
        }

        return [{
            id: templateData.id,
            rect: templateData.rect
        }];
    }

    // Build room template constraints from template data
    buildRoomTemplateConstraints(templateData) {
        const constraints = {
            allowedAreas: [],
            boundaryPoints: [],
            features: templateData.features || {}
        };

        if (templateData.rect) {
            constraints.allowedAreas.push(templateData.rect);
        }

        // Add room feature constraints if available
        if (templateData.features && templateData.features.floorZones) {
            templateData.features.floorZones.forEach(zone => {
                if (zone.bounds) {
                    constraints.allowedAreas.push(zone.bounds);
                }
            });
        }

        return constraints;
    }

    // Authoritative grid cell setter with constraint enforcement
    setGridCell(x, y, value) {
        // Final authoritative check - prevent any bypasses
        if (!this.isWithinTemplateBounds(x, y)) {
            console.warn(`Blocked grid write at (${x},${y}) - outside template bounds`);
            this.showTemplateBoundsViolation(x, y, 'tile');
            return false;
        }

        // Perform the grid write
        this.grid[y][x] = value;
        return true;
    }

    // Detect units from connected floor tile regions
    detectUnitsFromFloorTiles() {
        const units = [];
        const visited = Array(this.gridHeight).fill().map(() => Array(this.gridWidth).fill(false));
        let unitCounter = 1;

        // Scan grid for floor tiles and detect connected regions
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.grid[y][x] === 'floor' && !visited[y][x]) {
                    // Found unvisited floor tile - start a new unit region
                    const unitArea = this.floodFillRoom(x, y, visited);
                    if (unitArea.length > 0) {
                        const bounds = this.calculateRoomBounds(unitArea);

                        // Apply minimum size filtering (w>=2 && h>=2)
                        if (bounds.w >= 2 && bounds.h >= 2) {
                            units.push({
                                id: `unit-${String(unitCounter).padStart(3, '0')}`,
                                rect: {
                                    x: bounds.x,
                                    y: bounds.y,
                                    w: bounds.w,
                                    h: bounds.h
                                }
                            });
                            unitCounter++;
                        } else {
                            console.info(`Filtered out unit region too small: ${bounds.w}x${bounds.h} at (${bounds.x},${bounds.y})`);
                        }
                    }
                }
            }
        }

        // Sort units by top-to-bottom, then left-to-right for stable ordering
        units.sort((a, b) => {
            if (a.rect.y !== b.rect.y) return a.rect.y - b.rect.y;
            return a.rect.x - b.rect.x;
        });

        // Regenerate IDs to maintain stable ordering
        units.forEach((unit, index) => {
            unit.id = `unit-${String(index + 1).padStart(3, '0')}`;
        });

        return units;
    }

    // Export as Gallery Template format with parent relationship
    exportAsGalleryTemplate() {
        // Generate a unique gallery ID
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
        const galleryId = `gallery-${timestamp}`;

        // Determine parent mall ID
        let parentMallId = 'mall-unknown';
        if (this.overlayModel.templateData && this.overlayModel.templateData.id) {
            parentMallId = this.overlayModel.templateData.id;
        } else if (this.templateContext && this.templateContext.id) {
            parentMallId = this.templateContext.id;
        }

        // Get gallery boundaries from current template context
        let galleryRect = { x: 0, y: 0, w: this.gridWidth, h: this.gridHeight };

        // If we have mall template context, get the specific unit boundaries
        if (this.overlayModel.templateData && this.overlayModel.templateData.units) {
            // For now, use first unit as example - in practice user would select which unit
            const firstUnit = this.overlayModel.templateData.units[0];
            if (firstUnit && firstUnit.rect) {
                galleryRect = firstUnit.rect;
            }
        }

        // Convert current editor content to room definitions
        const rooms = this.generateRoomsFromCurrentContent();

        const galleryTemplate = {
            meta: {
                schema: "gallery-template.v1",
                version: "1.0",
                name: `Gallery Template ${galleryId}`
            },
            id: galleryId,
            parentMallId: parentMallId,
            rect: galleryRect,
            rooms: rooms,
            created: new Date().toISOString()
        };

        const dataStr = JSON.stringify(galleryTemplate, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${galleryId}.json`;
        link.click();

        console.log('Exported gallery template:', galleryTemplate);
        alert(`Gallery template exported as ${galleryId}.json\\nParent: ${parentMallId}`);
    }

    // Export as Room Template format with parent relationship
    exportAsRoomTemplate() {
        // Generate a unique room ID
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
        const roomId = `room-${timestamp}`;

        // Determine parent gallery ID
        let parentGalleryId = 'gallery-unknown';

        // Debug logging
        console.log('Room export - Debug overlayModel:', this.overlayModel);
        console.log('Room export - Debug templateContext:', this.templateContext);
        console.log('Room export - Debug templateType:', this.templateType);

        if (this.overlayModel.templateData && this.overlayModel.templateData.id) {
            const templateId = this.overlayModel.templateData.id;
            // Ensure the parent ID has the correct gallery- prefix for validation
            parentGalleryId = templateId.startsWith('gallery-') ? templateId : `gallery-${templateId}`;
            console.log('Room export - Using overlayModel.templateData.id:', templateId, '-> parentGalleryId:', parentGalleryId);
        } else if (this.templateContext && this.templateContext.id) {
            const templateId = this.templateContext.id;
            // Ensure the parent ID has the correct gallery- prefix for validation
            parentGalleryId = templateId.startsWith('gallery-') ? templateId : `gallery-${templateId}`;
            console.log('Room export - Using templateContext.id:', templateId, '-> parentGalleryId:', parentGalleryId);
        } else {
            console.warn('Room export - No valid parent gallery ID found, using default:', parentGalleryId);
        }

        // Calculate room boundaries based on current content or template
        let roomRect = { x: 0, y: 0, w: this.gridWidth, h: this.gridHeight };

        // If we have template overlay, use it to constrain room bounds
        if (this.templateOverlay) {
            roomRect = {
                x: 0,
                y: 0,
                w: Math.min(this.gridWidth, this.templateOverlay.width || this.gridWidth),
                h: Math.min(this.gridHeight, this.templateOverlay.height || this.gridHeight)
            };
        }

        // Convert current editor content to room features (walls, furniture zones, etc.)
        const roomFeatures = this.generateRoomFeaturesFromCurrentContent();

        const roomTemplate = {
            meta: {
                schema: "room-template.v1",
                version: "1.0",
                name: `Room Template ${roomId}`
            },
            id: roomId,
            parentGalleryId: parentGalleryId,
            rect: roomRect,
            features: roomFeatures,
            created: new Date().toISOString()
        };

        const dataStr = JSON.stringify(roomTemplate, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${roomId}.json`;
        link.click();

        console.log('Exported room template:', roomTemplate);
        alert(`Room template exported as ${roomId}.json\nParent: ${parentGalleryId}`);
    }

    // Generate room features from current editor content
    generateRoomFeaturesFromCurrentContent() {
        const features = {
            walls: [],
            floorAreas: [],
            furnishing: []
        };

        // Analyze current grid content to identify room features
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const cellValue = this.grid[y][x];

                switch (cellValue) {
                    case 'wall-edge':
                        features.walls.push({ x, y, type: 'wall' });
                        break;
                    case 'floor':
                        features.floorAreas.push({ x, y, type: 'floor' });
                        break;
                    // Add more feature types as needed
                }
            }
        }

        // Group connected floor areas into zones
        const floorZones = this.groupFloorAreasIntoZones(features.floorAreas);
        features.floorZones = floorZones;

        // Clean up individual floor points since we now have zones
        delete features.floorAreas;

        return features;
    }

    // Group connected floor areas into logical zones
    groupFloorAreasIntoZones(floorAreas) {
        const zones = [];
        const visited = new Set();

        floorAreas.forEach((floor) => {
            const key = `${floor.x},${floor.y}`;
            if (visited.has(key)) return;

            // Find connected floor area using flood fill
            const zone = this.findConnectedFloorArea(floor.x, floor.y, floorAreas, visited);
            if (zone.length > 0) {
                const bounds = this.calculateAreaBounds(zone);
                zones.push({
                    id: `zone-${zones.length + 1}`,
                    bounds: bounds,
                    tiles: zone.length,
                    type: 'floor-zone'
                });
            }
        });

        return zones;
    }

    // Find connected floor area starting from given coordinates
    findConnectedFloorArea(startX, startY, floorAreas, visited) {
        const zone = [];
        const stack = [[startX, startY]];
        const floorMap = new Map();

        // Create lookup map for faster access
        floorAreas.forEach(floor => {
            floorMap.set(`${floor.x},${floor.y}`, floor);
        });

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const key = `${x},${y}`;

            if (visited.has(key) || !floorMap.has(key)) continue;

            visited.add(key);
            zone.push({ x, y });

            // Add adjacent cells
            [[x+1,y], [x-1,y], [x,y+1], [x,y-1]].forEach(([nx, ny]) => {
                const neighborKey = `${nx},${ny}`;
                if (!visited.has(neighborKey) && floorMap.has(neighborKey)) {
                    stack.push([nx, ny]);
                }
            });
        }

        return zone;
    }

    // Calculate bounds for an area of tiles
    calculateAreaBounds(area) {
        if (area.length === 0) return { x: 0, y: 0, w: 0, h: 0 };

        let minX = area[0].x, maxX = area[0].x;
        let minY = area[0].y, maxY = area[0].y;

        area.forEach(({ x, y }) => {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        });

        return {
            x: minX,
            y: minY,
            w: maxX - minX + 1,
            h: maxY - minY + 1
        };
    }

    // Generate room definitions from current editor content
    generateRoomsFromCurrentContent() {
        const rooms = [];

        // Simple room detection: find connected floor areas
        const visited = Array(this.gridHeight).fill().map(() => Array(this.gridWidth).fill(false));
        let roomCounter = 1;

        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.grid[y][x] === 'floor' && !visited[y][x]) {
                    // Found unvisited floor tile - start a new room
                    const roomArea = this.floodFillRoom(x, y, visited);
                    if (roomArea.length > 0) {
                        const bounds = this.calculateRoomBounds(roomArea);
                        rooms.push({
                            id: `room-${roomCounter}`,
                            gridRect: bounds
                        });
                        roomCounter++;
                    }
                }
            }
        }

        // If no rooms found, create a single room covering the whole area
        if (rooms.length === 0) {
            rooms.push({
                id: 'room-1',
                gridRect: { x: 0, y: 0, w: this.gridWidth, h: this.gridHeight }
            });
        }

        return rooms;
    }

    // Flood fill to find connected floor tiles for room detection
    floodFillRoom(startX, startY, visited) {
        const roomTiles = [];
        const stack = [[startX, startY]];

        while (stack.length > 0) {
            const [x, y] = stack.pop();

            if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) continue;
            if (visited[y][x] || this.grid[y][x] !== 'floor') continue;

            visited[y][x] = true;
            roomTiles.push([x, y]);

            // Add neighbors
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }

        return roomTiles;
    }

    // Calculate bounding rectangle for room tiles
    calculateRoomBounds(roomTiles) {
        if (roomTiles.length === 0) return { x: 0, y: 0, w: 1, h: 1 };

        let minX = roomTiles[0][0], maxX = roomTiles[0][0];
        let minY = roomTiles[0][1], maxY = roomTiles[0][1];

        roomTiles.forEach(([x, y]) => {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        });

        return {
            x: minX,
            y: minY,
            w: maxX - minX + 1,
            h: maxY - minY + 1
        };
    }

    // Export as Scene v1 format (renamed from exportJSON)
    exportAsScene() {
        // Export using scene.v1 format
        const sceneData = this.toSceneV1();

        const dataStr = JSON.stringify(sceneData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'scene.json';
        link.click();

        console.log('Exported scene.v1:', sceneData);
    }

    // Keep the old method for backward compatibility
    exportJSON() {
        this.exportAsScene();
    }

    // Update export dropdown options based on current template context
    updateExportOptions() {
        const exportSelect = document.getElementById('export-type');
        if (!exportSelect) return;

        // Reset options
        exportSelect.innerHTML = `
            <option value="scene">Export Scene (v1)</option>
            <option value="mall-template">Export as Mall Template</option>
            <option value="gallery-template">Export as Gallery Template</option>
            <option value="room-template">Export as Room Template</option>
        `;

        // Set default based on current template context
        if (this.templateType === 'mall') {
            exportSelect.value = 'gallery-template'; // Mall templates typically create gallery templates
            exportSelect.style.backgroundColor = '#e8f4fd'; // Light blue to indicate context
        } else if (this.templateType === 'gallery') {
            exportSelect.value = 'scene'; // Gallery templates typically create room scenes
            exportSelect.style.backgroundColor = '#f0f8e8'; // Light green to indicate context
        } else {
            exportSelect.value = 'scene'; // Default to scene export
            exportSelect.style.backgroundColor = ''; // Default styling
        }
    }
    
    // Detect format and convert to scene.v1
    detectAndConvertFormat(jsonData) {
        // Check if it's already scene.v1
        if (jsonData.meta && jsonData.meta.schema === "scene.v1") {
            return jsonData;
        }

        // Check if it's a mall template format - LOAD AS OVERLAY CONSTRAINTS, NOT CONTENT
        if (jsonData.grid && jsonData.id && jsonData.id.startsWith('mall-')) {
            // Validate mall template structure
            this.validateMallTemplate(jsonData);

            // Store template in overlayModel (constraints), not as scene content
            this.overlayModel.templateData = jsonData;
            this.overlayModel.bounds = this.calculateTemplateBounds(jsonData);
            this.overlayModel.constraints = this.buildTemplateConstraints(jsonData);

            // Set template context
            this.templateType = 'mall';
            this.templateContext = {
                id: jsonData.id,
                originalData: jsonData,
                loadedAt: new Date().toISOString()
            };

            // Enable template display by default
            this.showTemplate = true;

            console.log('Mall template loaded as overlay constraints:', jsonData.id);

            // Return EMPTY scene.v1 for user to create content within template bounds
            return {
                meta: {
                    schema: "scene.v1",
                    version: "1.0",
                    created: new Date().toISOString(),
                    modified: new Date().toISOString()
                },
                grid: jsonData.grid,
                tiles: { floor: [] }, // Empty - user creates content
                edges: { horizontal: [], vertical: [] } // Empty - user creates content
            };
        }

        // Check if it's a gallery template format
        if (jsonData.meta && jsonData.meta.schema === "gallery-template.v1" && jsonData.id && jsonData.id.startsWith('gallery-')) {
            // Validate gallery template structure
            this.validateGalleryTemplate(jsonData);

            // Set template context for gallery template
            this.templateType = 'gallery';
            this.templateContext = {
                id: jsonData.id,
                parentMallId: jsonData.parentMallId,
                originalData: jsonData,
                loadedAt: new Date().toISOString()
            };

            // Store template in overlayModel (constraints), not as scene content
            this.overlayModel.templateData = jsonData;
            this.overlayModel.bounds = this.calculateGalleryTemplateBounds(jsonData);
            this.overlayModel.constraints = this.buildGalleryTemplateConstraints(jsonData);

            // Enable template display by default
            this.showTemplate = true;

            console.log('Gallery template loaded as overlay constraints:', jsonData.id);

            // Update grid dimensions to match gallery template boundaries
            if (jsonData.rect) {
                this.gridWidth = jsonData.rect.w;
                this.gridHeight = jsonData.rect.h;
                this.cellSize = 20;
            }

            // Return EMPTY scene.v1 for user to create content within template bounds
            return {
                meta: {
                    schema: "scene.v1",
                    version: "1.0",
                    created: new Date().toISOString(),
                    modified: new Date().toISOString()
                },
                grid: {
                    width: this.gridWidth,
                    height: this.gridHeight,
                    cellSize: this.cellSize
                },
                tiles: { floor: [] }, // Empty - user creates content
                edges: { horizontal: [], vertical: [] } // Empty - user creates content
            };
        }

        // Check if it's a room template format
        if (jsonData.meta && jsonData.meta.schema === "room-template.v1" && jsonData.id && jsonData.id.startsWith('room-')) {
            // Validate room template structure
            this.validateRoomTemplate(jsonData);

            // Set template context for room template
            this.templateType = 'room';
            this.templateContext = {
                id: jsonData.id,
                parentGalleryId: jsonData.parentGalleryId,
                originalData: jsonData,
                loadedAt: new Date().toISOString()
            };

            // Store template in overlayModel (constraints), not as scene content
            this.overlayModel.templateData = jsonData;
            this.overlayModel.bounds = this.calculateRoomTemplateBounds(jsonData);
            this.overlayModel.constraints = this.buildRoomTemplateConstraints(jsonData);

            // Enable template display by default
            this.showTemplate = true;

            console.log('Room template loaded as overlay constraints:', jsonData.id);

            // Update grid dimensions to match room template boundaries
            if (jsonData.rect) {
                this.gridWidth = jsonData.rect.w;
                this.gridHeight = jsonData.rect.h;
                this.cellSize = 20;
            }

            // Return EMPTY scene.v1 for user to create content within template bounds
            return {
                meta: {
                    schema: "scene.v1",
                    version: "1.0",
                    created: new Date().toISOString(),
                    modified: new Date().toISOString()
                },
                grid: {
                    width: this.gridWidth,
                    height: this.gridHeight,
                    cellSize: this.cellSize
                },
                tiles: { floor: [] }, // Empty - user creates content
                edges: { horizontal: [], vertical: [] } // Empty - user creates content
            };
        }

        // Check if it's legacy instances format
        if (jsonData.instances && Array.isArray(jsonData.instances)) {
            // Convert legacy instances to scene.v1
            const result = this.instancesToGrid(jsonData.instances);

            // Convert the grid arrays back to coordinate format
            const floorTiles = [];
            const horizontalEdges = [];
            const verticalEdges = [];

            for (let y = 0; y < this.gridHeight; y++) {
                for (let x = 0; x < this.gridWidth; x++) {
                    if (result.grid[y] && result.grid[y][x] === 'floor') {
                        floorTiles.push([x, y]);
                    }
                    if (result.horizontalEdges[y] && result.horizontalEdges[y][x]) {
                        horizontalEdges.push([x, y]);
                    }
                    if (result.verticalEdges[y] && result.verticalEdges[y][x]) {
                        verticalEdges.push([x, y]);
                    }
                }
            }

            return {
                meta: {
                    schema: "scene.v1",
                    version: "1.0",
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                    convertedFrom: "legacy-instances"
                },
                grid: {
                    width: this.gridWidth,
                    height: this.gridHeight,
                    cellSize: this.cellSize
                },
                tiles: { floor: floorTiles },
                edges: { horizontal: horizontalEdges, vertical: verticalEdges }
            };
        }

        throw new Error('Unrecognized JSON format. Expected scene.v1, mall template, or legacy instances format.');
    }

    async importJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const jsonData = JSON.parse(text);

            // Detect format and convert to scene.v1
            const sceneData = this.detectAndConvertFormat(jsonData);

            // Load the scene.v1 data
            this.fromSceneV1(sceneData);
            this.updateInfo(); // Update UI with new grid dimensions
            this.updateExportOptions(); // Update export options based on template context
            this.render();

            console.log('Imported and converted to scene.v1:', sceneData);

            // Show conversion info to user
            const templateInfo = this.templateType ? ` (${this.templateType} template context)` : '';
            if (sceneData.meta.convertedFrom) {
                alert(`File imported and converted from ${sceneData.meta.convertedFrom} format to scene.v1${templateInfo}`);
            } else {
                alert(`Scene.v1 file imported successfully${templateInfo}`);
            }

        } catch (error) {
            alert('Error reading JSON file: ' + error.message);
            console.error('Import error:', error);
        }
    }
    
    async loadTemplate() {
        try {
            const response = await fetch('/floor-plans/mall/mall.json');
            const templateData = await response.json();
            
            if (templateData.grid) {
                this.templateOverlay = templateData.grid;
                this.showTemplate = true;

                // Set template context
                this.templateType = 'mall';
                this.templateContext = {
                    id: templateData.id,
                    originalData: templateData,
                    loadedAt: new Date().toISOString()
                };

                this.render();
                console.log('Mall template loaded:', templateData);

                // Update toggle button text and show it
                const toggleBtn = document.getElementById('toggle-template-btn');
                if (toggleBtn) {
                    toggleBtn.textContent = 'Hide Template';
                    toggleBtn.style.display = 'inline-block';
                }

                // Update export dropdown default
                this.updateExportOptions();
            } else {
                alert('Invalid template format. Expected "grid" property.');
            }
        } catch (error) {
            alert('Error loading template: ' + error.message);
            console.error('Template load error:', error);
        }
    }
    
    toggleTemplate() {
        if (this.overlayModel.templateData) {
            this.showTemplate = !this.showTemplate;
            this.render();

            // Update button text
            const toggleBtn = document.getElementById('toggle-template-btn');
            if (toggleBtn) {
                toggleBtn.textContent = this.showTemplate ? 'Hide Template' : 'Show Template';
            }
        } else {
            alert('No template loaded. Load a template first.');
        }
    }
    
    async loadUnitsIndex() {
        try {
            const response = await fetch('/floor-plans/mall/units-index.json');
            const indexData = await response.json();
            
            if (indexData.units && Array.isArray(indexData.units)) {
                this.unitsIndex = indexData.units;
                console.log(`Units index loaded: ${this.unitsIndex.length} entries`);
                
                // Populate dropdown
                const unitSelect = document.getElementById('unit-select');
                if (unitSelect) {
                    // Clear existing options except the first one
                    unitSelect.innerHTML = '<option value="">Select Unit...</option>';
                    
                    // Add unit options
                    this.unitsIndex.forEach(unit => {
                        const option = document.createElement('option');
                        option.value = unit.id;
                        option.textContent = unit.id;
                        unitSelect.appendChild(option);
                    });
                    
                    unitSelect.style.display = 'inline-block';
                }
            } else {
                alert('Invalid units index format. Expected "units" array.');
            }
        } catch (error) {
            alert('Error loading units index: ' + error.message);
            console.error('Units index load error:', error);
        }
    }
    
    selectUnit(unitId) {
        if (!unitId) {
            this.selectedUnit = null;
            this.unitOverlay = null;
            this.render();
            return;
        }
        
        const unit = this.unitsIndex?.find(u => u.id === unitId);
        if (unit && unit.rect) {
            this.selectedUnit = unitId;
            this.unitOverlay = unit.rect;
            console.log(`Unit overlay: ${unitId} rect ${unit.rect.x},${unit.rect.y},${unit.rect.w},${unit.rect.h}`);
            this.render();
        }
    }
    
    renderUnitOverlay() {
        if (!this.unitOverlay) return;
        
        const { x, y, w, h } = this.unitOverlay;
        
        // Calculate pixel coordinates for unit boundary
        const pixelX = x * this.cellSize;
        const pixelY = y * this.cellSize;
        const pixelWidth = w * this.cellSize;
        const pixelHeight = h * this.cellSize;
        
        // Draw ghosted unit boundary rectangle
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)'; // Semi-transparent cyan
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([6, 3]);
        
        this.ctx.beginPath();
        this.ctx.strokeRect(pixelX, pixelY, pixelWidth, pixelHeight);
        
        // Reset line dash for other rendering
        this.ctx.setLineDash([]);
        
        // Add unit info text
        this.ctx.fillStyle = 'rgba(0, 255, 255, 0.9)';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`Unit: ${this.selectedUnit}`, pixelX + 4, pixelY + 16);
    }

    // Load Template Dropdown System
    setupLoadTemplateDropdown() {
        const dropdownBtn = document.getElementById('load-template-btn');
        const dropdownContent = document.getElementById('load-template-dropdown');
        const openFromDisk = document.getElementById('open-from-disk');
        const templateFileInput = document.getElementById('template-file-input');

        if (!dropdownBtn || !dropdownContent || !openFromDisk || !templateFileInput) {
            console.error('Load template dropdown elements not found');
            return;
        }

        // Toggle dropdown on button click
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownContent.classList.toggle('show');
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', () => {
            dropdownContent.classList.remove('show');
        });

        // Prevent dropdown from closing when clicking inside
        dropdownContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Open from disk handler
        openFromDisk.addEventListener('click', (e) => {
            e.preventDefault();
            templateFileInput.click();
            dropdownContent.classList.remove('show');
        });

        // File input change handler
        templateFileInput.addEventListener('change', (e) => {
            this.handleTemplateFileSelect(e);
        });

        // Initialize MRU display
        this.updateMRUDisplay();
    }

    async handleTemplateFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            await this.loadTemplateFromFile(file);
            // Clear the file input so the same file can be selected again
            event.target.value = '';
        } catch (error) {
            this.showToast('error', 'File Load Error', error.message, {
                copyDetails: true,
                details: error.stack
            });
        }
    }

    async loadTemplateFromFile(file, jsonData = null) {
        // If jsonData is provided (from URL loading), use it directly
        if (jsonData) {
            // Use provided jsonData
        } else {
            // Read from file
            const text = await file.text();
            jsonData = JSON.parse(text);
        }

        // Validate with AJV based on schema
        const schema = this.detectSchemaType(jsonData);
        this.validateWithAJV(jsonData, schema);

        // Detect format and convert to scene.v1 (but handle self-generated templates specially)
        const sceneData = this.detectAndConvertFormat(jsonData);

        // Set mode based on detected schema
        this.setModeFromSchema(schema, jsonData);

        // Set up template overlay if this is a template (not a regular scene)
        if (schema !== 'scene.v1') {
            this.setupTemplateOverlay(jsonData, schema);
        }

        // Load the scene.v1 data
        this.fromSceneV1(sceneData);
        this.updateInfo();
        this.updateExportOptions();
        this.render();

        // Add to MRU
        this.addToMRU(file.name, jsonData.meta?.name || file.name, schema);

        // Show success notification
        const templateInfo = this.templateType ? ` (${this.templateType} template context)` : '';
        if (sceneData.meta.convertedFrom) {
            this.showToast('success', 'Template Loaded',
                `File imported and converted from ${sceneData.meta.convertedFrom} format to scene.v1${templateInfo}`);
        } else {
            this.showToast('success', 'Template Loaded',
                `Scene.v1 file imported successfully${templateInfo}`);
        }

        console.log('Template loaded from file:', jsonData);
    }

    // Drag and Drop System
    setupDragAndDrop() {
        const dragOverlay = document.getElementById('drag-drop-overlay');

        if (!dragOverlay) {
            console.error('Drag drop overlay not found');
            return;
        }

        let dragCounter = 0;

        // Prevent default drag behaviors on document
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();

            dragCounter++;
            if (dragCounter === 1) {
                dragOverlay.style.display = 'flex';
            }
        });

        document.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();

            dragCounter--;
            if (dragCounter === 0) {
                dragOverlay.style.display = 'none';
                dragOverlay.classList.remove('drag-over');
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            dragCounter = 0;
            dragOverlay.style.display = 'none';
            dragOverlay.classList.remove('drag-over');

            this.handleFileDrop(e);
        });

        // Add drag over styling
        dragOverlay.addEventListener('dragover', (e) => {
            e.preventDefault();
            dragOverlay.classList.add('drag-over');
        });

        dragOverlay.addEventListener('dragleave', (e) => {
            if (!dragOverlay.contains(e.relatedTarget)) {
                dragOverlay.classList.remove('drag-over');
            }
        });
    }

    async handleFileDrop(event) {
        const files = Array.from(event.dataTransfer.files);
        const jsonFiles = files.filter(file => file.name.toLowerCase().endsWith('.json'));

        if (jsonFiles.length === 0) {
            this.showToast('warning', 'Invalid File', 'Please drop a JSON file.');
            return;
        }

        if (jsonFiles.length > 1) {
            this.showToast('warning', 'Multiple Files', 'Please drop only one JSON file at a time.');
            return;
        }

        try {
            await this.loadTemplateFromFile(jsonFiles[0]);
        } catch (error) {
            this.showToast('error', 'File Drop Error', error.message, {
                copyDetails: true,
                details: error.stack
            });
        }
    }

    // Schema Detection and Validation
    detectSchemaType(jsonData) {
        if (jsonData.meta?.schema) {
            return jsonData.meta.schema;
        }

        // Fallback detection based on structure
        if (jsonData.id && jsonData.id.startsWith('mall-')) {
            return 'mall-template.v1';
        }

        if (jsonData.id && jsonData.id.startsWith('gallery-') && jsonData.parentMallId) {
            return 'gallery-template.v1';
        }

        if (jsonData.id && jsonData.id.startsWith('design-')) {
            return 'unit-design.v1';
        }

        // Default to scene.v1 if has grid/tiles structure
        if (jsonData.grid || jsonData.tiles) {
            return 'scene.v1';
        }

        throw new Error('Unable to detect schema type from file structure');
    }

    validateWithAJV(jsonData, schema) {
        // For now, we'll do basic structural validation
        // In a full implementation, we would load the actual AJV schemas
        const supportedSchemas = ['scene.v1', 'mall-template.v1', 'gallery-template.v1', 'room-template.v1', 'unit-design.v1'];

        if (!supportedSchemas.includes(schema)) {
            throw new Error(`Unsupported schema: ${schema}`);
        }

        // Basic validation for each schema type
        switch (schema) {
            case 'scene.v1':
                if (!jsonData.grid || !jsonData.tiles || !jsonData.edges) {
                    throw new Error('Invalid scene.v1: missing required sections (grid, tiles, edges)');
                }
                break;

            case 'mall-template.v1':
                if (!jsonData.id || !jsonData.grid || !jsonData.units || !Array.isArray(jsonData.units)) {
                    throw new Error('Invalid mall-template.v1: missing required fields (id, grid, units array)');
                }
                if (jsonData.units.length === 0) {
                    throw new Error('Invalid mall-template.v1: units array cannot be empty');
                }
                // Validate each unit has required fields
                jsonData.units.forEach((unit, index) => {
                    if (!unit.id || !unit.rect || typeof unit.rect.x !== 'number' ||
                        typeof unit.rect.y !== 'number' || typeof unit.rect.w !== 'number' ||
                        typeof unit.rect.h !== 'number') {
                        throw new Error(`Invalid mall-template.v1: unit[${index}] missing required rect fields (x, y, w, h)`);
                    }
                });
                break;

            case 'gallery-template.v1':
                if (!jsonData.id || !jsonData.parentMallId || !jsonData.rect) {
                    throw new Error('Invalid gallery-template.v1: missing required fields (id, parentMallId, rect)');
                }
                break;

            case 'unit-design.v1':
                if (!jsonData.id || !jsonData.parentUnitId) {
                    throw new Error('Invalid unit-design.v1: missing required fields (id, parentUnitId)');
                }
                break;
        }

        console.log(`✅ Schema validation passed: ${schema}`);
    }

    setModeFromSchema(schema, jsonData) {
        const modeBadge = document.getElementById('mode-badge');
        const modeBadgeText = document.getElementById('mode-badge-text');

        if (!modeBadge || !modeBadgeText) return;

        // Remove all mode classes
        modeBadge.className = 'mode-badge';

        switch (schema) {
            case 'mall-template.v1':
                modeBadge.classList.add('mall-mode');
                modeBadgeText.textContent = 'Mall Template Mode';
                this.editorMode = 'mall';
                this.lockBaseStructure = true;
                break;

            case 'gallery-template.v1':
                modeBadge.classList.add('gallery-mode');
                modeBadgeText.textContent = 'Gallery Template Mode';
                this.editorMode = 'gallery';
                this.lockFootprint = true;
                break;

            case 'unit-design.v1':
                modeBadge.classList.add('design-mode');
                modeBadgeText.textContent = 'Unit Design Mode (Read-Only)';
                this.editorMode = 'design';
                this.isReadOnly = true;
                break;

            case 'scene.v1':
            default:
                modeBadge.classList.add('scene-mode');
                modeBadgeText.textContent = 'Scene Mode';
                this.editorMode = 'scene';
                this.lockBaseStructure = false;
                this.lockFootprint = false;
                this.isReadOnly = false;
                break;
        }

        modeBadge.style.display = 'block';
        console.log(`Mode set to: ${this.editorMode}`);
    }

    // MRU (Most Recently Used) System - Early Initialization
    initializeMRUSystem() {
        // Guarantee this.mruFiles is always an array
        this.mruFiles = [];

        try {
            const stored = localStorage.getItem('editor.mruFiles');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    this.mruFiles = parsed;
                }
            }
        } catch (error) {
            console.warn('Could not load MRU from localStorage (private mode or corrupt data):', error);
            // Keep this.mruFiles as empty array
        }
    }

    // MRU (Most Recently Used) System - Runtime Methods
    setupMRUSystem() {
        // This method is kept for consistency but initialization is done early
        // Ensure we have a valid array if something went wrong
        if (!Array.isArray(this.mruFiles)) {
            this.mruFiles = [];
        }
    }

    saveMRUToStorage() {
        if (!Array.isArray(this.mruFiles)) {
            console.warn('Cannot save MRU: this.mruFiles is not an array');
            return;
        }

        try {
            localStorage.setItem('editor.mruFiles', JSON.stringify(this.mruFiles));
        } catch (error) {
            console.warn('Cannot save MRU to localStorage (private mode or quota exceeded):', error);
            // Don't throw - this should not block template loading
        }
    }

    addToMRU(filename, displayName, schema) {
        // Ensure we have a valid array before proceeding
        if (!Array.isArray(this.mruFiles)) {
            this.mruFiles = [];
        }

        const newEntry = {
            filename,
            displayName: displayName || filename,
            schema,
            timestamp: new Date().toISOString(),
            id: Date.now() + Math.random() // Simple unique ID
        };

        try {
            // Remove existing entry with same filename (with null guard)
            this.mruFiles = this.mruFiles.filter(item => item && item.filename !== filename);

            // Add to beginning
            this.mruFiles.unshift(newEntry);

            // Keep only 5 most recent
            this.mruFiles = this.mruFiles.slice(0, 5);

            this.saveMRUToStorage();
            this.updateMRUDisplay();
        } catch (error) {
            console.warn('Error updating MRU list:', error);
            // Reset to safe state if something went wrong
            this.mruFiles = [newEntry];
            this.saveMRUToStorage();
            this.updateMRUDisplay();
        }
    }

    updateMRUDisplay() {
        const recentFilesList = document.getElementById('recent-files-list');
        if (!recentFilesList) {
            console.warn('MRU display element not found');
            return;
        }

        try {
            // Ensure we have a valid array
            const validMRUFiles = Array.isArray(this.mruFiles) ?
                this.mruFiles.filter(Boolean).slice(0, 5) : [];

            if (validMRUFiles.length === 0) {
                recentFilesList.innerHTML = '<span class="no-recent">No recent files yet</span>';
                return;
            }

            recentFilesList.innerHTML = validMRUFiles.map(item => {
                if (!item || !item.filename) return '';

                return `
                    <a href="#" class="recent-file-item" data-filename="${item.filename}" data-id="${item.id || 'unknown'}">
                        <span class="recent-file-name">${item.displayName || item.filename}</span>
                        <span class="recent-file-path">${item.filename} • ${item.schema || 'unknown'}</span>
                    </a>
                `;
            }).filter(Boolean).join('');

            // Add click handlers for recent files
            recentFilesList.querySelectorAll('.recent-file-item').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const filename = e.currentTarget.dataset.filename;

                    if (this.showToast) {
                        this.showToast('info', 'Recent File',
                            `Recent files only track previously loaded files. Please use "Open from disk..." to load ${filename} again.`);
                    }

                    const dropdown = document.getElementById('load-template-dropdown');
                    if (dropdown) {
                        dropdown.classList.remove('show');
                    }
                });
            });
        } catch (error) {
            console.warn('Error updating MRU display:', error);
            // Fallback to safe state
            recentFilesList.innerHTML = '<span class="no-recent">Error loading recent files</span>';
        }
    }

    // URL Parameter Support
    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const openParam = urlParams.get('open');

        if (openParam && this.isLocalDevelopment()) {
            this.loadFromUrl(openParam);
        }
    }

    isLocalDevelopment() {
        return location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '';
    }

    async loadFromUrl(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const jsonData = await response.json();

            // Create a mock file object for consistency with file loading
            const mockFile = { name: path.split('/').pop() || 'url-file.json' };
            await this.loadTemplateFromFile(mockFile, jsonData);

        } catch (error) {
            this.showToast('error', 'URL Load Error',
                `Failed to load file from URL: ${path}\n${error.message}`);
            console.error('URL load error:', error);
        }
    }

    // Toast Notification System
    showToast(type = 'info', title = 'Notification', message = '', options = {}) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const toastId = 'toast-' + Date.now();
        toast.id = toastId;

        const actionsHtml = options.copyDetails ? `
            <div class="toast-actions">
                <button class="toast-btn" onclick="navigator.clipboard.writeText('${(options.details || message).replace(/'/g, "\\'")}'); this.textContent='Copied!'">
                    Copy details
                </button>
            </div>
        ` : '';

        toast.innerHTML = `
            <div class="toast-header">
                <span class="toast-title">${title}</span>
                <button class="toast-close" onclick="document.getElementById('${toastId}').remove()">×</button>
            </div>
            <div class="toast-message">${message}</div>
            ${actionsHtml}
        `;

        container.appendChild(toast);

        // Show with animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto remove after delay (unless it's an error with copy details)
        if (!options.copyDetails || type !== 'error') {
            const delay = type === 'error' ? 8000 : (type === 'warning' ? 6000 : 4000);
            setTimeout(() => {
                if (document.getElementById(toastId)) {
                    toast.remove();
                }
            }, delay);
        }
    }

    // Template Boundary Validation
    isWithinTemplateBounds(x, y) {
        // If no template is loaded, allow editing anywhere
        if (!this.overlayModel.constraints || !this.overlayModel.constraints.allowedAreas) {
            return true;
        }

        const allowedAreas = this.overlayModel.constraints.allowedAreas;

        // Check if point is within any allowed area
        return allowedAreas.some(area => {
            const { x: ax, y: ay, w: aw, h: ah } = area;
            return x >= ax && x < ax + aw && y >= ay && y < ay + ah;
        });
    }

    getTemplateBoundaryType(x, y) {
        // Return which boundary type this coordinate belongs to, or null if outside
        if (!this.templateType || !this.templateContext || !this.templateContext.originalData) {
            return null;
        }

        const templateData = this.templateContext.originalData;

        switch (this.templateType) {
            case 'mall':
                if (templateData.units) {
                    const unit = templateData.units.find(unit => {
                        if (unit.rect) {
                            const { x: ux, y: uy, w: uw, h: uh } = unit.rect;
                            return x >= ux && x < ux + uw && y >= uy && y < uy + uh;
                        }
                        return false;
                    });
                    return unit ? { type: 'unit', id: unit.id, rect: unit.rect } : null;
                }
                break;

            case 'unit':
                if (templateData.rooms) {
                    const room = templateData.rooms.find(room => {
                        if (room.gridRect) {
                            const { x: rx, y: ry, w: rw, h: rh } = room.gridRect;
                            return x >= rx && x < rx + rw && y >= ry && y < ry + rh;
                        }
                        return false;
                    });
                    return room ? { type: 'room', id: room.id, rect: room.gridRect } : null;
                }
                break;
        }

        return null;
    }

    showTemplateBoundsViolation(x, y, editType) {
        // Visual feedback: flash red on the attempted edit location
        const pixelX = x * this.cellSize;
        const pixelY = y * this.cellSize;

        // Save current canvas state
        this.ctx.save();

        // Draw red flash overlay
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);

        // Restore canvas state after a short delay
        setTimeout(() => {
            this.render();
        }, 150);

        // Show toast notification
        const boundary = this.getTemplateBoundaryType(x, y);
        let message = `Cannot edit outside template bounds`;

        if (this.templateType === 'mall') {
            message = `Can only edit within unit areas`;
        } else if (this.templateType === 'unit') {
            message = `Can only edit within room areas`;
        } else if (this.templateType === 'design') {
            message = `Can only edit within design bounds`;
        }

        if (boundary) {
            message += ` (currently in ${boundary.type}: ${boundary.id})`;
        }

        if (this.showToast) {
            this.showToast('warning', 'Edit Restricted', message);
        }

        console.log(`Template bounds violation at (${x},${y}) for ${editType}: ${message}`);
    }

    // Template Overlay Setup
    setupTemplateOverlay(templateData, schema) {
        switch (schema) {
            case 'mall-template.v1':
                if (templateData.units && Array.isArray(templateData.units)) {
                    // Template boundaries are already stored in overlayModel - just enable display

                    // Update toggle button text and show it
                    const toggleBtn = document.getElementById('toggle-template-btn');
                    if (toggleBtn) {
                        toggleBtn.textContent = 'Hide Template';
                        toggleBtn.style.display = 'inline-block';
                    }

                    console.log('Mall template boundaries ready for display:', templateData.id);
                } else {
                    console.warn('Mall template missing units array:', templateData);
                }
                break;

            case 'gallery-template.v1':
                if (templateData.rect) {
                    // For gallery templates, set up the gallery overlay
                    this.unitOverlay = templateData.rect;
                    this.selectedUnit = templateData.id;

                    console.log('Gallery template overlay enabled:', templateData);
                }
                break;

            case 'unit-design.v1':
                // Unit design templates might have their own overlay setup
                console.log('Unit design template loaded:', templateData);
                break;

            default:
                console.log('No specific overlay setup for schema:', schema);
        }
    }

    // Template hierarchy validation methods
    validateMallTemplate(mallTemplate) {
        const errors = [];

        // Required fields validation
        if (!mallTemplate.id || !mallTemplate.id.startsWith('mall-')) {
            errors.push('Mall template must have an ID starting with "mall-"');
        }

        if (!mallTemplate.grid) {
            errors.push('Mall template must have a grid property');
        } else {
            if (typeof mallTemplate.grid.width !== 'number' || mallTemplate.grid.width <= 0) {
                errors.push('Mall template grid must have valid width');
            }
            if (typeof mallTemplate.grid.height !== 'number' || mallTemplate.grid.height <= 0) {
                errors.push('Mall template grid must have valid height');
            }
        }

        // Validate mall template structure
        if (mallTemplate.units && !Array.isArray(mallTemplate.units)) {
            errors.push('Mall template units must be an array');
        }

        // Size constraints for mall templates
        if (mallTemplate.grid) {
            const maxSize = 100; // Maximum grid size for mall templates
            if (mallTemplate.grid.width > maxSize || mallTemplate.grid.height > maxSize) {
                errors.push(`Mall template grid size cannot exceed ${maxSize}x${maxSize}`);
            }
        }

        if (errors.length > 0) {
            throw new Error(`Mall template validation failed:\n${errors.join('\n')}`);
        }

        console.log(`✅ Mall template validation passed: ${mallTemplate.id}`);
        return true;
    }

    validateGalleryTemplate(galleryTemplate) {
        const errors = [];

        // Required meta fields validation
        if (!galleryTemplate.meta || galleryTemplate.meta.schema !== "gallery-template.v1") {
            errors.push('Gallery template must have meta.schema = "gallery-template.v1"');
        }

        // Required fields validation
        if (!galleryTemplate.id || !galleryTemplate.id.startsWith('gallery-')) {
            errors.push('Gallery template must have an ID starting with "gallery-"');
        }

        if (!galleryTemplate.parentMallId || !galleryTemplate.parentMallId.startsWith('mall-')) {
            errors.push('Gallery template must have a valid parentMallId starting with "mall-"');
        }

        if (!galleryTemplate.rect) {
            errors.push('Gallery template must have a rect property defining boundaries');
        } else {
            const { x, y, w, h } = galleryTemplate.rect;
            if (typeof x !== 'number' || typeof y !== 'number' ||
                typeof w !== 'number' || typeof h !== 'number') {
                errors.push('Gallery template rect must have numeric x, y, w, h properties');
            }
            if (w <= 0 || h <= 0) {
                errors.push('Gallery template rect dimensions must be positive');
            }
        }

        // Validate rooms structure
        if (!galleryTemplate.rooms || !Array.isArray(galleryTemplate.rooms)) {
            errors.push('Gallery template must have a rooms array');
        } else {
            galleryTemplate.rooms.forEach((room, index) => {
                if (!room.id || typeof room.id !== 'string') {
                    errors.push(`Room ${index} must have a string ID`);
                }
                if (!room.gridRect) {
                    errors.push(`Room ${index} must have a gridRect property`);
                } else {
                    const { x, y, w, h } = room.gridRect;
                    if (typeof x !== 'number' || typeof y !== 'number' ||
                        typeof w !== 'number' || typeof h !== 'number') {
                        errors.push(`Room ${index} gridRect must have numeric x, y, w, h properties`);
                    }
                    if (w <= 0 || h <= 0) {
                        errors.push(`Room ${index} gridRect dimensions must be positive`);
                    }
                }
            });
        }

        // Hierarchy validation - check if parent exists (if we have template context)
        if (this.templateContext && this.templateContext.originalData &&
            this.templateContext.originalData.id === galleryTemplate.parentMallId) {
            console.log(`✅ Gallery template parent relationship verified: ${galleryTemplate.parentMallId}`);
        }

        if (errors.length > 0) {
            throw new Error(`Gallery template validation failed:\n${errors.join('\n')}`);
        }

        console.log(`✅ Gallery template validation passed: ${galleryTemplate.id}`);
        return true;
    }

    validateRoomTemplate(roomTemplate) {
        const errors = [];

        // Required meta fields validation
        if (!roomTemplate.meta || roomTemplate.meta.schema !== "room-template.v1") {
            errors.push('Room template must have meta.schema = "room-template.v1"');
        }

        // Required fields validation
        if (!roomTemplate.id || !roomTemplate.id.startsWith('room-')) {
            errors.push('Room template must have an ID starting with "room-"');
        }

        // Debug logging for parentGalleryId validation
        console.log('Room validation - parentGalleryId:', roomTemplate.parentGalleryId);

        if (!roomTemplate.parentGalleryId) {
            errors.push('Room template must have a parentGalleryId field');
        } else if (!roomTemplate.parentGalleryId.startsWith('gallery-')) {
            errors.push(`Room template must have a valid parentGalleryId starting with "gallery-", got: "${roomTemplate.parentGalleryId}"`);
        }

        if (!roomTemplate.rect) {
            errors.push('Room template must have a rect property defining boundaries');
        } else {
            const { x, y, w, h } = roomTemplate.rect;
            if (typeof x !== 'number' || typeof y !== 'number' ||
                typeof w !== 'number' || typeof h !== 'number') {
                errors.push('Room template rect must have numeric x, y, w, h properties');
            }
            if (w <= 0 || h <= 0) {
                errors.push('Room template rect dimensions must be positive');
            }
        }

        // Validate features structure
        if (!roomTemplate.features) {
            errors.push('Room template must have a features property');
        } else {
            // Validate walls if present
            if (roomTemplate.features.walls && !Array.isArray(roomTemplate.features.walls)) {
                errors.push('Room template features.walls must be an array if present');
            }

            // Validate floor zones if present
            if (roomTemplate.features.floorZones && !Array.isArray(roomTemplate.features.floorZones)) {
                errors.push('Room template features.floorZones must be an array if present');
            } else if (roomTemplate.features.floorZones) {
                roomTemplate.features.floorZones.forEach((zone, index) => {
                    if (!zone.id || typeof zone.id !== 'string') {
                        errors.push(`Floor zone ${index} must have a string ID`);
                    }
                    if (!zone.bounds) {
                        errors.push(`Floor zone ${index} must have bounds property`);
                    } else {
                        const { x, y, w, h } = zone.bounds;
                        if (typeof x !== 'number' || typeof y !== 'number' ||
                            typeof w !== 'number' || typeof h !== 'number') {
                            errors.push(`Floor zone ${index} bounds must have numeric x, y, w, h properties`);
                        }
                    }
                });
            }
        }

        // Hierarchy validation - check if parent exists (if we have template context)
        if (this.templateContext && this.templateContext.originalData &&
            this.templateContext.originalData.id === roomTemplate.parentGalleryId) {
            console.log(`✅ Room template parent relationship verified: ${roomTemplate.parentGalleryId}`);
        }

        if (errors.length > 0) {
            throw new Error(`Room template validation failed:\n${errors.join('\n')}`);
        }

        console.log(`✅ Room template validation passed: ${roomTemplate.id}`);
        return true;
    }

    validateTemplateHierarchy(childTemplate, parentTemplate) {
        const errors = [];

        if (!childTemplate || !parentTemplate) {
            errors.push('Both child and parent templates must be provided');
            if (errors.length > 0) {
                throw new Error(`Template hierarchy validation failed:\n${errors.join('\n')}`);
            }
        }

        // Validate parent-child relationship IDs
        if (childTemplate.parentMallId && childTemplate.parentMallId !== parentTemplate.id) {
            errors.push(`Child template parentMallId (${childTemplate.parentMallId}) does not match parent ID (${parentTemplate.id})`);
        }

        // Validate size constraints - child must fit within parent bounds
        if (parentTemplate.grid && childTemplate.rect) {
            const parentW = parentTemplate.grid.width;
            const parentH = parentTemplate.grid.height;
            const { x, y, w, h } = childTemplate.rect;

            if (x < 0 || y < 0 || x + w > parentW || y + h > parentH) {
                errors.push(`Child template boundaries (${x},${y},${w}x${h}) exceed parent grid (${parentW}x${parentH})`);
            }
        }

        // Validate template types
        if (parentTemplate.id.startsWith('mall-') && !childTemplate.id.startsWith('gallery-')) {
            errors.push('Mall templates can only have gallery template children');
        }

        if (errors.length > 0) {
            throw new Error(`Template hierarchy validation failed:\n${errors.join('\n')}`);
        }

        console.log(`✅ Template hierarchy validation passed: ${childTemplate.id} → ${parentTemplate.id}`);
        return true;
    }
}

// Initialize editor when page loads
document.addEventListener('DOMContentLoaded', () => {
    new FloorplanEditor();
});