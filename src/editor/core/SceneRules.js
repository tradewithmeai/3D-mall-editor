/**
 * SceneRules - Validation rules for 2D→3D safety without blocking workflow
 *
 * Provides minimal rules to warn (not block) about potential 3D issues:
 * - Rule A: Unenclosed floors (missing perimeter walls)
 * - Rule B: Out-of-bounds content (tiles/edges outside parent bounds)
 */

export class SceneRules {
    /**
     * Collect all validation warnings for a scene export
     *
     * @param {Object} params
     * @param {Object} params.dto - Export DTO being created
     * @param {Object} params.scene - Scene model with grid/edges
     * @param {Object} params.bounds - Active bounds constraint
     * @returns {string[]} Array of warning messages
     */
    static collectWarnings({ dto, scene, bounds }) {
        const warnings = [];

        // Rule A: Unenclosed floor warnings
        warnings.push(...this.checkUnenclosedFloors(scene, bounds));

        // Rule B: Out-of-bounds content warnings
        warnings.push(...this.checkOutOfBoundsContent(scene, bounds));

        return warnings;
    }

    /**
     * Rule A: Check for floor tiles missing perimeter walls
     *
     * For each floor tile adjacent to non-floor, require a wall edge on that side.
     * Warns with coordinates and missing sides [N|S|E|W].
     */
    static checkUnenclosedFloors(scene, bounds) {
        const warnings = [];
        const unenclosedFloors = [];

        // Check each cell in the grid
        for (let y = 0; y < scene.grid.length; y++) {
            for (let x = 0; x < scene.grid[y].length; x++) {
                const cell = scene.grid[y][x];

                // Only check floor tiles
                if (cell !== 'floor') continue;

                const missingSides = [];

                // Check North (up)
                if (y > 0) {
                    const northCell = scene.grid[y - 1][x];
                    if (northCell !== 'floor') {
                        // Need horizontal edge above this cell
                        if (!scene.horizontalEdges[y] || !scene.horizontalEdges[y][x]) {
                            missingSides.push('N');
                        }
                    }
                } else {
                    // At grid edge - need wall
                    if (!scene.horizontalEdges[y] || !scene.horizontalEdges[y][x]) {
                        missingSides.push('N');
                    }
                }

                // Check South (down)
                if (y < scene.grid.length - 1) {
                    const southCell = scene.grid[y + 1][x];
                    if (southCell !== 'floor') {
                        // Need horizontal edge below this cell
                        if (!scene.horizontalEdges[y + 1] || !scene.horizontalEdges[y + 1][x]) {
                            missingSides.push('S');
                        }
                    }
                } else {
                    // At grid edge - need wall
                    if (!scene.horizontalEdges[y + 1] || !scene.horizontalEdges[y + 1][x]) {
                        missingSides.push('S');
                    }
                }

                // Check West (left)
                if (x > 0) {
                    const westCell = scene.grid[y][x - 1];
                    if (westCell !== 'floor') {
                        // Need vertical edge to left of this cell
                        if (!scene.verticalEdges[y] || !scene.verticalEdges[y][x]) {
                            missingSides.push('W');
                        }
                    }
                } else {
                    // At grid edge - need wall
                    if (!scene.verticalEdges[y] || !scene.verticalEdges[y][x]) {
                        missingSides.push('W');
                    }
                }

                // Check East (right)
                if (x < scene.grid[y].length - 1) {
                    const eastCell = scene.grid[y][x + 1];
                    if (eastCell !== 'floor') {
                        // Need vertical edge to right of this cell
                        if (!scene.verticalEdges[y] || !scene.verticalEdges[y][x + 1]) {
                            missingSides.push('E');
                        }
                    }
                } else {
                    // At grid edge - need wall
                    if (!scene.verticalEdges[y] || !scene.verticalEdges[y][x + 1]) {
                        missingSides.push('E');
                    }
                }

                // If any sides are missing, record this floor tile
                if (missingSides.length > 0) {
                    unenclosedFloors.push({
                        x, y,
                        missing: missingSides.join('|')
                    });
                }
            }
        }

        // Generate warnings for unenclosed floors
        if (unenclosedFloors.length > 0) {
            // Show first few examples
            const examples = unenclosedFloors.slice(0, 3);
            const exampleText = examples.map(f => `(${f.x},${f.y})[${f.missing}]`).join(', ');
            const moreText = unenclosedFloors.length > 3 ? ` and ${unenclosedFloors.length - 3} more` : '';

            warnings.push(`Unenclosed floors: ${exampleText}${moreText} - missing perimeter walls`);
        }

        return warnings;
    }

    /**
     * Rule B: Check for content outside active bounds
     *
     * Any tile/edge outside active bounds triggers warning with counts and coordinates.
     */
    static checkOutOfBoundsContent(scene, bounds) {
        const warnings = [];

        // If no bounds constraint, nothing is out of bounds
        if (!bounds) {
            return warnings;
        }

        const outOfBoundsTiles = [];
        const outOfBoundsEdges = [];

        // Check floor tiles
        for (let y = 0; y < scene.grid.length; y++) {
            for (let x = 0; x < scene.grid[y].length; x++) {
                const cell = scene.grid[y][x];

                if (cell === 'floor') {
                    if (!this.isWithinBounds(x, y, bounds)) {
                        outOfBoundsTiles.push({ x, y });
                    }
                }
            }
        }

        // Check horizontal edges (walls)
        for (let y = 0; y < scene.horizontalEdges.length; y++) {
            for (let x = 0; x < scene.horizontalEdges[y].length; x++) {
                if (scene.horizontalEdges[y][x]) {
                    // Edge coordinates need different bounds check
                    if (!this.isEdgeWithinBounds(x, y, 'horizontal', bounds)) {
                        outOfBoundsEdges.push({ x, y, type: 'horizontal' });
                    }
                }
            }
        }

        // Check vertical edges (walls)
        for (let y = 0; y < scene.verticalEdges.length; y++) {
            for (let x = 0; x < scene.verticalEdges[y].length; x++) {
                if (scene.verticalEdges[y][x]) {
                    // Edge coordinates need different bounds check
                    if (!this.isEdgeWithinBounds(x, y, 'vertical', bounds)) {
                        outOfBoundsEdges.push({ x, y, type: 'vertical' });
                    }
                }
            }
        }

        // Generate warnings for out-of-bounds content
        const totalOutOfBounds = outOfBoundsTiles.length + outOfBoundsEdges.length;
        if (totalOutOfBounds > 0) {
            const examples = [];

            // Add tile examples
            if (outOfBoundsTiles.length > 0) {
                const tileExamples = outOfBoundsTiles.slice(0, 2).map(t => `tile(${t.x},${t.y})`);
                examples.push(...tileExamples);
            }

            // Add edge examples
            if (outOfBoundsEdges.length > 0) {
                const edgeExamples = outOfBoundsEdges.slice(0, 2).map(e => `${e.type[0]}edge(${e.x},${e.y})`);
                examples.push(...edgeExamples);
            }

            const exampleText = examples.slice(0, 3).join(', ');
            const moreText = totalOutOfBounds > 3 ? ` and ${totalOutOfBounds - 3} more` : '';

            warnings.push(`Out-of-bounds content: ${outOfBoundsTiles.length} tiles, ${outOfBoundsEdges.length} edges - ${exampleText}${moreText}`);
        }

        return warnings;
    }

    /**
     * Check if a grid position is within bounds
     */
    static isWithinBounds(x, y, bounds) {
        if (!bounds) return true;

        return x >= bounds.x &&
               x < bounds.x + bounds.w &&
               y >= bounds.y &&
               y < bounds.y + bounds.h;
    }

    /**
     * Check if an edge is within bounds
     * Edge coordinates have different semantics than tile coordinates
     */
    static isEdgeWithinBounds(x, y, edgeType, bounds) {
        if (!bounds) return true;

        if (edgeType === 'horizontal') {
            // Horizontal edges span between cells
            return x >= bounds.x &&
                   x < bounds.x + bounds.w &&
                   y >= bounds.y &&
                   y <= bounds.y + bounds.h;
        } else {
            // Vertical edges span between cells
            return x >= bounds.x &&
                   x <= bounds.x + bounds.w &&
                   y >= bounds.y &&
                   y < bounds.y + bounds.h;
        }
    }
}