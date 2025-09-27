/**
 * Template Relationship Manager
 * Handles parent-child relationships between templates, automatic parent loading,
 * and template caching to eliminate data loss issues.
 */
export class TemplateRelationshipManager {
    constructor() {
        // Template cache: stores loaded templates by ID
        this.templateCache = new Map();

        // Parent-child relationships: child ID -> parent template data
        this.parentRelationships = new Map();

        // Template hierarchy: tracks the current template stack
        this.templateStack = [];

        // Current active templates by layer
        this.activeLayers = {
            parent: null,    // Parent template (grey layer)
            current: null    // Current template (green layer)
        };

        console.log('[TemplateRM] Template Relationship Manager initialized');
    }

    /**
     * Load a template with automatic parent resolution
     * @param {Object} templateData - The template data to load
     * @param {Object} dto - The processed template DTO
     * @returns {Object} - Loading result with parent and current templates
     */
    async loadTemplate(templateData, dto) {
        console.log('[TemplateRM] Loading template:', {
            id: dto.id || templateData.id,
            type: dto.type,
            hasParent: !!templateData.meta?.parent
        });

        // Cache this template
        const templateId = dto.id || templateData.id || `${dto.type}-${Date.now()}`;
        this.cacheTemplate(templateId, templateData, dto);

        // Build the complete hierarchy for this template
        const hierarchy = await this.buildTemplateHierarchy(templateData, dto, templateId);

        // Update template stack with complete hierarchy
        this.templateStack = hierarchy;

        // Update legacy activeLayers for backwards compatibility
        if (hierarchy.length >= 2) {
            this.activeLayers.parent = hierarchy[hierarchy.length - 2];
            this.activeLayers.current = hierarchy[hierarchy.length - 1];
        } else if (hierarchy.length === 1) {
            this.activeLayers.parent = null;
            this.activeLayers.current = hierarchy[0];
        } else {
            this.activeLayers.parent = null;
            this.activeLayers.current = null;
        }

        console.log('[TemplateRM] Template hierarchy established:', {
            levels: hierarchy.length,
            stack: hierarchy.map(t => `${t.dto.type}:${t.id}`)
        });

        return {
            hasParent: hierarchy.length > 1,
            parent: this.activeLayers.parent,
            current: this.activeLayers.current,
            hierarchy: hierarchy
        };
    }

    /**
     * Build the complete template hierarchy for a given template
     * @param {Object} templateData - Template data
     * @param {Object} dto - Processed template DTO
     * @param {string} templateId - Template ID
     * @returns {Array} - Ordered hierarchy array from root to current
     */
    async buildTemplateHierarchy(templateData, dto, templateId) {
        const hierarchy = [];

        // Build hierarchy recursively from parents
        const buildParentChain = async (currentTemplateData, currentDto, currentId) => {
            // Check for parent reference in template data (meta.parent)
            const parentMeta = currentTemplateData.meta?.parent;

            // Also check DTO for parentId (normalized format)
            const parentIdFromDto = currentDto.parentId;

            if (parentMeta) {
                // Load parent template using meta.parent
                const parentTemplate = await this.ensureParentLoaded(parentMeta, currentId);

                if (parentTemplate) {
                    // Recursively build parent's hierarchy first
                    await buildParentChain(parentTemplate.templateData, parentTemplate.dto, parentTemplate.id);

                    // Add parent to hierarchy
                    hierarchy.push(parentTemplate);

                    // Set up relationship tracking
                    this.parentRelationships.set(currentId, parentTemplate);
                }
            } else if (parentIdFromDto) {
                console.warn('[TemplateRM] Found parentId in DTO but no meta.parent in template data:', {
                    currentId,
                    parentId: parentIdFromDto
                });
                // Could try to resolve parent by ID if we had a registry
            }
        };

        // Build the parent chain first
        await buildParentChain(templateData, dto, templateId);

        // Add current template at the end
        hierarchy.push({
            templateData,
            dto,
            id: templateId
        });

        console.log('[TemplateRM] Built hierarchy chain:', hierarchy.map(t => `${t.dto.type}:${t.id}`));
        return hierarchy;
    }

    /**
     * Cache a template for future use
     * @param {string} templateId - Template ID
     * @param {Object} templateData - Raw template data
     * @param {Object} dto - Processed template DTO
     */
    cacheTemplate(templateId, templateData, dto) {
        const cacheEntry = {
            id: templateId,
            templateData: structuredClone(templateData), // Deep copy
            dto: structuredClone(dto), // Deep copy
            loadedAt: new Date().toISOString(),
            type: dto.type
        };

        this.templateCache.set(templateId, cacheEntry);
        console.log('[TemplateRM] Template cached:', templateId);
    }

    /**
     * Ensure parent template is loaded
     * @param {Object} parentMeta - Parent metadata from template
     * @param {string} childId - Child template ID
     * @returns {Object|null} - Parent template data or null
     */
    async ensureParentLoaded(parentMeta, childId) {
        const parentId = parentMeta.id;

        // Check if parent is already in cache
        if (this.templateCache.has(parentId)) {
            console.log('[TemplateRM] Parent template found in cache:', parentId);
            return this.templateCache.get(parentId);
        }

        // Check if parent is currently active
        if (this.activeLayers.current?.id === parentId) {
            console.log('[TemplateRM] Parent template is currently active');
            return this.activeLayers.current;
        }

        console.warn('[TemplateRM] Parent template not found:', parentId);
        console.warn('[TemplateRM] Available templates:', Array.from(this.templateCache.keys()));

        // In a full implementation, we could try to load the parent from file
        // For now, return null to indicate parent not available
        return null;
    }

    /**
     * Get current template layers for rendering
     * @returns {Object} - Current template hierarchy and legacy parent/current layers
     */
    getCurrentLayers() {
        return {
            // Legacy format for backwards compatibility
            parent: this.activeLayers.parent,
            current: this.activeLayers.current,
            hasParent: !!this.activeLayers.parent,

            // New multi-level hierarchy
            hierarchy: this.templateStack,
            levels: this.templateStack.length
        };
    }

    /**
     * Clear all templates and relationships
     */
    clearAll() {
        console.log('[TemplateRM] Clearing all templates and relationships');
        this.templateCache.clear();
        this.parentRelationships.clear();
        this.templateStack = [];
        this.activeLayers.parent = null;
        this.activeLayers.current = null;
    }

    /**
     * Clear only current template, preserve parent
     */
    clearCurrent() {
        console.log('[TemplateRM] Clearing current template, preserving parent');
        if (this.activeLayers.current) {
            this.parentRelationships.delete(this.activeLayers.current.id);
        }
        this.activeLayers.current = null;
    }

    /**
     * Get template by ID from cache
     * @param {string} templateId - Template ID
     * @returns {Object|null} - Template data or null
     */
    getTemplate(templateId) {
        return this.templateCache.get(templateId) || null;
    }

    /**
     * Get all cached templates
     * @returns {Array} - Array of cached templates
     */
    getAllTemplates() {
        return Array.from(this.templateCache.values());
    }

    /**
     * Get relationship info for debugging
     * @returns {Object} - Relationship debug info
     */
    getDebugInfo() {
        return {
            cacheSize: this.templateCache.size,
            cachedTemplates: Array.from(this.templateCache.keys()),
            parentRelationships: Array.from(this.parentRelationships.entries()),
            activeLayers: {
                parent: this.activeLayers.parent?.id || null,
                current: this.activeLayers.current?.id || null
            }
        };
    }
}