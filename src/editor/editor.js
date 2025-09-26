import { load as loadTemplate } from './core/TemplateLoader.js';
import { makeBounds } from './core/TemplateBounds.js';
import { buildMallTemplate, buildUnitTemplate, buildRoomTemplate, buildSceneV1 } from './core/ExportBuilder.js';

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

        // Unit selection for mall mode
        this.activeUnit = null; // { id, rect }
        this.limitToActiveUnit = false;
        this.baseBounds = null; // Store original bounds before limiting

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

    clearScene() {
        // Reset scene model to empty state
        this.sceneModel.grid = this.createEmptyGrid();
        this.sceneModel.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        this.sceneModel.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);

        // Maintain compatibility with legacy grid references
        this.grid = this.sceneModel.grid;
        this.horizontalEdges = this.sceneModel.horizontalEdges;
        this.verticalEdges = this.sceneModel.verticalEdges;

        console.log('Scene cleared - ready for new content');
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

        document.getElementById('export-selected-unit-btn').addEventListener('click', () => {
            this.handleExportSelectedUnit();
        });

        // Safety handler for mall template dropdown option
        const mallItem = document.getElementById('export-mall-template-item');
        if (mallItem) {
            mallItem.addEventListener('click', (e) => {
                if (mallItem.classList.contains('disabled')) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                // The actual handling is done through the main export button
                // but this provides a safety check for direct clicks
            });
        }


        document.getElementById('clear-btn').addEventListener('click', () => {
            this.clearAll();
        });

        // Clear Template button
        document.getElementById('clear-template-btn')?.addEventListener('click', () => this.clearTemplate());

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

        // Limit edits to active unit toggle
        document.getElementById('limit-edits-to-active-unit')?.addEventListener('change', (e) => {
            this.limitToActiveUnit = e.target.checked;
            this.updateBoundsForActiveUnit();
            console.log('Limit edits to active unit toggled:', this.limitToActiveUnit);
        });
        
        document.getElementById('unit-select')?.addEventListener('change', (e) => {
            this.selectUnit(e.target.value);
        });

        // Test Panel Event Handlers
        document.getElementById('test-panel-toggle')?.addEventListener('click', () => {
            this.toggleTestPanel();
        });

        document.getElementById('load-mall-fixture')?.addEventListener('click', () => {
            this.loadFixture('mall');
        });

        document.getElementById('load-gallery-fixture')?.addEventListener('click', () => {
            this.loadFixture('gallery');
        });

        document.getElementById('load-room-fixture')?.addEventListener('click', () => {
            this.loadFixture('room');
        });

        document.getElementById('run-smoke-test')?.addEventListener('click', () => {
            this.runSmokeTest();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Only act when canvas/editor has focus, not text inputs
            if (document.activeElement?.tagName === 'INPUT' ||
                document.activeElement?.tagName === 'TEXTAREA' ||
                document.activeElement?.tagName === 'SELECT') {
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'o':
                    // Toggle overlay visibility
                    if (this.overlayModel?.templateData) {
                        this.showTemplate = !this.showTemplate;
                        this.render();
                        console.log(`Overlay toggled: ${this.showTemplate ? 'shown' : 'hidden'}`);
                    }
                    e.preventDefault();
                    break;

                case 'c':
                    // Clear template
                    this.clearTemplate();
                    console.log('Template cleared via hotkey');
                    e.preventDefault();
                    break;

                case 't':
                    // Run smoke test
                    this.runSmokeTest();
                    console.log('Smoke test started via hotkey');
                    e.preventDefault();
                    break;
            }
        });
    }
    
    handleMouseAction(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Handle unit selection in mall mode
        if (this.handleUnitSelection(mouseX, mouseY)) {
            return; // Unit was selected, skip painting
        }

        if (this.currentTool === 'wall-edge' || this.currentTool === 'erase') {
            this.handleEdgePaint(mouseX, mouseY);
        } else {
            this.handleTilePaint(mouseX, mouseY);
        }
    }

    handleUnitSelection(mouseX, mouseY) {
        // Only handle unit selection in mall mode
        if (this.overlayModel?.templateData?.type !== 'mall') {
            return false;
        }

        // Convert mouse coordinates to grid coordinates
        const gridX = Math.floor(mouseX / this.cellSize);
        const gridY = Math.floor(mouseY / this.cellSize);

        // Check if click is within grid bounds
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return false;
        }

        const dto = this.overlayModel.templateData;

        // Find the first unit that contains this grid position
        for (const unit of dto.units || []) {
            const rect = unit.rect;
            if (gridX >= rect.x &&
                gridX < rect.x + rect.w &&
                gridY >= rect.y &&
                gridY < rect.y + rect.h) {

                // Set active unit
                this.activeUnit = {
                    id: unit.id || 'unit',
                    rect: { ...rect }
                };

                // Re-render to show selection
                this.render();
                this.updateExportButtonVisibility();
                this.updateBoundsForActiveUnit();
                return true; // Unit was selected, skip painting
            }
        }

        // If no unit was clicked, clear selection
        if (this.activeUnit) {
            this.activeUnit = null;
            this.render();
            this.updateExportButtonVisibility();
            this.updateBoundsForActiveUnit();
        }

        return false; // No unit selected, allow painting
    }

    updateExportButtonVisibility() {
        const exportButton = document.getElementById('export-selected-unit-btn');
        const limitEditsLabel = document.getElementById('limit-edits-label');

        // Show unit export button and checkbox only in mall mode with an active unit selected
        const shouldShowUnitExport = this.overlayModel?.templateData?.type === 'mall' && this.activeUnit;

        if (exportButton) {
            exportButton.style.display = shouldShowUnitExport ? 'inline-block' : 'none';
        }

        if (limitEditsLabel) {
            limitEditsLabel.style.display = shouldShowUnitExport ? 'inline-block' : 'none';
        }

        // Enable/disable the mall template dropdown option based on mode and valid units
        const dto = this.overlayModel?.templateData;
        const isMall = dto?.type === 'mall';
        const units = Array.isArray(dto?.units) ? dto.units.filter(u =>
            u && u.rect &&
            Number.isFinite(u.rect.x) && Number.isFinite(u.rect.y) &&
            Number.isFinite(u.rect.w) && Number.isFinite(u.rect.h) &&
            u.rect.w > 0 && u.rect.h > 0
        ) : [];
        const canExportMall = isMall && units.length > 0;

        const exportMallItem = document.getElementById('export-mall-template-item');
        if (exportMallItem) {
            exportMallItem.classList.toggle('disabled', !canExportMall);
            exportMallItem.setAttribute('aria-disabled', (!canExportMall).toString());
            exportMallItem.title = canExportMall ? '' :
                (isMall ? 'Add at least one valid unit to export' : 'Enter Mall mode to export');
        }
    }

    updateBoundsForActiveUnit() {
        if (!this.overlayModel?.templateData || this.overlayModel.templateData.type !== 'mall') {
            return;
        }

        if (this.limitToActiveUnit && this.activeUnit) {
            // Store original bounds if not already stored
            if (!this.baseBounds) {
                this.baseBounds = this.overlayModel.bounds;
            }

            // Create limited bounds for just the active unit
            const limitedDto = {
                type: 'unit',
                rect: this.activeUnit.rect
            };
            this.overlayModel.bounds = makeBounds(limitedDto);
            console.log('Bounds limited to active unit:', this.activeUnit.rect);
        } else {
            // Restore original bounds
            if (this.baseBounds) {
                this.overlayModel.bounds = this.baseBounds;
                console.log('Bounds restored to original mall bounds');
            }
        }
    }

    handleTilePaint(mouseX, mouseY) {
        const x = Math.floor(mouseX / this.cellSize);
        const y = Math.floor(mouseY / this.cellSize);

        if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
            // Check template bounds first
            if (!this.isWithinTemplateBounds(x, y, 'tile')) {
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
        const kind = (type === 'horizontal') ? 'edge-horizontal' : 'edge-vertical';
        if (!this.isWithinTemplateBounds(x, y, kind)) {
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
        // Early exits
        const dto = this.overlayModel?.templateData;
        if (!this.showTemplate || !dto || dto.type === 'scene') return;

        // Helper function to draw rectangles with consistent styling
        const drawRect = (rect, options = {}) => {
            if (!rect) return;

            const { x, y, w, h } = rect;
            const pixelX = x * this.cellSize;
            const pixelY = y * this.cellSize;
            const pixelW = w * this.cellSize;
            const pixelH = h * this.cellSize;

            // Set styling
            this.ctx.save();
            this.ctx.strokeStyle = options.colour || '#8B3AF9';
            this.ctx.lineWidth = 2;
            this.ctx.globalAlpha = 0.6;
            if (options.dashed) {
                this.ctx.setLineDash([8, 4]);
            }

            // Draw rectangle
            this.ctx.strokeRect(pixelX, pixelY, pixelW, pixelH);

            // Draw label if provided
            if (options.label) {
                this.ctx.save();
                this.ctx.fillStyle = options.colour || '#8B3AF9';
                this.ctx.globalAlpha = 0.8;
                this.ctx.font = '12px Arial';
                this.ctx.fillText(options.label, pixelX + 4, pixelY + 16);
                this.ctx.restore();
            }

            this.ctx.restore();
        };

        this.ctx.save();

        // Switch on dto.type (NO meta/schema access anywhere)
        switch (dto.type) {
            case 'mall': {
                // Draw each unit rect in dto.units
                dto.units?.forEach(u => {
                    drawRect(u.rect, {
                        dashed: true,
                        colour: '#FF6B6B', // Magenta-ish
                        label: u.id || 'unit'
                    });
                });

                // Draw active unit highlight if one is selected
                if (this.activeUnit) {
                    drawRect(this.activeUnit.rect, {
                        dashed: true,
                        colour: '#00BCD4', // Cyan
                        label: `${this.activeUnit.id} (ACTIVE)`
                    });

                    // Override styling for thicker highlight
                    this.ctx.save();
                    this.ctx.strokeStyle = '#00BCD4';
                    this.ctx.lineWidth = 3;
                    this.ctx.globalAlpha = 0.8;
                    this.ctx.setLineDash([8, 4]);

                    const rect = this.activeUnit.rect;
                    const pixelX = rect.x * this.cellSize;
                    const pixelY = rect.y * this.cellSize;
                    const pixelW = rect.w * this.cellSize;
                    const pixelH = rect.h * this.cellSize;

                    this.ctx.strokeRect(pixelX, pixelY, pixelW, pixelH);
                    this.ctx.restore();
                }

                // Draw template info
                this.ctx.save();
                this.ctx.fillStyle = '#FF6B6B';
                this.ctx.globalAlpha = 0.8;
                this.ctx.font = '14px Arial';
                this.ctx.fillText(`Mall Template (${dto.units?.length || 0} units)`, 10, 25);
                this.ctx.restore();
                break;
            }

            case 'unit': { // gallery alias
                // Draw dto.rect (single overlay)
                drawRect(dto.rect, {
                    dashed: true,
                    colour: '#00BCD4', // Cyan
                    label: dto.id || 'gallery'
                });

                // Draw template info
                this.ctx.save();
                this.ctx.fillStyle = '#00BCD4';
                this.ctx.globalAlpha = 0.8;
                this.ctx.font = '14px Arial';
                const roomCount = dto.rooms?.length || 0;
                this.ctx.fillText(`Unit Template (${roomCount} rooms)`, 10, 25);
                this.ctx.restore();
                break;
            }

            case 'room': {
                // Draw dto.rect
                drawRect(dto.rect, {
                    dashed: true,
                    colour: '#4CAF50', // Green
                    label: dto.id || 'room'
                });

                // Draw each zone.rect if present
                dto.zones?.forEach(z => {
                    drawRect(z.rect, {
                        dashed: true,
                        colour: '#4CAF50', // Green
                        label: z.id || 'zone'
                    });
                });

                // Draw template info
                this.ctx.save();
                this.ctx.fillStyle = '#4CAF50';
                this.ctx.globalAlpha = 0.8;
                this.ctx.font = '14px Arial';
                const zoneCount = dto.zones?.length || 0;
                this.ctx.fillText(`Room Template (${zoneCount} zones)`, 10, 25);
                this.ctx.restore();
                break;
            }

            default:
                this.ctx.restore();
                return;
        }

        this.ctx.restore();

        // Note: These overlay draws do NOT write to grid/edges
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

    clearTemplate() {
        this.overlayModel = { templateData: null, bounds: null, constraints: null };
        this.showTemplate = false;
        this.templateType = null;
        this.templateContext = {};
        this.activeUnit = null; // Clear active unit when clearing template
        this.baseBounds = null; // Clear stored bounds
        this.limitToActiveUnit = false; // Reset limit checkbox
        const limitCheckbox = document.getElementById('limit-edits-to-active-unit');
        if (limitCheckbox) limitCheckbox.checked = false;
        this.updateModeBadge();
        this.updateExportButtonVisibility();
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
                this.handleExportMallTemplate();
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

    handleExportSelectedUnit() {
        // Check if we're in mall mode with an active unit selected
        if (this.overlayModel?.templateData?.type !== 'mall' || !this.activeUnit) {
            this.showToast('Please select a unit in mall mode first', 'warning');
            return;
        }

        const dto = this.overlayModel.templateData;
        const selectedUnit = dto.units?.find(u =>
            u.id === this.activeUnit.id ||
            (u.rect.x === this.activeUnit.rect.x && u.rect.y === this.activeUnit.rect.y)
        );

        if (!selectedUnit) {
            this.showToast('Selected unit not found in template data', 'error');
            return;
        }

        // Use ExportBuilder to create unit template from the selected unit
        const unitTemplate = buildUnitTemplate({
            id: selectedUnit.id || 'unit',
            rect: selectedUnit.rect,
            rooms: selectedUnit.rooms || [],
            parentMallId: dto.id
        });

        // Download the unit template
        this.downloadJSON(unitTemplate, `${selectedUnit.id || 'unit'}-template.json`);
        this.showToast(`Exported unit template: ${selectedUnit.id || 'unit'}`, 'success');
    }

    handleExportMallTemplate() {
        // Entry logging
        console.info('[EXPORT:mall] enter', {
            mode: this.mode,
            type: this.overlayModel?.templateData?.type
        });

        const dto = this.overlayModel?.templateData;
        if (!dto || dto.type !== 'mall') {
            this.showToast('warning', 'Mall Export Unavailable', 'Mall export unavailable: not in Mall mode. Load/create a mall template first.');
            return;
        }

        // Validate and filter units with detailed diagnostics
        const allUnits = Array.isArray(dto.units) ? dto.units : [];
        const invalidUnits = allUnits.filter(u =>
            !u || !u.rect ||
            !Number.isFinite(u.rect.x) || !Number.isFinite(u.rect.y) ||
            !Number.isFinite(u.rect.w) || !Number.isFinite(u.rect.h) ||
            u.rect.w <= 0 || u.rect.h <= 0
        );

        const units = allUnits.filter(u =>
            u && u.rect &&
            Number.isFinite(u.rect.x) && Number.isFinite(u.rect.y) &&
            Number.isFinite(u.rect.w) && Number.isFinite(u.rect.h) &&
            u.rect.w > 0 && u.rect.h > 0
        );

        if (invalidUnits.length > 0) {
            this.showToast('error', 'Invalid Unit Rectangles', 'Mall export blocked: found invalid unit rects (need finite x,y,w,h and w/h > 0).');
            console.warn('[EXPORT:mall] invalid units:', invalidUnits);
            return;
        }

        if (units.length === 0) {
            this.showToast('error', 'No Valid Units', 'Mall export blocked: no valid unit rectangles in the current mall template.');
            return;
        }

        const gridSize = dto.gridSize || { width: this.gridWidth, height: this.gridHeight };

        // Pre-build logging
        console.info('[EXPORT:mall] building', {
            grid: gridSize,
            units: units.length,
            unitDetails: units.map(u => ({ id: u.id, rect: u.rect }))
        });

        const out = buildMallTemplate({
            id: dto.id || 'mall',
            gridWidth: gridSize.width,
            gridHeight: gridSize.height,
            cellSize: this.cellSize || 1,
            units
        });

        const name = `${out?.id || 'mall'}.mall-template.v1.json`;

        // Download JSON (using existing download helper)
        this.downloadJSON(out, name);

        // Success logging
        console.info('[EXPORT:mall] done', {
            filename: name,
            schema: out.meta?.schema,
            exported: { id: out.id, units: units.length }
        });
        this.showToast('success', 'Mall Template Exported', `Exported mall template: ${out.id}`);
    }

    // Export as Mall Template format for unit splitting workflow
    exportAsMallTemplate() {
        // Detect units from connected floor regions
        const units = this.detectUnitsFromFloorTiles();

        // Validate minimum unit requirement
        if (units.length === 0) {
            alert('No units detected; draw floor tiles first.');
            console.warn('Export blocked: No units found in current design');
            return;
        }

        // Use ExportBuilder for consistent format
        const mallTemplate = buildMallTemplate({
            gridWidth: this.gridWidth,
            gridHeight: this.gridHeight,
            cellSize: this.cellSize,
            units: units
        });

        const dataStr = JSON.stringify(mallTemplate, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${mallId}.json`;
        link.click();

        console.log('Exported mall template:', mallTemplate);
        alert(`Mall template saved (${units.length} units detected)\\nReady for template loading workflow`);
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
        const dto = this.overlayModel?.templateData;

        // Use ExportBuilder for consistent format
        const out = buildUnitTemplate({
            id: dto?.id || 'unit',
            rect: dto?.rect || { x: 0, y: 0, w: this.gridWidth, h: this.gridHeight },
            rooms: dto?.rooms || [],
            parentMallId: dto?.parentMallId
        });

        const dataStr = JSON.stringify(out, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${out.id || 'unit'}.unit-template.v1.json`;
        link.click();

        console.log('Exported gallery template:', out);
        alert(`Gallery template exported as ${out.id || 'unit'}.unit-template.v1.json`);
    }

    // Export as Room Template format with parent relationship
    exportAsRoomTemplate() {
        const dto = this.overlayModel?.templateData;

        // Preconditions: overlayModel.templateData?.type === 'unit' (gallery authoring session)
        if (!dto || dto.type !== 'unit') {
            alert('Room template export requires an active unit/gallery template session');
            return;
        }

        // Use ExportBuilder for consistent format
        const out = buildRoomTemplate({
            id: dto.id ? `${dto.id}-room` : 'room',
            rect: { ...dto.rect },
            zones: [],
            parentUnitId: dto.id || 'unit'
        });

        // DO NOT export instances/scene content here
        const dataStr = JSON.stringify(out, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${out.id}.room-template.v1.json`;
        link.click();

        console.log('Exported room template:', out);
        alert(`Room template exported as ${out.id}.room-template.v1.json`);
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
        // Collect floor tiles
        const floorTiles = [];
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.grid[y][x] === 'floor') {
                    floorTiles.push([x, y]);
                }
            }
        }

        // Collect edge data
        const hEdges = [];
        const vEdges = [];
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.horizontalEdges[y] && this.horizontalEdges[y][x]) {
                    hEdges.push([x, y]);
                }
                if (this.verticalEdges[y] && this.verticalEdges[y][x]) {
                    vEdges.push([x, y]);
                }
            }
        }

        // Use ExportBuilder for consistent format
        const sceneData = buildSceneV1({
            gridWidth: this.gridWidth,
            gridHeight: this.gridHeight,
            cellSize: this.cellSize,
            floorTiles: floorTiles,
            hEdges: hEdges,
            vEdges: vEdges
        });

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
    

    async importJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const jsonData = JSON.parse(text);

            // Use new TemplateLoader to detect and normalize
            const { dto, mode } = loadTemplate(jsonData);

            // Clear scene and set up overlay model
            this.clearScene();
            this.overlayModel = this.overlayModel || {};
            this.overlayModel.templateData = dto;

            // Validate DTO rects before enabling edits
            if ((dto.type === 'unit' || dto.type === 'room')) {
                if (!dto.rect || dto.rect.w <= 0 || dto.rect.h <= 0) {
                    this.showToast('error', 'Template Invalid', 'Template rect invalid; editing disabled');
                    this.showTemplate = false;
                    this.overlayModel.bounds = null;
                    console.warn('Invalid template rect, editing disabled:', dto.rect);
                } else {
                    this.overlayModel.bounds = makeBounds(dto);
                    this.showTemplate = true;
                }
            } else if (dto.type === 'mall') {
                if (!dto.units || dto.units.length === 0) {
                    console.warn('Mall template has no units; allowing unrestricted editing');
                }
                this.overlayModel.bounds = makeBounds(dto);
                this.showTemplate = true;
            } else {
                this.overlayModel.bounds = makeBounds(dto);
                this.showTemplate = dto.type !== 'scene';
            }

            this.templateType = dto.type;
            this.updateModeBadge();

            console.info('[TEMPLATE_IMPORT]', { type: dto.type, mode: this.mode });
            console.log('Loaded template/scene:', { dto, mode });

            // Handle scene loading
            if (dto.type === 'scene') {
                // Convert scene instances to internal grid as before
                this.fromSceneV1({
                    meta: jsonData.meta || {
                        schema: "scene.v1",
                        version: "1.0"
                    },
                    grid: jsonData.grid || {
                        width: this.gridWidth,
                        height: this.gridHeight,
                        cellSize: this.cellSize
                    },
                    tiles: jsonData.tiles || { floor: [] },
                    edges: jsonData.edges || { horizontal: [], vertical: [] }
                });
                alert('Scene.v1 file imported successfully');
            } else {
                // Template loaded as overlay only - no content conversion
                // Update grid dimensions if template has size info
                if (dto.rect) {
                    this.gridWidth = Math.max(dto.rect.w, this.gridWidth);
                    this.gridHeight = Math.max(dto.rect.h, this.gridHeight);
                } else if (dto.gridSize) {
                    this.gridWidth = dto.gridSize.width || this.gridWidth;
                    this.gridHeight = dto.gridSize.height || this.gridHeight;
                }

                // Update template context for legacy compatibility
                this.templateContext = {
                    id: jsonData.id || `${dto.type}-${Date.now()}`,
                    originalData: jsonData,
                    loadedAt: new Date().toISOString()
                };

                alert(`${dto.type.toUpperCase()} template loaded as overlay constraints. Create content within template boundaries.`);
            }

            this.render();
            this.updateInfo();
            this.updateExportOptions();

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

        // Use new TemplateLoader to detect and normalize
        const { dto, mode } = loadTemplate(jsonData);

        // Clear scene and set up overlay model
        this.clearScene();
        this.overlayModel = this.overlayModel || {};
        this.overlayModel.templateData = dto;

        // Validate DTO rects before enabling edits
        if ((dto.type === 'unit' || dto.type === 'room')) {
            if (!dto.rect || dto.rect.w <= 0 || dto.rect.h <= 0) {
                this.showToast('error', 'Template Invalid', 'Template rect invalid; editing disabled');
                this.showTemplate = false;
                this.overlayModel.bounds = null;
                console.warn('Invalid template rect, editing disabled:', dto.rect);
            } else {
                this.overlayModel.bounds = makeBounds(dto);
                this.showTemplate = true;
            }
        } else if (dto.type === 'mall') {
            if (!dto.units || dto.units.length === 0) {
                console.warn('Mall template has no units; allowing unrestricted editing');
            }
            this.overlayModel.bounds = makeBounds(dto);
            this.showTemplate = true;
        } else {
            this.overlayModel.bounds = makeBounds(dto);
            this.showTemplate = dto.type !== 'scene';
        }

        this.templateType = dto.type;
        this.updateModeBadge();

        console.info('[TEMPLATE_IMPORT]', { type: dto.type, mode: this.mode });
        console.log('Loaded template/scene from file:', { dto, mode });

        // Handle scene loading
        if (dto.type === 'scene') {
            // Convert scene instances to internal grid as before
            this.fromSceneV1({
                meta: jsonData.meta || {
                    schema: "scene.v1",
                    version: "1.0"
                },
                grid: jsonData.grid || {
                    width: this.gridWidth,
                    height: this.gridHeight,
                    cellSize: this.cellSize
                },
                tiles: jsonData.tiles || { floor: [] },
                edges: jsonData.edges || { horizontal: [], vertical: [] }
            });
        } else {
            // Template loaded as overlay only - no content conversion
            // Update grid dimensions if template has size info
            if (dto.rect) {
                this.gridWidth = Math.max(dto.rect.w, this.gridWidth);
                this.gridHeight = Math.max(dto.rect.h, this.gridHeight);
            } else if (dto.gridSize) {
                this.gridWidth = dto.gridSize.width || this.gridWidth;
                this.gridHeight = dto.gridSize.height || this.gridHeight;
            }

            // Update template context for legacy compatibility
            this.templateContext = {
                id: jsonData.id || `${dto.type}-${Date.now()}`,
                originalData: jsonData,
                loadedAt: new Date().toISOString()
            };
        }
        this.render();
        this.updateInfo();
        this.updateExportOptions();

        // Add to MRU
        this.addToMRU(file.name, jsonData.meta?.name || file.name, mode);

        // Show success notification
        const templateInfo = this.templateType ? ` (${this.templateType} mode)` : '';
        if (dto.type === 'scene') {
            this.showToast('success', 'Scene Loaded', `Scene.v1 file imported successfully${templateInfo}`);
        } else {
            this.showToast('success', 'Template Loaded', `${dto.type.toUpperCase()} template loaded as overlay constraints${templateInfo}`);
        }

        console.log('Template loaded from file:', jsonData);
        console.info('[IMPORT]', {
            type: dto.type,
            units: Array.isArray(dto.units) ? dto.units.length : 0,
            id: dto.id,
            hasValidUnits: dto.type === 'mall' ? this.countValidUnits(dto) : 'N/A'
        });
        this.updateExportButtonVisibility();
    }

    // Helper method to count valid units in a DTO
    countValidUnits(dto) {
        if (!Array.isArray(dto.units)) return 0;
        return dto.units.filter(u =>
            u && u.rect &&
            Number.isFinite(u.rect.x) && Number.isFinite(u.rect.y) &&
            Number.isFinite(u.rect.w) && Number.isFinite(u.rect.h) &&
            u.rect.w > 0 && u.rect.h > 0
        ).length;
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
    isWithinTemplateBounds(x, y, kind = 'tile') {
        const b = this.overlayModel?.bounds;
        if (!this.showTemplate || !b) return true; // no template -> unrestricted

        if (kind === 'edge-horizontal') {
            return b.isInside(x, y-1) || b.isInside(x, y);
        }
        if (kind === 'edge-vertical') {
            return b.isInside(x-1, y) || b.isInside(x, y);
        }
        return b.isInside(x, y);
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

    // Test Panel Methods
    toggleTestPanel() {
        const content = document.getElementById('test-panel-content');
        const toggle = document.getElementById('test-panel-toggle');

        if (content.style.display === 'none' || !content.style.display) {
            content.style.display = 'block';
            toggle.textContent = 'Test Panel ▲';
        } else {
            content.style.display = 'none';
            toggle.textContent = 'Test Panel ▼';
        }
    }

    async loadFixture(type) {
        const statusEl = document.getElementById('test-status');
        statusEl.textContent = `Loading ${type} fixture...`;
        statusEl.style.color = '#007bff';

        try {
            let filename;
            switch (type) {
                case 'mall':
                    filename = 'mall-template.v1.json';
                    break;
                case 'gallery':
                    filename = 'unit-template.v1.json';
                    break;
                case 'room':
                    filename = 'room-template.v1.json';
                    break;
                default:
                    throw new Error(`Unknown fixture type: ${type}`);
            }

            const response = await fetch(`./fixtures/${filename}`);
            if (!response.ok) {
                throw new Error(`Failed to load fixture: ${response.status}`);
            }

            const templateData = await response.json();
            this.loadTemplateData(templateData);

            statusEl.textContent = `✅ ${type} fixture loaded`;
            statusEl.style.color = '#28a745';
        } catch (error) {
            console.error(`Failed to load ${type} fixture:`, error);
            statusEl.textContent = `❌ Failed to load ${type} fixture`;
            statusEl.style.color = '#dc3545';
        }
    }

    async runSmokeTest() {
        const statusEl = document.getElementById('test-status');
        statusEl.textContent = '🧪 Running smoke test...';
        statusEl.style.color = '#007bff';

        try {
            let testStep = 1;
            const totalSteps = 8;

            // Step 1: Load mall fixture
            statusEl.textContent = `[${testStep++}/${totalSteps}] Loading mall fixture...`;
            await this.loadFixture('mall');
            await this.sleep(500);

            // Step 2: Test mall export using ExportBuilder
            statusEl.textContent = `[${testStep++}/${totalSteps}] Testing mall export...`;
            const mallTemplate = buildMallTemplate({
                gridWidth: this.gridWidth,
                gridHeight: this.gridHeight,
                cellSize: this.cellSize,
                units: [{ id: 'test-unit', rect: { x: 10, y: 10, w: 8, h: 6 } }]
            });
            console.assert(mallTemplate.meta.schema === 'mall-template.v1', 'Mall export schema mismatch');
            console.assert(mallTemplate.meta.version === '1.0', 'Mall export version mismatch');
            await this.sleep(500);

            // Step 3: Test mall→unit export workflow
            statusEl.textContent = `[${testStep++}/${totalSteps}] Testing mall→unit export...`;
            // Simulate unit selection (first available unit from mall fixture)
            if (this.overlayModel?.templateData?.dto?.units?.length > 0) {
                const firstUnit = this.overlayModel.templateData.dto.units[0];
                this.activeUnit = {
                    id: firstUnit.id || 'unit-1',
                    rect: { ...firstUnit.rect }
                };
                this.updateExportButtonVisibility();

                // Test export selected unit functionality
                const exportedUnit = buildUnitTemplate({
                    id: this.activeUnit.id,
                    rect: this.activeUnit.rect,
                    rooms: firstUnit.rooms || [],
                    parentMallId: this.overlayModel.templateData.dto.id
                });

                console.assert(exportedUnit.meta.schema === 'unit-template.v1', 'Mall→unit export schema mismatch');
                console.assert(exportedUnit.id === this.activeUnit.id, 'Mall→unit export ID mismatch');
                console.assert(exportedUnit.meta.parent, 'Mall→unit export should have parent reference');
                console.log('✓ Mall→unit export test passed');

                // Clear active unit for next test
                this.activeUnit = null;
                this.updateExportButtonVisibility();
            }
            await this.sleep(500);

            // Step 4: Load gallery fixture
            statusEl.textContent = `[${testStep++}/${totalSteps}] Loading gallery fixture...`;
            await this.loadFixture('gallery');
            await this.sleep(500);

            // Step 5: Test gallery export using ExportBuilder
            statusEl.textContent = `[${testStep++}/${totalSteps}] Testing gallery export...`;
            const galleryTemplate = buildUnitTemplate({
                id: 'test-gallery',
                rect: { x: 5, y: 5, w: 10, h: 8 },
                rooms: [],
                parentMallId: 'test-mall'
            });
            console.assert(galleryTemplate.meta.schema === 'unit-template.v1', 'Gallery export schema mismatch');
            console.assert(galleryTemplate.meta.version === '1.0', 'Gallery export version mismatch');
            console.assert(galleryTemplate.meta.parent.schema === 'mall-template.v1', 'Gallery parent schema mismatch');
            await this.sleep(500);

            // Step 6: Load room fixture
            statusEl.textContent = `[${testStep++}/${totalSteps}] Loading room fixture...`;
            await this.loadFixture('room');
            await this.sleep(500);

            // Step 7: Test room export using ExportBuilder
            statusEl.textContent = `[${testStep++}/${totalSteps}] Testing room export...`;
            const roomTemplate = buildRoomTemplate({
                id: 'test-room',
                rect: { x: 12, y: 12, w: 4, h: 3 },
                zones: [],
                parentUnitId: 'test-gallery'
            });
            console.assert(roomTemplate.meta.schema === 'room-template.v1', 'Room export schema mismatch');
            console.assert(roomTemplate.meta.version === '1.0', 'Room export version mismatch');
            console.assert(roomTemplate.meta.parent.schema === 'unit-template.v1', 'Room parent schema mismatch');

            // Success!
            statusEl.textContent = '✅ Smoke test passed!';
            statusEl.style.color = '#28a745';

            console.log('🎉 End-to-end smoke test completed successfully');

        } catch (error) {
            console.error('❌ Smoke test failed:', error);
            statusEl.textContent = '❌ Smoke test failed';
            statusEl.style.color = '#dc3545';
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    updateModeBadge() {
        const badge = document.getElementById('mode-badge');
        const badgeText = document.getElementById('mode-badge-text');

        if (!badge || !badgeText) return;

        const dto = this.overlayModel?.templateData;

        if (!dto || !dto.type || dto.type === 'scene') {
            badge.style.display = 'none';
            return;
        }

        // Map template types to user-friendly names
        const typeNames = {
            'mall': 'Mall Mode',
            'unit': 'Gallery Mode',
            'room': 'Room Mode'
        };

        const displayName = typeNames[dto.type] || `${dto.type} Mode`;
        badgeText.textContent = displayName;
        badge.style.display = 'block';
    }

    showTemplateBoundsViolation(x, y, kind) {
        // Convert grid coordinates to canvas pixels
        const canvasX = x * this.cellSize;
        const canvasY = y * this.cellSize;

        // Create temporary overlay for visual feedback
        const ctx = this.ctx;
        const originalStroke = ctx.strokeStyle;
        const originalLineWidth = ctx.lineWidth;

        // Draw red crosshair
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;

        ctx.beginPath();
        // Horizontal line
        ctx.moveTo(canvasX - this.cellSize/2, canvasY + this.cellSize/2);
        ctx.lineTo(canvasX + this.cellSize + this.cellSize/2, canvasY + this.cellSize/2);
        // Vertical line
        ctx.moveTo(canvasX + this.cellSize/2, canvasY - this.cellSize/2);
        ctx.lineTo(canvasX + this.cellSize/2, canvasY + this.cellSize + this.cellSize/2);
        ctx.stroke();

        // Restore original styles
        ctx.strokeStyle = originalStroke;
        ctx.lineWidth = originalLineWidth;

        // Remove the crosshair after 250ms
        setTimeout(() => {
            this.render(); // Full re-render to clear the temporary overlay
        }, 250);
    }
}

// Initialize editor when page loads
document.addEventListener('DOMContentLoaded', () => {
    new FloorplanEditor();
});