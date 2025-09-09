/**
 * Core types for floorplan runtime parsing and processing
 * Pure data structures - no external dependencies
 */

export interface Cell {
    x: number;
    y: number;
    kind: 'empty' | 'floor' | 'wall';
}

export interface Layout {
    width: number;
    height: number;
    cells: Cell[];
}

export interface Edge {
    x: number;
    y: number;
    dir: 'H' | 'V';
}