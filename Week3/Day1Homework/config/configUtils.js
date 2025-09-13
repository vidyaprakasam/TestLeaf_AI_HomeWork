import { appConfig } from './appConfig.js';

/**
 * Apply appConfig colors to CSS custom properties
 * This is the ONLY place where appConfig values are applied to CSS
 */
export function applyAppConfigStyles() {
  const root = document.documentElement;
  
  // Map appConfig colors to CSS variables - SINGLE SOURCE OF TRUTH
  const colorMappings = {
    '--color-primary': appConfig.colors.primary,
    '--color-primary-light': appConfig.colors.primaryLight,
    '--color-accent': appConfig.colors.accent,
    '--color-success': appConfig.colors.success,
    '--color-success-dark': appConfig.colors.successDark,
    '--color-danger': appConfig.colors.danger,
    '--color-dark-bg': appConfig.colors.darkBg,
    '--color-panel-bg': appConfig.colors.panelBg,
    '--color-muted-text': appConfig.colors.mutedText,
    // Inspector toggle specific colors
    '--color-gradient-start': appConfig.colors.gradientStart,
    '--color-shadow': appConfig.colors.shadowColor,
    '--color-shadow-hover': appConfig.colors.shadowColorHover,
    '--color-shadow-active': appConfig.colors.shadowColorActive,
    '--color-border-white': appConfig.colors.borderWhite,
    // These are computed/static values
    '--color-white': '#ffffff',
    '--color-darker-bg': '#2d2d2d'
  };

  // Apply all color mappings to CSS variables
  Object.entries(colorMappings).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });

  console.log('🎨 Applied appConfig styles to CSS variables');
}

/**
 * Get a color from appConfig
 */
export function getColor(colorKey) {
  return appConfig.colors[colorKey] || '#000000';
}

/**
 * Get app configuration
 */
export function getAppConfig() {
  return appConfig;
}

/**
 * Initialize configuration - call this early in your app
 */
export function initializeAppConfig() {
  // Apply styles immediately
  applyAppConfigStyles();
  
  // Also apply when DOM is loaded (in case this runs before DOM)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAppConfigStyles);
  }
}