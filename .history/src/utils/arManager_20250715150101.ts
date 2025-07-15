import { AR_CONFIG } from '../constants';

export class ARManager {
  private static instance: ARManager;
  private session: XRSession | null = null;

  private constructor() {}

  static getInstance(): ARManager {
    if (!ARManager.instance) {
      ARManager.instance = new ARManager();
    }
    return ARManager.instance;
  }

  async isSupported(): Promise<boolean> {
    if (!('xr' in navigator) || !navigator.xr) {
      return false;
    }

    try {
      return await navigator.xr.isSessionSupported(AR_CONFIG.SESSION_TYPE);
    } catch (error) {
      console.error('AR support check failed:', error);
      return false;
    }
  }

  async startSession(): Promise<XRSession | null> {
    if (!navigator.xr) {
      throw new Error('WebXR not supported');
    }

    try {
      this.session = await navigator.xr.requestSession(AR_CONFIG.SESSION_TYPE, {
        requiredFeatures: AR_CONFIG.REQUIRED_FEATURES,
        optionalFeatures: AR_CONFIG.OPTIONAL_FEATURES,
      });

      this.session.addEventListener('end', () => {
        this.session = null;
      });

      return this.session;
    } catch (error) {
      console.error('Failed to start AR session:', error);
      throw error;
    }
  }

  async endSession(): Promise<void> {
    if (this.session) {
      await this.session.end();
      this.session = null;
    }
  }

  getSession(): XRSession | null {
    return this.session;
  }

  isSessionActive(): boolean {
    return this.session !== null;
  }
}

export const arManager = ARManager.getInstance();
