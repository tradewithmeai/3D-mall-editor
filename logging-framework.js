/**
 * Bulletproof Logging Framework
 * Comprehensive logging system for 3D environment editor with AI agent integration
 */

class Logger {
    constructor() {
        this.logHistory = [];
        this.performanceMetrics = new Map();
        this.startTime = performance.now();
        
        // Log categories with emoji prefixes for easy identification
        this.categories = {
            CREATE: '🏗️',
            MODIFY: '🎨', 
            RESIZE: '📐',
            REMOVE: '🗑️',
            ASSERT: '✅',
            ERROR: '❌',
            WARN: '⚠️',
            DIANA: '🤖',
            FACTORY: '🏭',
            PERFORMANCE: '⚡',
            MEMORY: '💾',
            TEST: '🧪'
        };
        
        this.initializeLogging();
    }
    
    /**
     * Initialize logging system with performance monitoring
     */
    initializeLogging() {
        console.log(`${this.categories.CREATE} LOGGER: Bulletproof logging framework initialized`);
        console.log(`${this.categories.PERFORMANCE} BASELINE: Starting performance monitoring`);
        
        // Track initial memory usage
        if (performance.memory) {
            this.logMemory('BASELINE');
        }
    }
    
    /**
     * Log component creation with detailed information
     */
    logCreate(componentType, position, uuid, additionalData = {}) {
        const timestamp = this.getTimestamp();
        const posStr = position ? `[${position.join(', ')}]` : '[0, 0, 0]';
        const id = uuid ? uuid.substring(0, 8) : 'unknown';
        
        const message = `${this.categories.CREATE} CREATE: ${componentType} at ${posStr} (${id})`;
        console.log(message);
        
        this.addToHistory({
            category: 'CREATE',
            componentType,
            position,
            uuid,
            timestamp,
            additionalData
        });
        
        return message;
    }
    
    /**
     * Log component modification with before/after values
     */
    logModify(componentType, property, oldValue, newValue, uuid) {
        const timestamp = this.getTimestamp();
        const id = uuid ? uuid.substring(0, 8) : 'unknown';
        
        const message = `${this.categories.MODIFY} MODIFY: ${componentType} ${property} ${oldValue} → ${newValue} (${id})`;
        console.log(message);
        
        this.addToHistory({
            category: 'MODIFY', 
            componentType,
            property,
            oldValue,
            newValue,
            uuid,
            timestamp
        });
        
        return message;
    }
    
    /**
     * Log component resizing with size change tracking
     */
    logResize(componentType, oldSize, newSize, uuid, duration = null) {
        const timestamp = this.getTimestamp();
        const id = uuid ? uuid.substring(0, 8) : 'unknown';
        const durationStr = duration ? ` (${duration.toFixed(2)}ms)` : '';
        
        const message = `${this.categories.RESIZE} RESIZE: ${componentType} [${oldSize.join(',')}] → [${newSize.join(',')}] (${id})${durationStr}`;
        console.log(message);
        
        this.addToHistory({
            category: 'RESIZE',
            componentType,
            oldSize,
            newSize,
            uuid,
            duration,
            timestamp
        });
        
        return message;
    }
    
    /**
     * Log component removal with memory cleanup verification
     */
    logRemove(componentType, uuid, memoryCleanup = false) {
        const timestamp = this.getTimestamp();
        const id = uuid ? uuid.substring(0, 8) : 'unknown';
        const cleanupStr = memoryCleanup ? ' ✓ geometry/material disposed' : ' ⚠️ no cleanup';
        
        const message = `${this.categories.REMOVE} REMOVE: ${componentType} (${id})${cleanupStr}`;
        console.log(message);
        
        this.addToHistory({
            category: 'REMOVE',
            componentType,
            uuid,
            memoryCleanup,
            timestamp
        });
        
        return message;
    }
    
    /**
     * Log assertions with pass/fail status
     */
    logAssert(description, condition, expected = null, actual = null) {
        const timestamp = this.getTimestamp();
        const status = condition ? 'PASS' : 'FAIL';
        const emoji = condition ? this.categories.ASSERT : this.categories.ERROR;
        
        let message = `${emoji} ASSERT: ${description} - ${status}`;
        if (!condition && expected !== null && actual !== null) {
            message += ` (expected: ${expected}, actual: ${actual})`;
        }
        
        console.log(message);
        
        this.addToHistory({
            category: 'ASSERT',
            description,
            condition,
            expected,
            actual,
            timestamp
        });
        
        return { passed: condition, message };
    }
    
    /**
     * Log Diana AI agent commands
     */
    logDiana(command, result, executionTime = null) {
        const timestamp = this.getTimestamp();
        const timeStr = executionTime ? ` (${executionTime.toFixed(2)}ms)` : '';
        
        const message = `${this.categories.DIANA} DIANA: "${command}" → ${result}${timeStr}`;
        console.log(message);
        
        this.addToHistory({
            category: 'DIANA',
            command,
            result,
            executionTime,
            timestamp
        });
        
        return message;
    }
    
    /**
     * Log factory operations 
     */
    logFactory(operation, componentType, success, details = {}) {
        const timestamp = this.getTimestamp();
        const status = success ? '✅' : '❌';
        
        const message = `${this.categories.FACTORY} FACTORY: ${operation} ${componentType} ${status}`;
        console.log(message);
        
        this.addToHistory({
            category: 'FACTORY',
            operation,
            componentType,
            success,
            details,
            timestamp
        });
        
        return message;
    }
    
    /**
     * Log performance metrics
     */
    logPerformance(metric, value, threshold = null) {
        const timestamp = this.getTimestamp();
        const thresholdStr = threshold ? ` (threshold: ${threshold})` : '';
        const status = threshold && value > threshold ? ' ⚠️ ABOVE THRESHOLD' : '';
        
        const message = `${this.categories.PERFORMANCE} PERF: ${metric} = ${value}${thresholdStr}${status}`;
        console.log(message);
        
        this.performanceMetrics.set(metric, { value, timestamp, threshold });
        
        return message;
    }
    
    /**
     * Log memory usage (if available)
     */
    logMemory(label = 'CURRENT') {
        if (!performance.memory) {
            console.log(`${this.categories.MEMORY} MEMORY: Performance.memory not available`);
            return null;
        }
        
        const used = Math.round(performance.memory.usedJSHeapSize / 1048576 * 100) / 100;
        const total = Math.round(performance.memory.totalJSHeapSize / 1048576 * 100) / 100;
        const limit = Math.round(performance.memory.jsHeapSizeLimit / 1048576 * 100) / 100;
        
        const message = `${this.categories.MEMORY} MEMORY: ${label} - Used: ${used}MB, Total: ${total}MB, Limit: ${limit}MB`;
        console.log(message);
        
        this.addToHistory({
            category: 'MEMORY',
            label,
            used,
            total,
            limit,
            timestamp: this.getTimestamp()
        });
        
        return { used, total, limit };
    }
    
    /**
     * Log test results with pass/fail summary
     */
    logTest(testName, results, duration = null) {
        const timestamp = this.getTimestamp();
        const passed = results.filter(r => r.passed).length;
        const total = results.length;
        const status = passed === total ? 'ALL PASS' : `${passed}/${total} PASS`;
        const emoji = passed === total ? this.categories.TEST : this.categories.WARN;
        const durationStr = duration ? ` (${duration.toFixed(2)}ms)` : '';
        
        const message = `${emoji} TEST: ${testName} - ${status}${durationStr}`;
        console.log(message);
        
        this.addToHistory({
            category: 'TEST',
            testName,
            results,
            passed,
            total,
            duration,
            timestamp
        });
        
        return { passed, total, allPassed: passed === total };
    }
    
    /**
     * Get formatted timestamp
     */
    getTimestamp() {
        const elapsed = performance.now() - this.startTime;
        return `+${elapsed.toFixed(2)}ms`;
    }
    
    /**
     * Add entry to log history
     */
    addToHistory(entry) {
        this.logHistory.push(entry);
        
        // Keep history manageable (last 1000 entries)
        if (this.logHistory.length > 1000) {
            this.logHistory = this.logHistory.slice(-1000);
        }
    }
    
    /**
     * Get summary of all log entries
     */
    getSummary() {
        const summary = {
            totalEntries: this.logHistory.length,
            categories: {},
            errors: this.logHistory.filter(e => e.category === 'ASSERT' && !e.condition).length,
            warnings: this.logHistory.filter(e => e.category === 'WARN').length
        };
        
        // Count entries by category
        this.logHistory.forEach(entry => {
            summary.categories[entry.category] = (summary.categories[entry.category] || 0) + 1;
        });
        
        return summary;
    }
    
    /**
     * Export log history for debugging
     */
    exportLogs() {
        return {
            summary: this.getSummary(),
            history: this.logHistory,
            performance: Object.fromEntries(this.performanceMetrics),
            timestamp: new Date().toISOString()
        };
    }
}

// Create global logger instance
window.Logger = new Logger();

// Convenience functions for common logging patterns
window.logCreate = (type, pos, uuid, data) => window.Logger.logCreate(type, pos, uuid, data);
window.logModify = (type, prop, old, new_, uuid) => window.Logger.logModify(type, prop, old, new_, uuid);
window.logResize = (type, oldSize, newSize, uuid, dur) => window.Logger.logResize(type, oldSize, newSize, uuid, dur);
window.logRemove = (type, uuid, cleanup) => window.Logger.logRemove(type, uuid, cleanup);
window.logAssert = (desc, cond, exp, act) => window.Logger.logAssert(desc, cond, exp, act);
window.logDiana = (cmd, result, time) => window.Logger.logDiana(cmd, result, time);
window.logFactory = (op, type, success, details) => window.Logger.logFactory(op, type, success, details);
window.logPerf = (metric, value, threshold) => window.Logger.logPerformance(metric, value, threshold);
window.logMemory = (label) => window.Logger.logMemory(label);
window.logTest = (name, results, duration) => window.Logger.logTest(name, results, duration);

console.log('🚀 BULLETPROOF LOGGING FRAMEWORK LOADED - Ready for systematic development');