/**
 * Initialize app configuration
 */
import { initializeAppConfig } from '../config/configUtils.js';

// Apply config immediately and also on DOM load
initializeAppConfig();
console.log('🎨 App config initialized');