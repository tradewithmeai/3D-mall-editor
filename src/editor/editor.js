class FloorplanEditor {
    constructor() {
        this.canvas = document.getElementById('grid-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridWidth = 60;
        this.gridHeight = 40;
        this.cellSize = 20;
        this.currentTool = 'empty';
        this.isDrawing = false;
        
        // Initialize grid data for floor tiles
        this.grid = this.createEmptyGrid();
        
        // Initialize edge data structures
        // H(x,y) for horizontal edges between (x,y)–(x+1,y)
        // V(x,y) for vertical edges between (x,y)–(x,y+1)
        this.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        this.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        
        // Colors for different elements
        this.colors = {
            empty: '#f0f0f0',
            floor: '#8B4513'
        };
        
        // Template overlay state
        this.templateOverlay = null;
        this.showTemplate = false;
        
        // Unit overlay state
        this.unitsIndex = null;
        this.selectedUnit = null;
        this.unitOverlay = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
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
            this.exportJSON();
        });
        
        document.getElementById('clear-btn').addEventListener('click', () => {
            this.clearAll();
        });
        
        // Template overlay controls
        document.getElementById('load-template-btn')?.addEventListener('click', () => {
            this.loadTemplate();
        });
        
        document.getElementById('toggle-template-btn')?.addEventListener('click', () => {
            this.toggleTemplate();
        });
        
        // Units index controls
        document.getElementById('load-units-btn')?.addEventListener('click', () => {
            this.loadUnitsIndex();
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
            // Only allow painting floors and empty tiles - no wall tiles
            if ((this.currentTool === 'floor' || this.currentTool === 'empty') && this.grid[y][x] !== this.currentTool) {
                this.grid[y][x] = this.currentTool;
                this.renderCell(x, y);
            }
        }
    }
    
    handleEdgePaint(mouseX, mouseY) {
        const edge = this.snapToNearestEdge(mouseX, mouseY);
        if (!edge) return;
        
        const { type, x, y } = edge;
        
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
        
        // Render unit overlay
        this.renderUnitOverlay();
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
        if (!this.showTemplate || !this.templateOverlay) return;
        
        // Draw ghosted template boundary overlay
        const templateWidth = this.templateOverlay.width;
        const templateHeight = this.templateOverlay.height;
        
        // Calculate pixel coordinates for template boundary
        const pixelWidth = templateWidth * this.cellSize;
        const pixelHeight = templateHeight * this.cellSize;
        
        // Draw ghosted boundary rectangle
        this.ctx.strokeStyle = 'rgba(255, 0, 255, 0.5)'; // Semi-transparent magenta
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([8, 4]);
        
        this.ctx.beginPath();
        this.ctx.strokeRect(0, 0, pixelWidth, pixelHeight);
        
        // Reset line dash for other rendering
        this.ctx.setLineDash([]);
        
        // Add template info text
        this.ctx.fillStyle = 'rgba(255, 0, 255, 0.8)';
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`Template: ${templateWidth}×${templateHeight}`, 10, 25);
    }
    
    clearAll() {
        this.grid = this.createEmptyGrid();
        this.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        this.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
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

    exportJSON() {
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
    
    // Detect format and convert to scene.v1
    detectAndConvertFormat(jsonData) {
        // Check if it's already scene.v1
        if (jsonData.meta && jsonData.meta.schema === "scene.v1") {
            return jsonData;
        }

        // Check if it's a mall template format
        if (jsonData.grid && jsonData.id && jsonData.id.startsWith('mall-')) {
            // Convert mall template to scene.v1 - just the grid structure
            return {
                meta: {
                    schema: "scene.v1",
                    version: "1.0",
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                    convertedFrom: "mall-template"
                },
                grid: jsonData.grid,
                tiles: { floor: [] },
                edges: { horizontal: [], vertical: [] }
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
            this.render();

            console.log('Imported and converted to scene.v1:', sceneData);

            // Show conversion info to user
            if (sceneData.meta.convertedFrom) {
                alert(`File imported and converted from ${sceneData.meta.convertedFrom} format to scene.v1`);
            } else {
                alert('Scene.v1 file imported successfully');
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
                this.render();
                console.log('Template loaded:', templateData);

                // Update toggle button text and show it
                const toggleBtn = document.getElementById('toggle-template-btn');
                if (toggleBtn) {
                    toggleBtn.textContent = 'Hide Template';
                    toggleBtn.style.display = 'inline-block';
                }
            } else {
                alert('Invalid template format. Expected "grid" property.');
            }
        } catch (error) {
            alert('Error loading template: ' + error.message);
            console.error('Template load error:', error);
        }
    }
    
    toggleTemplate() {
        if (this.templateOverlay) {
            this.showTemplate = !this.showTemplate;
            this.render();
            
            // Update toggle button text
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
}

// Initialize editor when page loads
document.addEventListener('DOMContentLoaded', () => {
    new FloorplanEditor();
});