#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
let outDir = 'floor-plans/units_generated'; // Default to generated directory

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out-dir' && i + 1 < args.length) {
        outDir = args[i + 1];
        break;
    }
}

// File paths
const mallJsonPath = 'floor-plans/mall/mall.json';
const unitDraftPath = 'floor-plans/mall/unit-draft.json';
const unitsDir = outDir;
const unitsIndexPath = outDir === 'floor-plans/units_generated' 
    ? 'floor-plans/mall/units-index.generated.json'
    : 'floor-plans/mall/units-index.json';

try {
    // Load mall.json and unit-draft.json
    const mallData = JSON.parse(fs.readFileSync(mallJsonPath, 'utf8'));
    const unitDraftData = JSON.parse(fs.readFileSync(unitDraftPath, 'utf8'));
    
    const { width: mallWidth, height: mallHeight } = mallData.grid;
    
    // Parse instances into grid data
    const { floorGrid, wallEdges } = parseInstances(unitDraftData.instances, mallWidth, mallHeight);
    
    // Check for open loops in walls
    const openLoop = findOpenLoops(wallEdges, mallWidth, mallHeight);
    if (openLoop) {
        console.log(`Split error: open loop near (${openLoop.x},${openLoop.y})`);
        process.exit(1);
    }
    
    // Perform flood fill to find contiguous floor regions
    const regions = findFloorRegions(floorGrid, wallEdges, mallWidth, mallHeight);
    
    // Filter regions by minimum size (2x2)
    const validRegions = regions.filter(region => {
        const { w, h } = getBoundingRect(region);
        return w >= 2 && h >= 2;
    });
    
    // Create units directory if it doesn't exist
    if (!fs.existsSync(unitsDir)) {
        fs.mkdirSync(unitsDir, { recursive: true });
    }
    
    // Clear existing unit files
    if (fs.existsSync(unitsDir)) {
        const files = fs.readdirSync(unitsDir);
        files.filter(f => f.startsWith('unit-') && f.endsWith('.json'))
             .forEach(f => fs.unlinkSync(path.join(unitsDir, f)));
    }
    
    const unitsIndex = [];
    
    // Generate unit files
    validRegions.forEach((region, index) => {
        const unitId = `unit-${String(index + 1).padStart(3, '0')}`;
        const rect = getBoundingRect(region);
        
        // Bounds check
        if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > mallWidth || rect.y + rect.h > mallHeight) {
            console.log(`Split error: unit rect out of mall bounds at (${rect.x},${rect.y})`);
            process.exit(1);
        }
        
        // Create unit JSON
        const unitData = {
            id: unitId,
            parentMallId: mallData.id,
            rect: rect,
            rooms: [
                {
                    id: "room-1",
                    gridRect: rect
                }
            ]
        };
        
        // Write unit file
        const unitPath = path.join(unitsDir, `${unitId}.json`);
        fs.writeFileSync(unitPath, JSON.stringify(unitData, null, 2));
        
        // Add to index
        unitsIndex.push({
            id: unitId,
            rect: rect
        });
    });
    
    // Write units index
    fs.writeFileSync(unitsIndexPath, JSON.stringify({ units: unitsIndex }, null, 2));
    
    console.log(`Units generated: ${validRegions.length}`);
    process.exit(0);
    
} catch (error) {
    console.log(`Split error: ${error.message}`);
    process.exit(1);
}

function parseInstances(instances, width, height) {
    const floorGrid = Array(height).fill(null).map(() => Array(width).fill(false));
    const wallEdges = {
        horizontal: Array(height + 1).fill(null).map(() => Array(width).fill(false)),
        vertical: Array(height).fill(null).map(() => Array(width + 1).fill(false))
    };
    
    instances.forEach(instance => {
        if (!instance.position) return;
        
        const [worldX, worldY, worldZ] = instance.position;
        const gridX = Math.floor(worldX / 2);
        const gridY = Math.floor(worldZ / 2);
        
        if (gridX < 0 || gridX >= width || gridY < 0 || gridY >= height) return;
        
        if (instance.type === 'lobbyFloor') {
            floorGrid[gridY][gridX] = true;
        } else if (isWallType(instance.type)) {
            // Convert wall positions to edges (simplified heuristic)
            // This is a basic conversion - in real implementation you'd need the actual edge data
            if (gridX > 0) wallEdges.vertical[gridY][gridX] = true;
            if (gridY > 0) wallEdges.horizontal[gridY][gridX] = true;
        }
    });
    
    return { floorGrid, wallEdges };
}

function isWallType(type) {
    return ['lobbyWall', 'lobbyNorthWall', 'lobbySouthWall', 'lobbyEastWall', 'lobbyWestWall'].includes(type);
}

function findOpenLoops(wallEdges, width, height) {
    // Simplified open loop detection - check for isolated wall segments
    for (let y = 0; y <= height; y++) {
        for (let x = 0; x < width; x++) {
            if (y < height + 1 && wallEdges.horizontal[y] && wallEdges.horizontal[y][x]) {
                // Check if horizontal edge has connections
                let connections = 0;
                if (x > 0 && wallEdges.vertical[Math.max(0, y-1)] && wallEdges.vertical[Math.max(0, y-1)][x]) connections++;
                if (x < width - 1 && wallEdges.vertical[Math.max(0, y-1)] && wallEdges.vertical[Math.max(0, y-1)][x+1]) connections++;
                if (y > 0 && wallEdges.vertical[y-1] && wallEdges.vertical[y-1][x]) connections++;
                if (y < height && wallEdges.vertical[y] && wallEdges.vertical[y][x]) connections++;
                
                if (connections < 2) {
                    return { x, y };
                }
            }
        }
    }
    return null;
}

function findFloorRegions(floorGrid, wallEdges, width, height) {
    const visited = Array(height).fill(null).map(() => Array(width).fill(false));
    const regions = [];
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (floorGrid[y][x] && !visited[y][x]) {
                const region = [];
                floodFill(floorGrid, wallEdges, visited, x, y, width, height, region);
                if (region.length > 0) {
                    regions.push(region);
                }
            }
        }
    }
    
    return regions;
}

function floodFill(floorGrid, wallEdges, visited, startX, startY, width, height, region) {
    const stack = [{ x: startX, y: startY }];
    
    while (stack.length > 0) {
        const { x, y } = stack.pop();
        
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        if (visited[y][x] || !floorGrid[y][x]) continue;
        
        visited[y][x] = true;
        region.push({ x, y });
        
        // Check 4-connected neighbors, respecting wall edges
        const neighbors = [
            { x: x + 1, y: y, blocked: wallEdges.vertical[y] && wallEdges.vertical[y][x + 1] },
            { x: x - 1, y: y, blocked: wallEdges.vertical[y] && wallEdges.vertical[y][x] },
            { x: x, y: y + 1, blocked: wallEdges.horizontal[y + 1] && wallEdges.horizontal[y + 1][x] },
            { x: x, y: y - 1, blocked: wallEdges.horizontal[y] && wallEdges.horizontal[y][x] }
        ];
        
        neighbors.forEach(neighbor => {
            if (!neighbor.blocked) {
                stack.push({ x: neighbor.x, y: neighbor.y });
            }
        });
    }
}

function getBoundingRect(region) {
    if (region.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
    
    let minX = region[0].x, maxX = region[0].x;
    let minY = region[0].y, maxY = region[0].y;
    
    region.forEach(cell => {
        minX = Math.min(minX, cell.x);
        maxX = Math.max(maxX, cell.x);
        minY = Math.min(minY, cell.y);
        maxY = Math.max(maxY, cell.y);
    });
    
    return {
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1
    };
}