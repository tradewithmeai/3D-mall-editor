/**
 * RulesSwitchboard - Centralized rule configuration and gating
 *
 * Provides runtime control over validation rules without code changes.
 * Rules can be enabled/disabled or forced to warn-only mode.
 * Loads optional dev configuration from schemas/rules.switchboard.dev.json
 */

// Default rule configurations (matching current behavior)
const DEFAULT_RULES = {
    'unenclosed-floors': { enabled: true, mode: 'warn' },
    'oob-content': { enabled: true, mode: 'warn' }
};

class RulesSwitchboard {
    constructor() {
        this.rules = { ...DEFAULT_RULES };
        this.loaded = false;
        this.loadDevConfig();
    }

    /**
     * Load optional dev configuration file
     * Falls back silently to defaults if file not found
     */
    async loadDevConfig() {
        try {
            const response = await fetch('/schemas/rules.switchboard.dev.json');
            if (response.ok) {
                const devConfig = await response.json();

                // Merge dev config over defaults
                for (const [ruleId, config] of Object.entries(devConfig)) {
                    if (this.rules[ruleId]) {
                        this.rules[ruleId] = { ...this.rules[ruleId], ...config };
                    } else {
                        console.warn(`[RULES] Unknown rule ID in dev config: ${ruleId}`);
                    }
                }

                console.info('[RULES] Loaded dev config from schemas/rules.switchboard.dev.json');
                this.logRuleSummary();
            } else {
                console.info('[RULES] No dev config found, using defaults');
                this.logRuleSummary();
            }
        } catch (error) {
            console.info('[RULES] No dev config found, using defaults');
            this.logRuleSummary();
        }

        this.loaded = true;
    }

    /**
     * Get configuration for a specific rule
     * @param {string} ruleId - Rule identifier
     * @returns {Object} { enabled: boolean, mode: 'warn'|'block' }
     */
    getRuleConfig(ruleId) {
        return this.rules[ruleId] || { enabled: false, mode: 'warn' };
    }

    /**
     * Check if a rule is enabled
     * @param {string} ruleId - Rule identifier
     * @returns {boolean}
     */
    isRuleEnabled(ruleId) {
        return this.getRuleConfig(ruleId).enabled;
    }

    /**
     * Get rule mode (warn or block)
     * @param {string} ruleId - Rule identifier
     * @returns {string} 'warn' or 'block'
     */
    getRuleMode(ruleId) {
        return this.getRuleConfig(ruleId).mode;
    }

    /**
     * Log startup summary of all rule states
     */
    logRuleSummary() {
        console.info('[RULES] Rule states:', this.rules);

        // Log each rule individually for clarity
        for (const [ruleId, config] of Object.entries(this.rules)) {
            console.info(`[RULES] ${ruleId}: enabled=${config.enabled}, mode=${config.mode}`);
        }
    }

    /**
     * Wait for config to be loaded
     * @returns {Promise<void>}
     */
    async waitForLoad() {
        while (!this.loaded) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
}

// Global singleton instance
const switchboard = new RulesSwitchboard();

/**
 * Get rule configuration
 * @param {string} ruleId - Rule identifier
 * @returns {Object} { enabled: boolean, mode: 'warn'|'block' }
 */
export function getRuleConfig(ruleId) {
    return switchboard.getRuleConfig(ruleId);
}

/**
 * Check if rule is enabled
 * @param {string} ruleId - Rule identifier
 * @returns {boolean}
 */
export function isRuleEnabled(ruleId) {
    return switchboard.isRuleEnabled(ruleId);
}

/**
 * Get rule mode
 * @param {string} ruleId - Rule identifier
 * @returns {string} 'warn' or 'block'
 */
export function getRuleMode(ruleId) {
    return switchboard.getRuleMode(ruleId);
}

/**
 * Wait for switchboard to finish loading
 * @returns {Promise<void>}
 */
export function waitForLoad() {
    return switchboard.waitForLoad();
}

/**
 * Get all configured rule IDs
 * @returns {string[]}
 */
export function getAllRuleIds() {
    return Object.keys(switchboard.rules);
}