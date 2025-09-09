class FloorplanEditor {
    constructor() {
        this.canvas = document.getElementById('grid-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridWidth = 40;
        this.gridHeight = 30;
        this.cellSize = 20;
        this.currentTool = 'empty';
        this.isDrawing = false;
        
        // Initialize grid data
        this.grid = this.createEmptyGrid();
        
        // Colors for different tile types
        this.colors = {
            empty: '#f0f0f0',
            floor: '#8B4513',
            wall: '#404040'
        };
        
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
            this.paint(e);
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDrawing) {
                this.paint(e);
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
            this.clearGrid();
        });
    }
    
    paint(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.cellSize);
        const y = Math.floor((e.clientY - rect.top) / this.cellSize);
        
        if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
            if (this.grid[y][x] !== this.currentTool) {
                this.grid[y][x] = this.currentTool;
                this.renderCell(x, y);
            }
        }
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
        
        // Render all cells
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                this.renderCell(x, y);
            }
        }
    }
    
    clearGrid() {
        this.grid = this.createEmptyGrid();
        this.render();
    }
    
    updateInfo() {
        document.getElementById('grid-size').textContent = `${this.gridWidth}x${this.gridHeight}`;
        document.getElementById('cell-size').textContent = `${this.cellSize}px`;
        document.getElementById('current-tool').textContent = this.currentTool;
    }
    
    gridToInstances() {
        const instances = [];
        
        // Add reference pole
        instances.push({
            type: "referencePole",
            position: [0, 0.5, 0]
        });
        
        // Convert grid to 3D instances
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const tileType = this.grid[y][x];
                if (tileType === 'floor') {
                    instances.push({
                        type: "lobbyFloor",
                        position: [x * 2, 0, y * 2],
                        rotation: [-1.5707963267948966, 0, 0]
                    });
                } else if (tileType === 'wall') {
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
    
    instancesToGrid(instances) {
        const newGrid = this.createEmptyGrid();
        
        instances.forEach(instance => {
            if (instance.type === 'lobbyFloor') {
                const x = Math.floor(instance.position[0] / 2);
                const z = Math.floor(instance.position[2] / 2);
                if (x >= 0 && x < this.gridWidth && z >= 0 && z < this.gridHeight) {
                    newGrid[z][x] = 'floor';
                }
            } else if (instance.type === 'lobbyWall' || 
                      instance.type === 'lobbyNorthWall' || 
                      instance.type === 'lobbySouthWall' || 
                      instance.type === 'lobbyEastWall' || 
                      instance.type === 'lobbyWestWall') {
                const x = Math.floor(instance.position[0] / 2);
                const z = Math.floor(instance.position[2] / 2);
                if (x >= 0 && x < this.gridWidth && z >= 0 && z < this.gridHeight) {
                    newGrid[z][x] = 'wall';
                }
            }
        });
        
        return newGrid;
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
                this.grid = this.instancesToGrid(jsonData.instances);
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
}

// Initialize editor when page loads
document.addEventListener('DOMContentLoaded', () => {
    new FloorplanEditor();
});