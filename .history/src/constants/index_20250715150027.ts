// Animation and timing constants
export const ANIMATION_DURATION = {
  SHORT: 200,
  MEDIUM: 300,
  LONG: 500,
} as const;

// Breakpoints
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
} as const;

// AR Configuration
export const AR_CONFIG = {
  REQUIRED_FEATURES: ['plane-detection'],
  OPTIONAL_FEATURES: ['dom-overlay'],
  SESSION_TYPE: 'immersive-ar',
} as const;

// Menu constants
export const MENU_GRID = {
  ITEMS_PER_PAGE: 12,
  GRID_COLS: {
    MOBILE: 1,
    TABLET: 2,
    DESKTOP: 3,
  },
} as const;
