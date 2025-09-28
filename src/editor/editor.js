import { load as loadTemplate } from './core/TemplateLoader.js';
import { makeBounds } from './core/TemplateBounds.js';
import { buildMallTemplate, buildUnitTemplate, buildRoomTemplate, buildObjectTemplate, buildSceneV1 } from './core/ExportBuilder.js';
import { TemplateRelationshipManager } from './core/TemplateRelationshipManager.js';

// Debug logging control
const DEBUG = false;
function debug(...args) {
    if (DEBUG) console.log(...args);
}

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

        // Template content layers for hierarchical ghosted rendering
        this.parentTemplateModel = {
            grid: this.createEmptyGrid(),
            horizontalEdges: this.createEmptyEdgeSet(this.gridWidth, this.gridHeight),
            verticalEdges: this.createEmptyEdgeSet(this.gridWidth, this.gridHeight),
            hasContent: false,
            templateData: null
        };

        this.currentTemplateModel = {
            grid: this.createEmptyGrid(),
            horizontalEdges: this.createEmptyEdgeSet(this.gridWidth, this.gridHeight),
            verticalEdges: this.createEmptyEdgeSet(this.gridWidth, this.gridHeight),
            hasContent: false,
            templateData: null
        };

        // Legacy templateModel for backward compatibility (points to current)
        this.templateModel = this.currentTemplateModel;

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

        // Initialize Template Relationship Manager
        this.templateRelationshipManager = new TemplateRelationshipManager();

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

    resizeTemplateModels() {
        debug('[DEBUG] resizeTemplateModels: Resizing template arrays to match grid:', this.gridWidth, 'x', this.gridHeight);

        // Resize scene model arrays
        this.sceneModel.grid = this.createEmptyGrid();
        this.sceneModel.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        this.sceneModel.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);

        // Preserve parent template data but resize arrays
        if (this.parentTemplateModel.hasContent) {
            const oldParentGrid = this.parentTemplateModel.grid;
            const oldParentHEdges = this.parentTemplateModel.horizontalEdges;
            const oldParentVEdges = this.parentTemplateModel.verticalEdges;

            // Create new arrays with current grid dimensions
            this.parentTemplateModel.grid = this.createEmptyGrid();
            this.parentTemplateModel.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
            this.parentTemplateModel.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);

            // Copy old data into new arrays (within bounds)
            const oldHeight = oldParentGrid.length;
            const oldWidth = oldParentGrid[0]?.length || 0;
            for (let y = 0; y < Math.min(oldHeight, this.gridHeight); y++) {
                for (let x = 0; x < Math.min(oldWidth, this.gridWidth); x++) {
                    this.parentTemplateModel.grid[y][x] = oldParentGrid[y][x];
                }
            }

            // Copy horizontal edges (within bounds)
            const oldHHeight = oldParentHEdges.length;
            const oldHWidth = oldParentHEdges[0]?.length || 0;
            for (let y = 0; y < Math.min(oldHHeight, this.gridHeight); y++) {
                for (let x = 0; x < Math.min(oldHWidth, this.gridWidth); x++) {
                    this.parentTemplateModel.horizontalEdges[y][x] = oldParentHEdges[y][x];
                }
            }

            // Copy vertical edges (within bounds)
            const oldVHeight = oldParentVEdges.length;
            const oldVWidth = oldParentVEdges[0]?.length || 0;
            for (let y = 0; y < Math.min(oldVHeight, this.gridHeight); y++) {
                for (let x = 0; x < Math.min(oldVWidth, this.gridWidth); x++) {
                    this.parentTemplateModel.verticalEdges[y][x] = oldParentVEdges[y][x];
                }
            }
        } else {
            // Create empty arrays
            this.parentTemplateModel.grid = this.createEmptyGrid();
            this.parentTemplateModel.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
            this.parentTemplateModel.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        }

        // Preserve current template data but resize arrays
        if (this.currentTemplateModel.hasContent) {
            const oldCurrentGrid = this.currentTemplateModel.grid;
            const oldCurrentHEdges = this.currentTemplateModel.horizontalEdges;
            const oldCurrentVEdges = this.currentTemplateModel.verticalEdges;

            // Create new arrays with current grid dimensions
            this.currentTemplateModel.grid = this.createEmptyGrid();
            this.currentTemplateModel.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
            this.currentTemplateModel.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);

            // Copy old data into new arrays (within bounds)
            const oldHeight = oldCurrentGrid.length;
            const oldWidth = oldCurrentGrid[0]?.length || 0;
            for (let y = 0; y < Math.min(oldHeight, this.gridHeight); y++) {
                for (let x = 0; x < Math.min(oldWidth, this.gridWidth); x++) {
                    this.currentTemplateModel.grid[y][x] = oldCurrentGrid[y][x];
                }
            }

            // Copy horizontal edges (within bounds)
            const oldHHeight = oldCurrentHEdges.length;
            const oldHWidth = oldCurrentHEdges[0]?.length || 0;
            for (let y = 0; y < Math.min(oldHHeight, this.gridHeight); y++) {
                for (let x = 0; x < Math.min(oldHWidth, this.gridWidth); x++) {
                    this.currentTemplateModel.horizontalEdges[y][x] = oldCurrentHEdges[y][x];
                }
            }

            // Copy vertical edges (within bounds)
            const oldVHeight = oldCurrentVEdges.length;
            const oldVWidth = oldCurrentVEdges[0]?.length || 0;
            for (let y = 0; y < Math.min(oldVHeight, this.gridHeight); y++) {
                for (let x = 0; x < Math.min(oldVWidth, this.gridWidth); x++) {
                    this.currentTemplateModel.verticalEdges[y][x] = oldCurrentVEdges[y][x];
                }
            }
        } else {
            // Create empty arrays if no content
            this.currentTemplateModel.grid = this.createEmptyGrid();
            this.currentTemplateModel.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
            this.currentTemplateModel.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        }

        // Update legacy references
        this.grid = this.sceneModel.grid;
        this.horizontalEdges = this.sceneModel.horizontalEdges;
        this.verticalEdges = this.sceneModel.verticalEdges;

        debug('[DEBUG] resizeTemplateModels: Completed resizing');
    }

    clearScene() {
        // Reset scene model to empty state
        this.sceneModel.grid = this.createEmptyGrid();
        this.sceneModel.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        this.sceneModel.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);

        // Only clear current template layer, preserve parent template
        this.currentTemplateModel.grid = this.createEmptyGrid();
        this.currentTemplateModel.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        this.currentTemplateModel.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        this.currentTemplateModel.hasContent = false;

        // Maintain compatibility with legacy grid references
        this.grid = this.sceneModel.grid;
        this.horizontalEdges = this.sceneModel.horizontalEdges;
        this.verticalEdges = this.sceneModel.verticalEdges;

        console.log('Scene cleared - ready for new content');
    }

    // Parse template content and populate template layer for ghosted rendering
    parseTemplateContent(templateData, dto) {
        debug('[DEBUG] parseTemplateContent: Entry:', {
            templateDataKeys: Object.keys(templateData),
            dtoType: dto.type,
            hasSceneData: !!templateData.sceneData,
            hasInstances: !!templateData.instances,
            hasParent: !!templateData.meta?.parent
        });

        // Determine if this is a child template with a parent
        const hasParent = templateData.meta?.parent;

        if (hasParent) {
            // This is a child template - move current template to parent layer if it exists
            if (this.currentTemplateModel.hasContent) {
                debug('[DEBUG] parseTemplateContent: Moving current template to parent layer');
                // Deep copy current template to parent layer
                this.parentTemplateModel.grid = this.currentTemplateModel.grid.map(row => [...row]);
                this.parentTemplateModel.horizontalEdges = this.currentTemplateModel.horizontalEdges.map(row => [...row]);
                this.parentTemplateModel.verticalEdges = this.currentTemplateModel.verticalEdges.map(row => [...row]);
                this.parentTemplateModel.hasContent = this.currentTemplateModel.hasContent;
                this.parentTemplateModel.templateData = this.currentTemplateModel.templateData;
            }

            // Clear current template layer for new child template
            this.currentTemplateModel.grid = this.createEmptyGrid();
            this.currentTemplateModel.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
            this.currentTemplateModel.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
            this.currentTemplateModel.hasContent = false;
            this.currentTemplateModel.templateData = templateData;
        } else {
            // This is a parent template - clear current but preserve parent
            this.currentTemplateModel.grid = this.createEmptyGrid();
            this.currentTemplateModel.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
            this.currentTemplateModel.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
            this.currentTemplateModel.hasContent = false;
            this.currentTemplateModel.templateData = templateData;
        }

        // Check if template has instances (scene content)
        if (templateData.instances && Array.isArray(templateData.instances)) {
            // Convert instances to grid representation
            this.parseInstancesIntoTemplateLayer(templateData.instances);
            this.templateModel.hasContent = true;
            console.log('Parsed template instances into ghosted layer:', templateData.instances.length);
        }

        // For mall templates, check for embedded scene content
        if (dto.type === 'mall') {
            debug('[DEBUG] parseTemplateContent: Processing mall template');
            if (templateData.sceneData) {
                debug('[DEBUG] parseTemplateContent: Found sceneData, parsing...');
                // Parse scene data (tiles and edges) into template layer
                this.parseSceneDataIntoTemplateLayer(templateData.sceneData);
                debug('[DEBUG] parseTemplateContent: Parsed mall scene data into ghosted layer');
            } else if (templateData.instances && Array.isArray(templateData.instances)) {
                debug('[DEBUG] parseTemplateContent: Found instances, parsing...');
                // Legacy: handle instances format
                this.parseInstancesIntoTemplateLayer(templateData.instances);
                this.templateModel.hasContent = true;
                debug('[DEBUG] parseTemplateContent: Parsed mall instances into ghosted layer');
            } else {
                debug('[DEBUG] parseTemplateContent: No scene data or instances, creating boundary');
                // Create ghosted boundary representation from mall structure
                this.createGhostedMallBoundary(dto);
            }
        }

        // For gallery/unit templates, handle scene data or create boundary from rect
        if (dto.type === 'unit') {
            debug('[DEBUG] parseTemplateContent: Processing gallery/unit template');
            if (templateData.sceneData) {
                // Parse scene data if available
                this.parseSceneDataIntoTemplateLayer(templateData.sceneData);
                debug('[DEBUG] parseTemplateContent: Parsed gallery scene data into ghosted layer');
            } else if (dto.rect) {
                debug('[DEBUG] parseTemplateContent: Creating gallery boundary from rect:', dto.rect);
                debug('[DEBUG] parseTemplateContent: Grid dimensions before boundary creation:', this.gridWidth, 'x', this.gridHeight);

                // Create ghosted boundary from gallery rect
                this.createGhostedRectOutline(dto.rect);
                this.currentTemplateModel.hasContent = true;

                debug('[DEBUG] parseTemplateContent: Gallery boundary created, currentTemplateModel.hasContent:', this.currentTemplateModel.hasContent);
                debug('[DEBUG] parseTemplateContent: Template states after gallery boundary:', {
                    parentHasContent: this.parentTemplateModel.hasContent,
                    currentHasContent: this.currentTemplateModel.hasContent
                });
            } else {
                debug('[DEBUG] parseTemplateContent: No sceneData or rect found for gallery template');
            }
        }
    }

    // Parse template content using Template Relationship Manager result
    parseTemplateContentWithRelationships(relationshipResult) {
        debug('[DEBUG] parseTemplateContentWithRelationships: Entry:', relationshipResult);

        // Clear existing template layers
        this.parentTemplateModel.grid = this.createEmptyGrid();
        this.parentTemplateModel.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        this.parentTemplateModel.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        this.parentTemplateModel.hasContent = false;

        this.currentTemplateModel.grid = this.createEmptyGrid();
        this.currentTemplateModel.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        this.currentTemplateModel.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        this.currentTemplateModel.hasContent = false;

        // Process parent template if it exists
        if (relationshipResult.hasParent && relationshipResult.parent) {
            debug('[DEBUG] parseTemplateContentWithRelationships: Processing parent template');
            const parentData = relationshipResult.parent.templateData;
            const parentDto = relationshipResult.parent.dto;

            // Parse parent template content into parent layer
            this.parseTemplateIntoLayer(parentData, parentDto, 'parent');
            debug('[DEBUG] parseTemplateContentWithRelationships: Parent template parsed');
        }

        // Process current template
        if (relationshipResult.current) {
            debug('[DEBUG] parseTemplateContentWithRelationships: Processing current template');
            const currentData = relationshipResult.current.templateData;
            const currentDto = relationshipResult.current.dto;

            // Parse current template content into current layer
            this.parseTemplateIntoLayer(currentData, currentDto, 'current');
            debug('[DEBUG] parseTemplateContentWithRelationships: Current template parsed');
        }

        debug('[DEBUG] parseTemplateContentWithRelationships: Complete. Template states:', {
            parentHasContent: this.parentTemplateModel.hasContent,
            currentHasContent: this.currentTemplateModel.hasContent
        });
    }

    // Parse template data into a specific layer (parent or current)
    parseTemplateIntoLayer(templateData, dto, layer) {
        console.log(`[DEBUG] parseTemplateIntoLayer: Processing ${layer} layer:`, {
            templateType: dto.type,
            hasSceneData: !!templateData.sceneData,
            hasInstances: !!templateData.instances
        });

        // Select the target template model
        const targetModel = layer === 'parent' ? this.parentTemplateModel : this.currentTemplateModel;

        // Store template data reference
        targetModel.templateData = templateData;

        // Check if template has instances (scene content)
        if (templateData.instances && Array.isArray(templateData.instances)) {
            console.log(`[DEBUG] parseTemplateIntoLayer: Parsing ${templateData.instances.length} instances into ${layer} layer`);
            this.parseInstancesIntoLayer(templateData.instances, layer);
            targetModel.hasContent = true;
        }

        // For mall templates, check for embedded scene content
        if (dto.type === 'mall') {
            console.log(`[DEBUG] parseTemplateIntoLayer: Processing mall template in ${layer} layer`);
            if (templateData.sceneData) {
                console.log(`[DEBUG] parseTemplateIntoLayer: Found sceneData, parsing into ${layer} layer`);
                this.parseSceneDataIntoLayer(templateData.sceneData, layer);
            } else if (templateData.instances && Array.isArray(templateData.instances)) {
                console.log(`[DEBUG] parseTemplateIntoLayer: Found instances, parsing into ${layer} layer`);
                this.parseInstancesIntoLayer(templateData.instances, layer);
                targetModel.hasContent = true;
            } else {
                console.log(`[DEBUG] parseTemplateIntoLayer: No scene data or instances, creating boundary in ${layer} layer`);
                this.createGhostedMallBoundaryInLayer(dto, layer);
            }
        }

        // For gallery/unit templates, handle scene data or create boundary from rect
        if (dto.type === 'unit') {
            console.log(`[DEBUG] parseTemplateIntoLayer: Processing gallery/unit template in ${layer} layer`);
            if (templateData.sceneData) {
                this.parseSceneDataIntoLayer(templateData.sceneData, layer);
            } else if (dto.rect) {
                console.log(`[DEBUG] parseTemplateIntoLayer: Creating gallery boundary from rect in ${layer} layer:`, dto.rect);
                this.createGhostedRectOutlineInLayer(dto.rect, layer);
                targetModel.hasContent = true;
            } else {
                console.log(`[DEBUG] parseTemplateIntoLayer: No sceneData or rect found for gallery template in ${layer} layer`);
            }
        }

        // For room templates, handle scene data or create boundary from rect
        if (dto.type === 'room') {
            console.log(`[DEBUG] parseTemplateIntoLayer: Processing room template in ${layer} layer`);
            if (templateData.sceneData) {
                this.parseSceneDataIntoLayer(templateData.sceneData, layer);
            } else if (dto.rect) {
                console.log(`[DEBUG] parseTemplateIntoLayer: Creating room boundary from rect in ${layer} layer:`, dto.rect);
                this.createGhostedRectOutlineInLayer(dto.rect, layer);
                targetModel.hasContent = true;
            } else {
                console.log(`[DEBUG] parseTemplateIntoLayer: No sceneData or rect found for room template in ${layer} layer`);
            }
        }
        // For object templates, handle scene data or create boundary from rect
        if (dto.type === 'object') {
            console.log(`[DEBUG] parseTemplateIntoLayer: Processing object template in ${layer} layer`);
            if (templateData.sceneData) {
                this.parseSceneDataIntoLayer(templateData.sceneData, layer);
            } else if (dto.rect) {
                console.log(`[DEBUG] parseTemplateIntoLayer: Creating object boundary from rect in ${layer} layer:`, dto.rect);
                this.createGhostedRectOutlineInLayer(dto.rect, layer);
                targetModel.hasContent = true;
            } else {
                console.log(`[DEBUG] parseTemplateIntoLayer: No sceneData or rect found for object template in ${layer} layer`);
            }
        }

        console.log(`[DEBUG] parseTemplateIntoLayer: Completed ${layer} layer processing. hasContent:`, targetModel.hasContent);
    }

    // Convert scene instances to template grid representation (layer-aware)
    parseInstancesIntoLayer(instances, layer = 'current') {
        const targetModel = layer === 'parent' ? this.parentTemplateModel : this.currentTemplateModel;

        instances.forEach(instance => {
            if (instance.position && instance.type) {
                const [worldX, worldY, worldZ] = instance.position;
                const gridX = Math.floor(worldX / 2);
                const gridY = Math.floor(worldZ / 2);

                if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
                    if (instance.type === 'lobbyFloor') {
                        targetModel.grid[gridY][gridX] = 'floor';
                    }
                    // Handle wall instances by adding edges
                    // This is simplified - you might need more sophisticated wall detection
                }
            }
        });
    }

    // Convert scene data (tiles and edges) to template grid representation (layer-aware)
    parseSceneDataIntoLayer(sceneData, layer = 'current') {
        console.log(`[DEBUG] parseSceneDataIntoLayer: Entry with sceneData in ${layer} layer:`, sceneData);

        const targetModel = layer === 'parent' ? this.parentTemplateModel : this.currentTemplateModel;
        let floorsAdded = 0;
        let hEdgesAdded = 0;
        let vEdgesAdded = 0;

        // Parse floor tiles
        if (sceneData.tiles && sceneData.tiles.floor) {
            console.log(`[DEBUG] parseSceneDataIntoLayer: Processing ${sceneData.tiles.floor.length} floor tiles in ${layer} layer`);
            sceneData.tiles.floor.forEach(([x, y]) => {
                if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
                    targetModel.grid[y][x] = 'floor';
                    floorsAdded++;
                } else {
                    console.log(`[DEBUG] parseSceneDataIntoLayer: Floor tile out of bounds in ${layer} layer:`, [x, y]);
                }
            });
        }

        // Parse horizontal edges
        if (sceneData.edges && sceneData.edges.horizontal) {
            console.log(`[DEBUG] parseSceneDataIntoLayer: Processing ${sceneData.edges.horizontal.length} horizontal edges in ${layer} layer`);
            sceneData.edges.horizontal.forEach(([x, y]) => {
                if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
                    targetModel.horizontalEdges[y][x] = true;
                    hEdgesAdded++;
                } else {
                    console.log(`[DEBUG] parseSceneDataIntoLayer: H-edge out of bounds in ${layer} layer:`, [x, y]);
                }
            });
        }

        // Parse vertical edges
        if (sceneData.edges && sceneData.edges.vertical) {
            console.log(`[DEBUG] parseSceneDataIntoLayer: Processing ${sceneData.edges.vertical.length} vertical edges in ${layer} layer`);
            sceneData.edges.vertical.forEach(([x, y]) => {
                if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
                    targetModel.verticalEdges[y][x] = true;
                    vEdgesAdded++;
                } else {
                    console.log(`[DEBUG] parseSceneDataIntoLayer: V-edge out of bounds in ${layer} layer:`, [x, y]);
                }
            });
        }

        // Set hasContent flag if we actually added anything
        if (floorsAdded > 0 || hEdgesAdded > 0 || vEdgesAdded > 0) {
            targetModel.hasContent = true;
        }

        console.log(`[DEBUG] parseSceneDataIntoLayer: Conversion complete for ${layer} layer:`, {
            floorsAdded,
            hEdgesAdded,
            vEdgesAdded,
            hasContent: targetModel.hasContent
        });
    }

    // Create ghosted boundary representation for mall templates (layer-aware)
    createGhostedMallBoundaryInLayer(dto, layer = 'current') {
        const targetModel = layer === 'parent' ? this.parentTemplateModel : this.currentTemplateModel;

        // If mall has units, create ghosted outlines for each unit
        if (dto.units && dto.units.length > 0) {
            dto.units.forEach(unit => {
                if (unit.rect) {
                    this.createGhostedRectOutlineInLayer(unit.rect, layer);
                }
            });
            targetModel.hasContent = true;
            console.log(`Created ghosted unit boundaries for ${dto.units.length} units in ${layer} layer`);
        }
        // If mall has rect but no units, create ghosted outline for the mall area
        else if (dto.rect) {
            this.createGhostedRectOutlineInLayer(dto.rect, layer);
            targetModel.hasContent = true;
            console.log(`Created ghosted mall boundary from rect in ${layer} layer:`, dto.rect);
        }
    }

    // Create ghosted rectangular outline (layer-aware)
    createGhostedRectOutlineInLayer(rect, layer = 'current') {
        const targetModel = layer === 'parent' ? this.parentTemplateModel : this.currentTemplateModel;
        const { x, y, w, h } = rect;
        let edgesAdded = 0;

        console.log(`[DEBUG] createGhostedRectOutlineInLayer: Creating outline for rect ${JSON.stringify(rect)} in ${layer} layer`);

        // Top edge
        for (let i = 0; i < w; i++) {
            if (x + i >= 0 && x + i < this.gridWidth && y >= 0 && y < this.gridHeight) {
                targetModel.horizontalEdges[y][x + i] = true;
                edgesAdded++;
            }
        }

        // Bottom edge
        for (let i = 0; i < w; i++) {
            if (x + i >= 0 && x + i < this.gridWidth && y + h >= 0 && y + h < this.gridHeight) {
                targetModel.horizontalEdges[y + h][x + i] = true;
                edgesAdded++;
            }
        }

        // Left edge
        for (let i = 0; i < h; i++) {
            if (x >= 0 && x < this.gridWidth && y + i >= 0 && y + i < this.gridHeight) {
                targetModel.verticalEdges[y + i][x] = true;
                edgesAdded++;
            }
        }

        // Right edge
        for (let i = 0; i < h; i++) {
            if (x + w >= 0 && x + w < this.gridWidth && y + i >= 0 && y + i < this.gridHeight) {
                targetModel.verticalEdges[y + i][x + w] = true;
                edgesAdded++;
            }
        }

        if (edgesAdded > 0) {
            targetModel.hasContent = true;
        }

        console.log(`[DEBUG] createGhostedRectOutlineInLayer: Created ${edgesAdded} edges in ${layer} layer`);
    }

    // Convert scene instances to template grid representation (legacy wrapper)
    parseInstancesIntoTemplateLayer(instances) {
        this.parseInstancesIntoLayer(instances, 'current');
    }

    // Convert scene data (tiles and edges) to template grid representation (legacy wrapper)
    parseSceneDataIntoTemplateLayer(sceneData) {
        this.parseSceneDataIntoLayer(sceneData, 'current');
    }

    // Create ghosted boundary representation for mall templates without scene content (legacy wrapper)
    createGhostedMallBoundary(dto) {
        this.createGhostedMallBoundaryInLayer(dto, 'current');
    }

    // Create a ghosted outline (border only) for a rectangle (legacy wrapper)
    createGhostedRectOutline(rect) {
        this.createGhostedRectOutlineInLayer(rect, 'current');
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


        // Clear button functionality now handled through dropdown

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


        // Ensure Export → Mall Template is always enabled (no gating)
        const exportMallItem = document.getElementById('export-mall-template-item');
        if (exportMallItem) {
            exportMallItem.classList.remove('disabled');
            exportMallItem.setAttribute('aria-disabled', 'false');
            exportMallItem.title = '';
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
        // Skip rendering empty cells to avoid overwriting ghosted content
        if (this.grid[y][x] === 'empty') {
            // Only draw grid lines for empty cells, don't fill them
            this.ctx.strokeStyle = '#ccc';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
            return;
        }

        // Render non-empty cells normally
        const color = this.colors[this.grid[y][x]];
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);

        // Draw grid lines
        this.ctx.strokeStyle = '#ccc';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
    }

    // Render template content as ghosted (faded) background
    renderGhostedContent() {
        // Get current template layers from relationship manager
        const layers = this.templateRelationshipManager.getCurrentLayers();

        debug('[DEBUG] renderGhostedContent: Using template layers from relationship manager:', {
            hasParent: layers.hasParent,
            hierarchy: layers.hierarchy?.length || 0,
            levels: layers.levels || 0
        });

        // Render multi-level hierarchy if available
        if (layers.hierarchy && layers.hierarchy.length > 0) {
            debug('[DEBUG] renderGhostedContent: Rendering multi-level hierarchy:',
                layers.hierarchy.map(t => t.dto.type));

            // Render each level in the hierarchy
            layers.hierarchy.forEach((template, index) => {
                const templateType = template.dto?.type || 'unknown';
                const isCurrentLevel = index === layers.hierarchy.length - 1;

                console.log(`[DEBUG] renderGhostedContent: Rendering hierarchy level ${index}: ${templateType}`,
                    isCurrentLevel ? '(current)' : '(parent)');

                // Convert to legacy template model format for rendering
                const templateModel = this.createLegacyTemplateModel(template);

                // Choose colors and opacity based on template type and position
                if (isCurrentLevel) {
                    // Current template - higher opacity and distinct colors per type
                    if (templateType === 'object') {
                        this.renderTemplateLayer(templateModel, '#ccddff', '#0066cc', 0.8); // Blue object
                    } else if (templateType === 'room') {
                        this.renderTemplateLayer(templateModel, '#ccddff', '#0066cc', 0.8); // Blue room
                    } else if (templateType === 'unit') {
                        this.renderTemplateLayer(templateModel, '#ccffcc', '#00aa00', 0.8); // Green gallery/unit
                    } else if (templateType === 'mall') {
                        this.renderTemplateLayer(templateModel, '#ffeecc', '#cc8800', 0.8); // Orange mall
                    } else {
                        this.renderTemplateLayer(templateModel, '#ccffcc', '#00aa00', 0.8); // Default green
                    }
                } else {
                    // Parent/ancestor templates - progressive grey shades (darker = further back)
                    const hierarchyDepth = layers.hierarchy.length - 1; // Index of current (last) template
                    const distanceFromCurrent = hierarchyDepth - index; // How far back this template is

                    // Progressive grey opacity: closer ancestors are lighter, farther ones darker
                    // Level 0 (deepest): darkest grey (0.15)
                    // Level 1: medium grey (0.25)
                    // Level 2: light grey (0.35)
                    const opacity = 0.15 + (distanceFromCurrent * 0.1);
                    this.renderTemplateLayer(templateModel, '#cccccc', '#999999', opacity); // Progressive grey ancestors
                }
            });
        }

        // Fallback to legacy models if relationship manager doesn't have data
        if (!layers.hierarchy || layers.hierarchy.length === 0) {
            debug('[DEBUG] renderGhostedContent: No hierarchy data, falling back to legacy models');

            // Render parent template layer (grey, lower opacity)
            if (this.parentTemplateModel.hasContent) {
                debug('[DEBUG] renderGhostedContent: Rendering legacy parent template layer (grey)');
                this.renderTemplateLayer(this.parentTemplateModel, '#cccccc', '#999999', 0.4); // Grey parent
            }

            // Render current template layer with type-specific colors
            if (this.currentTemplateModel.hasContent) {
                const templateType = this.currentDto?.type || 'unknown';
                debug('[DEBUG] renderGhostedContent: Rendering legacy current template layer:', templateType);

                // Use type-specific colors
                if (templateType === 'room') {
                    this.renderTemplateLayer(this.currentTemplateModel, '#ccddff', '#0066cc', 0.8); // Blue room
                } else if (templateType === 'unit') {
                    this.renderTemplateLayer(this.currentTemplateModel, '#ccffcc', '#00aa00', 0.8); // Green gallery/unit
                } else if (templateType === 'mall') {
                    this.renderTemplateLayer(this.currentTemplateModel, '#ffeecc', '#cc8800', 0.8); // Orange mall
                } else {
                    this.renderTemplateLayer(this.currentTemplateModel, '#ccffcc', '#00aa00', 0.8); // Default green
                }
            }
        }

        // Debug: Log template states
        debug('[DEBUG] renderGhostedContent: Template states:', {
            relationshipManager: {
                hasParent: layers.hasParent,
                parentHasContent: layers.parent ? true : false,
                currentHasContent: layers.current ? true : false
            },
            legacy: {
                parentHasContent: this.parentTemplateModel.hasContent,
                currentHasContent: this.currentTemplateModel.hasContent
            }
        });
    }

    // Convert relationship manager template data to legacy template model format
    createLegacyTemplateModel(relationshipTemplate) {
        if (!relationshipTemplate) return null;

        const templateData = relationshipTemplate.templateData;
        const dto = relationshipTemplate.dto;

        // Create a temporary template model with the same structure
        const legacyModel = {
            grid: this.createEmptyGrid(),
            horizontalEdges: this.createEmptyEdgeSet(this.gridWidth, this.gridHeight),
            verticalEdges: this.createEmptyEdgeSet(this.gridWidth, this.gridHeight),
            hasContent: false,
            templateData: templateData
        };

        // Parse the template content into the legacy model
        this.parseTemplateContentIntoLegacyModel(templateData, dto, legacyModel);

        return legacyModel;
    }

    // Parse template content into a legacy model structure
    parseTemplateContentIntoLegacyModel(templateData, dto, targetModel) {
        debug('[DEBUG] parseTemplateContentIntoLegacyModel: Processing:', {
            templateType: dto.type,
            hasSceneData: !!templateData.sceneData,
            hasInstances: !!templateData.instances
        });

        // Check if template has instances (scene content)
        if (templateData.instances && Array.isArray(templateData.instances)) {
            this.parseInstancesIntoLegacyModel(templateData.instances, targetModel);
            targetModel.hasContent = true;
        }

        // For mall templates, check for embedded scene content
        if (dto.type === 'mall') {
            if (templateData.sceneData) {
                this.parseSceneDataIntoLegacyModel(templateData.sceneData, targetModel);
            } else if (templateData.instances && Array.isArray(templateData.instances)) {
                this.parseInstancesIntoLegacyModel(templateData.instances, targetModel);
                targetModel.hasContent = true;
            } else {
                this.createGhostedMallBoundaryInLegacyModel(dto, targetModel);
            }
        }

        // For gallery/unit templates, handle scene data or create boundary from rect
        if (dto.type === 'unit') {
            if (templateData.sceneData) {
                this.parseSceneDataIntoLegacyModel(templateData.sceneData, targetModel);
            } else if (dto.rect) {
                this.createGhostedRectOutlineInLegacyModel(dto.rect, targetModel);
                targetModel.hasContent = true;
            }
        }

        // For room templates, handle scene data or create boundary from rect
        if (dto.type === 'room') {
            if (templateData.sceneData) {
                this.parseSceneDataIntoLegacyModel(templateData.sceneData, targetModel);
            } else if (dto.rect) {
                this.createGhostedRectOutlineInLegacyModel(dto.rect, targetModel);
                targetModel.hasContent = true;
            }
        }
        // For object templates, handle scene data or create boundary from rect
        if (dto.type === 'object') {
            if (templateData.sceneData) {
                this.parseSceneDataIntoLegacyModel(templateData.sceneData, targetModel);
            } else if (dto.rect) {
                this.createGhostedRectOutlineInLegacyModel(dto.rect, targetModel);
                targetModel.hasContent = true;
            }
        }
    }

    // Helper methods for legacy model creation
    parseInstancesIntoLegacyModel(instances, targetModel) {
        instances.forEach(instance => {
            if (instance.position && instance.type) {
                const [worldX, worldY, worldZ] = instance.position;
                const gridX = Math.floor(worldX / 2);
                const gridY = Math.floor(worldZ / 2);

                if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
                    if (instance.type === 'lobbyFloor') {
                        targetModel.grid[gridY][gridX] = 'floor';
                    }
                }
            }
        });
    }

    parseSceneDataIntoLegacyModel(sceneData, targetModel) {
        let floorsAdded = 0;
        let hEdgesAdded = 0;
        let vEdgesAdded = 0;

        // Parse floor tiles
        if (sceneData.tiles && sceneData.tiles.floor) {
            sceneData.tiles.floor.forEach(([x, y]) => {
                if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
                    targetModel.grid[y][x] = 'floor';
                    floorsAdded++;
                }
            });
        }

        // Parse horizontal edges
        if (sceneData.edges && sceneData.edges.horizontal) {
            sceneData.edges.horizontal.forEach(([x, y]) => {
                if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
                    targetModel.horizontalEdges[y][x] = true;
                    hEdgesAdded++;
                }
            });
        }

        // Parse vertical edges
        if (sceneData.edges && sceneData.edges.vertical) {
            sceneData.edges.vertical.forEach(([x, y]) => {
                if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
                    targetModel.verticalEdges[y][x] = true;
                    vEdgesAdded++;
                }
            });
        }

        if (floorsAdded > 0 || hEdgesAdded > 0 || vEdgesAdded > 0) {
            targetModel.hasContent = true;
        }
    }

    createGhostedMallBoundaryInLegacyModel(dto, targetModel) {
        if (dto.units && dto.units.length > 0) {
            dto.units.forEach(unit => {
                if (unit.rect) {
                    this.createGhostedRectOutlineInLegacyModel(unit.rect, targetModel);
                }
            });
            targetModel.hasContent = true;
        } else if (dto.rect) {
            this.createGhostedRectOutlineInLegacyModel(dto.rect, targetModel);
            targetModel.hasContent = true;
        }
    }

    createGhostedRectOutlineInLegacyModel(rect, targetModel) {
        const { x, y, w, h } = rect;
        let edgesAdded = 0;

        // Top edge
        for (let i = 0; i < w; i++) {
            if (x + i >= 0 && x + i < this.gridWidth && y >= 0 && y < this.gridHeight) {
                targetModel.horizontalEdges[y][x + i] = true;
                edgesAdded++;
            }
        }

        // Bottom edge
        for (let i = 0; i < w; i++) {
            if (x + i >= 0 && x + i < this.gridWidth && y + h >= 0 && y + h < this.gridHeight) {
                targetModel.horizontalEdges[y + h][x + i] = true;
                edgesAdded++;
            }
        }

        // Left edge
        for (let i = 0; i < h; i++) {
            if (x >= 0 && x < this.gridWidth && y + i >= 0 && y + i < this.gridHeight) {
                targetModel.verticalEdges[y + i][x] = true;
                edgesAdded++;
            }
        }

        // Right edge
        for (let i = 0; i < h; i++) {
            if (x + w >= 0 && x + w < this.gridWidth && y + i >= 0 && y + i < this.gridHeight) {
                targetModel.verticalEdges[y + i][x + w] = true;
                edgesAdded++;
            }
        }

        if (edgesAdded > 0) {
            targetModel.hasContent = true;
        }
    }

    // Render a specific template layer with given colors and opacity
    renderTemplateLayer(templateModel, floorColor, edgeColor, opacity) {
        this.ctx.save();
        this.ctx.globalAlpha = opacity;

        let floorsRendered = 0;
        let hEdgesRendered = 0;
        let vEdgesRendered = 0;

        // Render template floor tiles
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (templateModel.grid[y][x] === 'floor') {
                    // Render ghosted floor tile
                    this.ctx.fillStyle = floorColor;
                    this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);

                    // Subtle grid lines for ghosted content
                    this.ctx.strokeStyle = edgeColor;
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                    floorsRendered++;
                }
            }
        }

        // Render template edges (walls) - make them more visible
        this.ctx.strokeStyle = edgeColor;
        this.ctx.lineWidth = opacity > 0.6 ? 4 : 2; // Thicker lines for current template (higher opacity)

        // Horizontal edges
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (templateModel.horizontalEdges[y][x]) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(x * this.cellSize, y * this.cellSize);
                    this.ctx.lineTo((x + 1) * this.cellSize, y * this.cellSize);
                    this.ctx.stroke();
                    hEdgesRendered++;
                }
            }
        }

        // Vertical edges
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (templateModel.verticalEdges[y][x]) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(x * this.cellSize, y * this.cellSize);
                    this.ctx.lineTo(x * this.cellSize, (y + 1) * this.cellSize);
                    this.ctx.stroke();
                    vEdgesRendered++;
                }
            }
        }

        debug('[DEBUG] renderTemplateLayer: Rendered', {
            floors: floorsRendered,
            hEdges: hEdgesRendered,
            vEdges: vEdgesRendered,
            opacity: opacity,
            floorColor: floorColor,
            edgeColor: edgeColor
        });

        this.ctx.restore();
    }

    render() {
        debug('[DEBUG] render: Starting render cycle');
        debug('[DEBUG] render: Canvas dimensions:', this.canvas.width, 'x', this.canvas.height);
        debug('[DEBUG] render: Grid dimensions:', this.gridWidth, 'x', this.gridHeight);
        debug('[DEBUG] render: Template states:', {
            parentHasContent: this.parentTemplateModel?.hasContent,
            currentHasContent: this.currentTemplateModel?.hasContent,
            showTemplate: this.showTemplate,
            templateType: this.templateType
        });

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Render ghosted template content first (behind user content)
        this.renderGhostedContent();

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
                // No longer draw overlay boundaries - ghosted content defines the area
                // Units and mall rect are now represented by the ghosted template content

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
                this.ctx.fillText(`Mall Template (${dto.units?.length || 0} galleries)`, 10, 25);
                this.ctx.restore();
                break;
            }

            case 'unit': { // gallery alias
                // No longer draw overlay boundaries - ghosted content defines the area

                // Draw template info
                this.ctx.save();
                this.ctx.fillStyle = '#00BCD4';
                this.ctx.globalAlpha = 0.8;
                this.ctx.font = '14px Arial';
                const roomCount = dto.children?.length || 0;
                this.ctx.fillText(`Unit Template (${roomCount} rooms)`, 10, 25);
                this.ctx.restore();
                break;
            }

            case 'room': {
                // No longer draw overlay boundaries - ghosted content defines the area

                // Draw each zone.rect if present
                dto.children?.forEach(z => {
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
                const zoneCount = dto.children?.length || 0;
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

    clearAll() {
        // Clear both scene content and template
        this.clearScene();
        this.clearTemplate();
        this.showToast('success', 'Cleared', 'All content and templates cleared');
    }

    /**
     * Unified grid resizing for all template types
     * @param {Object} dto - Template DTO
     */
    resizeGridForTemplate(dto) {
        debug('[DEBUG] resizeGridForTemplate:', { type: dto.type, rect: dto.rect, gridSize: dto.gridSize });

        const oldGridWidth = this.gridWidth;
        const oldGridHeight = this.gridHeight;

        // Different resize behavior based on template type
        switch (dto.type) {
            case 'mall':
                // Mall templates: ensure grid covers all units or use explicit gridSize
                if (dto.gridSize) {
                    this.gridWidth = dto.gridSize.width || this.gridWidth;
                    this.gridHeight = dto.gridSize.height || this.gridHeight;
                } else if (dto.rect) {
                    // Use mall rect if available
                    this.gridWidth = Math.max(dto.rect.x + dto.rect.w, this.gridWidth);
                    this.gridHeight = Math.max(dto.rect.y + dto.rect.h, this.gridHeight);
                }
                break;

            case 'unit':
            case 'room':
            case 'object':
                // Child templates: resize grid to template dimensions for constrained editing
                if (dto.rect && dto.rect.w > 0 && dto.rect.h > 0) {
                    this.gridWidth = dto.rect.w;
                    this.gridHeight = dto.rect.h;
                    debug('[DEBUG] Child template: resized grid to template dimensions');
                } else {
                    console.warn('[DEBUG] Child template has invalid rect, keeping current grid size');
                }
                break;

            case 'scene':
                // Scene: no resizing needed, keep current dimensions
                break;

            default:
                console.warn('[DEBUG] Unknown template type for grid resize:', dto.type);
        }

        // Only resize arrays if dimensions actually changed
        if (this.gridWidth !== oldGridWidth || this.gridHeight !== oldGridHeight) {
            debug('[DEBUG] Grid dimensions changed:', {
                from: { width: oldGridWidth, height: oldGridHeight },
                to: { width: this.gridWidth, height: this.gridHeight }
            });
            this.resizeTemplateModels();
            this.render();
        } else {
            debug('[DEBUG] Grid dimensions unchanged, skipping resize');
        }
    }

    clearTemplate() {
        this.overlayModel = { templateData: null, bounds: null, constraints: null };
        this.showTemplate = false;
        this.templateType = null;
        this.templateContext = {};
        this.activeUnit = null; // Clear active unit when clearing template
        this.baseBounds = null; // Clear stored bounds
        this.limitToActiveUnit = false; // Reset limit checkbox

        // Clear Template Relationship Manager
        debug('[DEBUG] clearTemplate: Clearing Template Relationship Manager');
        this.templateRelationshipManager.clearAll();

        // Clear both template layers
        this.parentTemplateModel.grid = this.createEmptyGrid();
        this.parentTemplateModel.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        this.parentTemplateModel.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        this.parentTemplateModel.hasContent = false;
        this.parentTemplateModel.templateData = null;

        this.currentTemplateModel.grid = this.createEmptyGrid();
        this.currentTemplateModel.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        this.currentTemplateModel.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
        this.currentTemplateModel.hasContent = false;
        this.currentTemplateModel.templateData = null;

        const limitCheckbox = document.getElementById('limit-edits-to-active-unit');
        if (limitCheckbox) limitCheckbox.checked = false;
        this.updateModeBadge();
        this.updateExportButtonVisibility();
        this.render();
        this.showToast('success', 'Template Cleared', 'Template overlay and ghosted content cleared');
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
        const errors = [];
        if (!sceneData.meta || sceneData.meta.schema !== "scene.v1") {
            errors.push('Invalid scene.v1 format');
        }
        if (!sceneData.grid) {
            errors.push('Missing grid data in scene.v1');
        }

        if (errors.length > 0) {
            this.handleTemplateErrors(errors, 'loading', 'scene');
            return;
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
            case 'mall-template':
                this.handleExportMallTemplate();
                break;
            case 'gallery-template':
                this.exportAsGalleryTemplate();
                break;
            case 'room-template':
                this.exportAsRoomTemplate();
                break;
            case 'object-template':
                this.exportAsObjectTemplate();
                break;
            case 'clear-all':
                this.clearAll();
                break;
            case 'clear-grid':
                this.clearScene();
                break;
            case 'clear-template':
                this.clearTemplate();
                break;
            default:
                this.handleExportMallTemplate(); // Default to mall template
        }
    }

    handleExportSelectedUnit() {
        // Check if we're in mall mode with an active unit selected
        if (this.overlayModel?.templateData?.type !== 'mall' || !this.activeUnit) {
            this.showToast('Please select a gallery in mall mode first', 'warning');
            return;
        }

        const dto = this.overlayModel.templateData;
        const selectedUnit = dto.units?.find(u =>
            u.id === this.activeUnit.id ||
            (u.rect.x === this.activeUnit.rect.x && u.rect.y === this.activeUnit.rect.y)
        );

        if (!selectedUnit) {
            this.showToast('Selected gallery not found in template data', 'error');
            return;
        }

        // Use ExportBuilder to create unit template from the selected unit
        const unitTemplate = buildUnitTemplate({
            id: selectedUnit.id || 'unit',
            rect: selectedUnit.rect,
            rooms: selectedUnit.children || [],
            parentMallId: dto.id
        });

        // Download the unit template
        const fileName = `${selectedUnit.id || 'unit'}-template.json`;
        this.downloadJSON(fileName, unitTemplate);
        this.showToast('success', 'Gallery Template Exported', `Exported gallery template: ${selectedUnit.id || 'gallery'}`);
    }

    handleExportMallTemplate() {
        // Entry logging
        console.info('[EXPORT:mall] enter', {
            mode: this.mode,
            type: this.overlayModel?.templateData?.type
        });

        const dto = this.overlayModel?.templateData || null;
        let gridSize = { width: this.gridWidth, height: this.gridHeight };
        let id = 'mall';
        let galleries = []; // a.k.a. "units" in schema

        if (dto && dto.type === 'mall') {
            id = dto.id || id;
            gridSize = dto.gridSize || gridSize;
            galleries = Array.isArray(dto.units)
                ? dto.units.filter(u => u && u.rect &&
                    Number.isFinite(u.rect.x) && Number.isFinite(u.rect.y) &&
                    Number.isFinite(u.rect.w) && Number.isFinite(u.rect.h) &&
                    u.rect.w > 0 && u.rect.h > 0)
                : [];
        }

        if (!Number.isFinite(gridSize.width) || !Number.isFinite(gridSize.height) ||
            gridSize.width <= 0 || gridSize.height <= 0) {
            this.handleTemplateErrors(['Invalid grid size'], 'export', 'mall');
            return;
        }

        const out = buildMallTemplate({
            id,
            gridWidth: gridSize.width,
            gridHeight: gridSize.height,
            cellSize: this.cellSize || 1,
            units: galleries
        });

        // Ensure rect is included when units are empty (zzz20)
        if (out.units.length === 0) {
            const grid = out.grid || out.gridSize;
            if (grid && grid.width && grid.height) {
                out.rect = { x: 0, y: 0, w: grid.width, h: grid.height };
            }
        }

        // Add current scene content for ghosted rendering when template is loaded back
        const sceneData = this.toSceneV1();
        debug('[DEBUG] Export: toSceneV1() returned:', sceneData);
        if (sceneData && (sceneData.tiles?.floor?.length > 0 ||
                          sceneData.edges?.horizontal?.length > 0 ||
                          sceneData.edges?.vertical?.length > 0)) {
            out.sceneData = sceneData;
            debug('[DEBUG] Export: Added scene data to mall template:', {
                floors: sceneData.tiles?.floor?.length || 0,
                hEdges: sceneData.edges?.horizontal?.length || 0,
                vEdges: sceneData.edges?.vertical?.length || 0
            });
        } else {
            debug('[DEBUG] Export: No scene data to add - scene is empty');
        }

        // Compute safe filename with timestamp
        const safeId = String(out?.id || 'mall').trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'mall';
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15); // YYYYMMDDTHHMMSS
        const filename = `${safeId}-${timestamp}.mall-template.v1.json`;
        console.info('[EXPORT:mall] file', filename);

        // Runtime assertions for mall export
        console.assert(out?.meta?.schema === 'mall-template.v1', 'Mall export: wrong schema');
        console.assert(Array.isArray(out?.units), 'Mall export: units must be array');
        console.assert(out?.grid || out?.gridSize, 'Mall export: grid/gridSize missing');

        // Download JSON using unified helper
        this.downloadJSON(filename, out);

        // Log for diagnostics:
        console.info('[EXPORT:mall] built', {
            id: out.id,
            grid: gridSize,
            units: galleries.length,
            fresh: !dto
        });

        this.showToast('success', 'Mall Template Exported', `Exported mall template: ${out.id}`);
    }

    // Export as Mall Template format for unit splitting workflow
    exportAsMallTemplate() {
        // Detect units from connected floor regions
        const units = this.detectUnitsFromFloorTiles();

        // Validate minimum unit requirement
        if (units.length === 0) {
            this.handleTemplateErrors(['No units detected; draw floor tiles first.'], 'export', 'mall');
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

        const mallId = mallTemplate.id || 'mall';
        const filename = `${mallId}.json`;
        this.downloadJSON(filename, mallTemplate);

        console.log('Exported mall template:', mallTemplate);
        this.showToast('success', 'Mall Template Exported', `Mall template saved (${units.length} galleries detected). Ready for template loading workflow.`);
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
    /**
     * Unified export method for child templates (gallery, room, object)
     * @param {Object} config - Export configuration
     */
    exportChildTemplate(config) {
        const dto = this.overlayModel?.templateData;

        // Validate parent template type is correct
        if (!dto || dto.type !== config.requiredParentType) {
            this.handleTemplateErrors(
                [`Load a ${config.parentTypeName} template first to export ${config.templateName.toLowerCase()}s`],
                `${config.templateName} Export`,
                config.templateName.toLowerCase()
            );
            return;
        }

        // Get current template ID from relationship manager
        const layers = this.templateRelationshipManager.getCurrentLayers();
        const currentParentId = layers.current?.id || dto.id || config.fallbackParentId;
        console.log(`[DEBUG] ${config.templateName} export - Parent template ID:`, currentParentId);

        // Get the current scene content (what the user actually drew)
        const sceneData = this.toSceneV1();

        // Check if there's any content to export
        if (!sceneData ||
            (!sceneData.tiles?.floor?.length &&
             !sceneData.edges?.horizontal?.length &&
             !sceneData.edges?.vertical?.length)) {
            this.handleTemplateErrors(
                [`Nothing to export — draw inside the ${config.parentTypeName} area first`],
                `${config.templateName} Export`,
                config.templateName.toLowerCase()
            );
            return;
        }

        // Build template with actual scene content
        const suggestedId = `${config.templateName.toLowerCase()}-${Date.now()}`;
        const out = config.buildFunction({
            id: suggestedId,
            rect: { x: 0, y: 0, w: this.gridWidth, h: this.gridHeight },
            [config.childrenProperty]: [],
            [config.parentIdProperty]: currentParentId
        });

        // Add the actual scene content so it renders exactly as drawn
        out.sceneData = sceneData;

        const filename = `${out.id}.${config.schemaName}.json`;
        this.downloadJSON(filename, out);

        console.log(`Exported ${config.templateName.toLowerCase()} template:`, out);
        this.showToast('success', `${config.templateName} Exported`, `${config.templateName} template saved as ${filename}`);
    }

    exportAsGalleryTemplate() {
        const dto = this.overlayModel?.templateData;

        // Check if there's an active gallery overlay (existing path)
        if (dto && dto.type === 'unit') {
            // Use ExportBuilder for consistent format
            const out = buildUnitTemplate({
                id: dto?.id || 'unit',
                rect: dto?.rect || { x: 0, y: 0, w: this.gridWidth, h: this.gridHeight },
                rooms: dto?.children || [],
                parentMallId: dto?.parentMallId
            });

            const filename = `${out.id || 'unit'}.unit-template.v1.json`;
            this.downloadJSON(filename, out);

            console.log('Exported gallery template:', out);
            this.showToast('success', 'Gallery Template Exported', `Gallery template exported as ${filename}`);
            return;
        }

        // New path: Export from current edits when no gallery overlay exists (zzz20)
        if (!dto || dto.type !== 'unit') {
            this.exportGalleryFromCurrentEdits();
        }
    }

    exportGalleryFromCurrentEdits() {
        const dto = this.overlayModel?.templateData;

        // Must have a loaded mall template to get parent reference
        if (!dto || dto.type !== 'mall') {
            this.handleTemplateErrors(['Load a mall template first to export galleries'], 'export', 'gallery');
            return;
        }

        // Get the current scene content (what the user actually drew)
        const sceneData = this.toSceneV1();

        // Check if there's any content to export
        if (!sceneData ||
            (!sceneData.tiles?.floor?.length &&
             !sceneData.edges?.horizontal?.length &&
             !sceneData.edges?.vertical?.length)) {
            this.handleTemplateErrors(['Nothing to export — draw inside the mall area first'], 'export', 'gallery');
            return;
        }

        // Build gallery template with actual scene content (no rect calculation needed)
        const suggestedId = `gallery-${Date.now()}`;
        const out = buildUnitTemplate({
            id: suggestedId,
            rect: { x: 0, y: 0, w: this.gridWidth, h: this.gridHeight }, // Full grid size
            rooms: [],
            parentMallId: dto.id || 'mall'
        });

        // Add the actual scene content so it renders exactly as drawn
        out.sceneData = sceneData;

        const filename = `${out.id}.unit-template.v1.json`;
        this.downloadJSON(filename, out);

        console.info('[EXPORT:unit] Simple export with scene data', {
            floorTiles: sceneData.tiles?.floor?.length || 0,
            hEdges: sceneData.edges?.horizontal?.length || 0,
            vEdges: sceneData.edges?.vertical?.length || 0,
            parentMallId: dto.id || 'mall'
        });
        this.showToast('success', 'Gallery Template Exported', `Exported gallery from current edits: ${filename}`);
    }

    computeSceneEditsBoundingBox() {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasContent = false;

        // Check floor tiles
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.grid[y][x] === 'floor') {
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                    hasContent = true;
                }
            }
        }

        // Check edges - use edge positions directly for accurate bounding box
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.horizontalEdges[y] && this.horizontalEdges[y][x]) {
                    // Use the edge position itself, not adjacent cells
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                    hasContent = true;
                }
                if (this.verticalEdges[y] && this.verticalEdges[y][x]) {
                    // Use the edge position itself, not adjacent cells
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                    hasContent = true;
                }
            }
        }

        return hasContent ? { minX, minY, maxX, maxY } : null;
    }

    isRectInsideBounds(rect) {
        if (!this.overlayModel.bounds) return true;

        // Check all four corners and a couple interior points
        const points = [
            [rect.x, rect.y], // top-left
            [rect.x + rect.w - 1, rect.y], // top-right
            [rect.x, rect.y + rect.h - 1], // bottom-left
            [rect.x + rect.w - 1, rect.y + rect.h - 1], // bottom-right
            [rect.x + Math.floor(rect.w / 2), rect.y + Math.floor(rect.h / 2)] // center
        ];

        return points.every(([x, y]) => this.overlayModel.bounds.isInside(x, y));
    }

    // Export as Room Template format with parent relationship
    exportAsRoomTemplate() {
        this.exportChildTemplate({
            requiredParentType: 'unit',
            parentTypeName: 'gallery',
            templateName: 'Room',
            fallbackParentId: 'gallery',
            buildFunction: buildRoomTemplate,
            childrenProperty: 'zones',
            parentIdProperty: 'parentUnitId', // ExportBuilder parameter name
            schemaName: 'room-template.v1'
        });
    }

    // Export as Object Template format with parent relationship to room
    exportAsObjectTemplate() {
        this.exportChildTemplate({
            requiredParentType: 'room',
            parentTypeName: 'room',
            templateName: 'Object',
            fallbackParentId: 'room',
            buildFunction: buildObjectTemplate,
            childrenProperty: 'items',
            parentIdProperty: 'parentRoomId',
            schemaName: 'object-template.v1'
        });
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

        this.downloadJSON('scene.json', sceneData);

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

        // Reset options with clear actions included
        exportSelect.innerHTML = `
            <option value="mall-template">Export as Mall Template</option>
            <option value="gallery-template">Export as Gallery Template</option>
            <option value="room-template">Export as Room Template</option>
            <option value="object-template" id="export-object-template-item">Export as Object Template</option>
            <option disabled>──────────</option>
            <option value="clear-all">Clear All</option>
            <option value="clear-grid">Clear Grid</option>
            <option value="clear-template">Clear Template</option>
        `;

        // Set default based on current template context
        if (this.templateType === 'mall') {
            exportSelect.value = 'gallery-template'; // Mall templates typically create gallery templates
            exportSelect.style.backgroundColor = '#e8f4fd'; // Light blue to indicate context
        } else if (this.templateType === 'gallery') {
            exportSelect.value = 'room-template'; // Gallery templates typically create room templates
            exportSelect.style.backgroundColor = '#f0f8e8'; // Light green to indicate context
        } else {
            exportSelect.value = 'mall-template'; // Default to mall template export
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

            // Check if this is a child template with parent relationship
            const hasParent = jsonData.meta?.parent;

            // Only clear scene for parent templates, preserve template data for child templates
            if (!hasParent) {
                debug('[DEBUG] Parent template - clearing scene');
                this.clearScene();
            } else {
                debug('[DEBUG] Child template - preserving parent data, only clearing scene grid');
                // Only clear scene grid, preserve template models for parent-child relationship
                this.sceneModel.grid = this.createEmptyGrid();
                this.sceneModel.horizontalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);
                this.sceneModel.verticalEdges = this.createEmptyEdgeSet(this.gridWidth, this.gridHeight);

                // Update legacy references
                this.grid = this.sceneModel.grid;
                this.horizontalEdges = this.sceneModel.horizontalEdges;
                this.verticalEdges = this.sceneModel.verticalEdges;
            }

            this.overlayModel = this.overlayModel || {};
            this.overlayModel.templateData = dto;

            // Parse template content for ghosted rendering
            this.parseTemplateContent(jsonData, dto);

            // Runtime assertions for import
            console.assert(!!dto?.type, 'Import: dto.type missing');
            if (dto.type === 'mall') {
                console.assert(Array.isArray(dto.units), 'Import: mall dto.units must be array');
            }
            this.overlayModel.bounds = makeBounds(dto);
            this.showTemplate = dto.type !== 'scene';
            this.templateType = dto.type;
            console.info('[IMPORT]', {
                type: dto.type,
                id: dto.id,
                units: Array.isArray(dto.units) ? dto.units.length : 0,
                rect: dto.type === 'mall' && dto.rect ? true : undefined
            });
            console.info('[BOUNDS]', { active: !!this.overlayModel.bounds, type: this.templateType });
            this.render();

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
                this.showToast('success', 'Scene Loaded', 'Scene.v1 file imported successfully');
            } else {
                // Template loaded as overlay only - no content conversion
                // Use unified grid resizing method
                this.resizeGridForTemplate(dto);

                // Update template context for legacy compatibility
                this.templateContext = {
                    id: jsonData.id || `${dto.type}-${Date.now()}`,
                    originalData: jsonData,
                    loadedAt: new Date().toISOString()
                };

                this.showToast('success', 'Template Loaded', `${dto.type.toUpperCase()} template loaded as overlay constraints. Create content within template boundaries.`);
            }

            this.render();
            this.updateInfo();
            this.updateExportOptions();

        } catch (error) {
            this.handleTemplateErrors([error.message], 'loading', 'unknown');
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
                this.handleTemplateErrors(
                    ['Invalid template format. Expected "grid" property.'],
                    'Template Load',
                    'template'
                );
            }
        } catch (error) {
            this.handleTemplateErrors(
                [error.message || 'Unknown error occurred'],
                'Template Load',
                'template'
            );
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
            this.handleTemplateErrors(['No template loaded. Load a template first.'], 'export', 'unknown');
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
                this.handleTemplateErrors(
                    ['Invalid units index format. Expected "units" array.'],
                    'Units Index Load',
                    'units'
                );
            }
        } catch (error) {
            this.handleTemplateErrors(
                [error.message || 'Unknown error occurred'],
                'Units Index Load',
                'units'
            );
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

        // Validate template using unified validation system
        const validationErrors = this.validateTemplate(jsonData, dto.type);
        if (validationErrors.length > 0) {
            this.handleTemplateErrors(validationErrors, 'loading', dto.type);
            return; // Abort loading if validation fails
        }

        // Use Template Relationship Manager to handle parent-child relationships
        debug('[DEBUG] Loading template through Template Relationship Manager');
        const relationshipResult = await this.templateRelationshipManager.loadTemplate(jsonData, dto);

        // Clear scene data (user content)
        this.clearScene();

        // Set up overlay model
        this.overlayModel = this.overlayModel || {};
        this.overlayModel.templateData = dto;

        // Parse template content for ghosted rendering using relationship manager result
        debug('[DEBUG] Template relationship result:', relationshipResult);
        this.parseTemplateContentWithRelationships(relationshipResult);

        // Runtime assertions for import
        console.assert(!!dto?.type, 'Import: dto.type missing');
        if (dto.type === 'mall') {
            console.assert(Array.isArray(dto.units), 'Import: mall dto.units must be array');
        }
        this.overlayModel.bounds = makeBounds(dto);
        this.showTemplate = dto.type !== 'scene';
        this.templateType = dto.type;
        console.info('[IMPORT]', {
            type: dto.type,
            id: dto.id,
            units: Array.isArray(dto.units) ? dto.units.length : 0,
            rect: dto.type === 'mall' && dto.rect ? true : undefined
        });
        console.info('[BOUNDS]', { active: !!this.overlayModel.bounds, type: this.templateType });
        this.render();

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
            // Use unified grid resizing method
            this.resizeGridForTemplate(dto);

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
        // Use unified validation system - extract template type from schema
        const typeMapping = {
            'scene.v1': 'scene',
            'mall-template.v1': 'mall',
            'gallery-template.v1': 'unit', // Note: UI shows "gallery" but schema uses unit
            'unit-template.v1': 'unit',
            'room-template.v1': 'room',
            'object-template.v1': 'object',
            'unit-design.v1': 'unit'
        };

        const templateType = typeMapping[schema];
        if (!templateType) {
            this.handleTemplateErrors([`Unsupported schema: ${schema}`], 'validation', 'unknown');
            return false;
        }

        const validationErrors = this.validateTemplate(jsonData, templateType);
        if (validationErrors.length > 0) {
            this.handleTemplateErrors(validationErrors, 'validation', templateType);
            return false;
        }

        console.log(`✅ Schema validation passed: ${schema}`);
        return true;
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

    // Unified download helper for all JSON exports
    downloadJSON(filename, obj) {
        console.info('[DOWNLOAD]', filename);
        const dataStr = JSON.stringify(obj, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = filename;
        link.click();
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
                if (templateData.children) {
                    const room = templateData.children.find(room => {
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


    /**
     * Unified validation system for all template types
     * @param {Object} template - Template to validate
     * @param {string} expectedType - Expected template type (mall|unit|room|object)
     * @returns {Array} - Array of error messages, empty if valid
     */
    validateTemplate(template, expectedType) {
        const errors = [];

        // Basic structure validation
        if (!template || typeof template !== 'object') {
            errors.push('Template must be a valid object');
            return errors;
        }

        // Schema validation based on expected type
        const schemaMap = {
            'mall': 'mall-template.v1',
            'unit': 'unit-template.v1',
            'room': 'room-template.v1',
            'object': 'object-template.v1'
        };

        const expectedSchema = schemaMap[expectedType];
        if (expectedSchema && template.meta?.schema !== expectedSchema) {
            errors.push(`Template must have meta.schema = "${expectedSchema}"`);
        }

        // Common required fields for all templates
        if (!template.id || typeof template.id !== 'string') {
            errors.push('Template must have a valid string ID');
        }

        // Type-specific validation
        switch (expectedType) {
            case 'mall':
                this.validateMallSpecificFields(template, errors);
                break;
            case 'unit':
            case 'room':
            case 'object':
                this.validateChildTemplateFields(template, expectedType, errors);
                break;
        }

        return errors;
    }

    /**
     * Validate mall-specific fields
     * @param {Object} template - Mall template
     * @param {Array} errors - Error array to populate
     */
    validateMallSpecificFields(template, errors) {
        // Grid validation
        if (!template.grid || typeof template.grid !== 'object') {
            errors.push('Mall template must have a grid property');
        } else {
            if (typeof template.grid.width !== 'number' || template.grid.width <= 0) {
                errors.push('Mall grid width must be a positive number');
            }
            if (typeof template.grid.height !== 'number' || template.grid.height <= 0) {
                errors.push('Mall grid height must be a positive number');
            }
        }

        // Units validation
        if (!Array.isArray(template.units)) {
            errors.push('Mall template must have a units array');
        } else if (template.units.length > 0) {
            // Only validate unit structure if units exist (empty arrays are allowed)
            template.units.forEach((unit, index) => {
                if (!unit.id) {
                    errors.push(`Unit ${index} must have an ID`);
                }
                if (!unit.rect || !this.isValidRect(unit.rect)) {
                    errors.push(`Unit ${index} must have a valid rect`);
                }
            });
        }
    }

    /**
     * Validate child template fields (unit/room/object)
     * @param {Object} template - Child template
     * @param {string} type - Template type
     * @param {Array} errors - Error array to populate
     */
    validateChildTemplateFields(template, type, errors) {
        // Rect validation
        if (!template.rect || !this.isValidRect(template.rect)) {
            errors.push(`${type} template must have a valid rect`);
        }

        // Parent relationship validation
        if (!template.meta?.parent?.id) {
            errors.push(`${type} template must have a parent reference (meta.parent.id)`);
        }

        // Children array validation (rooms/zones/items -> standardized to children)
        const childrenProperty = 'children';
        if (template[childrenProperty] && !Array.isArray(template[childrenProperty])) {
            errors.push(`${type} template ${childrenProperty} must be an array if present`);
        }
    }

    /**
     * Validate rectangle object
     * @param {Object} rect - Rectangle to validate
     * @returns {boolean} - True if valid
     */
    isValidRect(rect) {
        return rect &&
               typeof rect.x === 'number' &&
               typeof rect.y === 'number' &&
               typeof rect.w === 'number' && rect.w > 0 &&
               typeof rect.h === 'number' && rect.h > 0;
    }

    /**
     * Unified error handling for template operations
     * @param {Array} errors - Array of error messages
     * @param {string} operation - Operation that failed (e.g., 'Template Load', 'Export')
     * @param {string} templateType - Type of template
     */
    handleTemplateErrors(errors, operation, templateType = '') {
        if (errors.length === 0) return;

        const title = `${operation} Failed`;
        const message = errors.length === 1
            ? errors[0]
            : `Multiple issues found:\n• ${errors.join('\n• ')}`;

        this.showToast('error', title, message, {
            duration: 5000,
            allowHtml: true
        });

        console.error(`[VALIDATION] ${title}:`, errors);
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

        // Validate children structure
        if (!galleryTemplate.children || !Array.isArray(galleryTemplate.children)) {
            errors.push('Gallery template must have a children array');
        } else {
            galleryTemplate.children.forEach((room, index) => {
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
                    this.handleTemplateErrors([`Unknown fixture type: ${type}`], 'loading', 'fixture');
                    return;
            }

            const response = await fetch(`./fixtures/${filename}`);
            if (!response.ok) {
                this.handleTemplateErrors([`Failed to load fixture: ${response.status}`], 'loading', 'fixture');
                return;
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
                    rooms: firstUnit.children || [],
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