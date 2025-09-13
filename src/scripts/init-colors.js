/**
 * Apply appConfig colors immediately to prevent white flash
 */
import { appConfig } from '../config/appConfig.js';

// Create style element with appConfig colors
const style = document.createElement('style');
style.textContent = `
  :root {
    --color-primary: ${appConfig.colors.primary};
    --color-primary-light: ${appConfig.colors.primaryLight};
    --color-accent: ${appConfig.colors.accent};
    --color-success: ${appConfig.colors.success};
    --color-success-dark: ${appConfig.colors.successDark};
    --color-danger: ${appConfig.colors.danger};
    --color-dark-bg: ${appConfig.colors.darkBg};
    --color-panel-bg: ${appConfig.colors.panelBg};
    --color-muted-text: ${appConfig.colors.mutedText};
    --color-white: #ffffff;
    --color-darker-bg: #2d2d2d;
    /* Inspector toggle specific colors */
    --color-gradient-start: ${appConfig.colors.gradientStart};
    --color-shadow: ${appConfig.colors.shadowColor};
    --color-shadow-hover: ${appConfig.colors.shadowColorHover};
    --color-shadow-active: ${appConfig.colors.shadowColorActive};
    --color-border-white: ${appConfig.colors.borderWhite};
  }
`;
document.head.appendChild(style);
console.log('🎨 AppConfig colors applied directly to CSS');