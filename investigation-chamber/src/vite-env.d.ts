/// <reference types="vite/client" />

import type { InvestigationChamberApi } from '../electron/preload';

declare global {
  interface Window {
    api: InvestigationChamberApi;
  }
}

export {};
