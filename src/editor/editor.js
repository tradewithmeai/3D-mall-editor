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
    
    exportJSON() {
        const instances = this.gridToInstances();
        const jsonData = { instances };
        
        const dataStr = JSON.stringify(jsonData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'room-layout.json';
        link.click();
        
        console.log('Exported JSON:', jsonData);
    }
    
    async importJSON(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const jsonData = JSON.parse(text);
            
            if (jsonData.instances && Array.isArray(jsonData.instances)) {
                const result = this.instancesToGrid(jsonData.instances);
                this.grid = result.grid;
                this.horizontalEdges = result.horizontalEdges;
                this.verticalEdges = result.verticalEdges;
                this.render();
                console.log('Imported JSON:', jsonData);
            } else {
                alert('Invalid JSON format. Expected "instances" array.');
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
            
            if (templateData.gridSize) {
                this.templateOverlay = templateData.gridSize;
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
                alert('Invalid template format. Expected "gridSize" property.');
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
}

// Initialize editor when page loads
document.addEventListener('DOMContentLoaded', () => {
    new FloorplanEditor();
});