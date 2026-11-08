import { contextBridge, ipcRenderer } from 'electron';

/**
 * Renderer-facing API surface. Deliberately explicit (rather than a
 * generic `invoke(channel, ...args)` passthrough) so the renderer — which
 * may one day load third-party or less-trusted content — cannot invoke an
 * arbitrary main-process IPC channel.
 */
const api = {
  dashboard: {
    stats: () => ipcRenderer.invoke('dashboard:stats'),
  },
  cases: {
    list: () => ipcRenderer.invoke('cases:list'),
    get: (caseId: string) => ipcRenderer.invoke('cases:get', caseId),
    create: (input: unknown) => ipcRenderer.invoke('cases:create', input),
  },
  judges: {
    list: () => ipcRenderer.invoke('judges:list'),
    create: (input: unknown) => ipcRenderer.invoke('judges:create', input),
  },
  lawyers: {
    list: () => ipcRenderer.invoke('lawyers:list'),
    create: (input: unknown) => ipcRenderer.invoke('lawyers:create', input),
  },
  defendants: {
    listByCase: (caseId: string) => ipcRenderer.invoke('defendants:listByCase', caseId),
    get: (id: string) => ipcRenderer.invoke('defendants:get', id),
    create: (input: unknown) => ipcRenderer.invoke('defendants:create', input),
    bulkUpdateCustodyStatus: (ids: string[], status: string) =>
      ipcRenderer.invoke('defendants:bulkUpdateCustodyStatus', ids, status),
    matrix: (caseId: string) => ipcRenderer.invoke('defendants:matrix', caseId),
  },
  charges: {
    listByDefendant: (defendantId: string) => ipcRenderer.invoke('charges:listByDefendant', defendantId),
    create: (input: unknown) => ipcRenderer.invoke('charges:create', input),
  },
  detention: {
    listByDefendant: (defendantId: string) => ipcRenderer.invoke('detention:listByDefendant', defendantId),
    create: (input: unknown) => ipcRenderer.invoke('detention:create', input),
    status: (defendantId: string, severityTier: string, chamberExtensionEligible: boolean) =>
      ipcRenderer.invoke('detention:status', defendantId, severityTier, chamberExtensionEligible),
  },
  judicialControl: {
    listByDefendant: (defendantId: string) => ipcRenderer.invoke('judicialControl:listByDefendant', defendantId),
    create: (input: unknown) => ipcRenderer.invoke('judicialControl:create', input),
  },
  interceptions: {
    listByCase: (caseId: string) => ipcRenderer.invoke('interceptions:listByCase', caseId),
    create: (input: unknown) => ipcRenderer.invoke('interceptions:create', input),
  },
  infiltrations: {
    listByCase: (caseId: string) => ipcRenderer.invoke('infiltrations:listByCase', caseId),
    create: (input: unknown) => ipcRenderer.invoke('infiltrations:create', input),
  },
  seizures: {
    listByCase: (caseId: string) => ipcRenderer.invoke('seizures:listByCase', caseId),
    create: (input: unknown) => ipcRenderer.invoke('seizures:create', input),
  },
  witnesses: {
    listByCase: (caseId: string) => ipcRenderer.invoke('witnesses:listByCase', caseId),
    create: (input: unknown, realIdentity: unknown) => ipcRenderer.invoke('witnesses:create', input, realIdentity),
    revealIdentity: (sealedFileRef: string, userId: string, pin: string) =>
      ipcRenderer.invoke('witnesses:revealIdentity', sealedFileRef, userId, pin),
  },
  security: {
    isRevealPinSet: () => ipcRenderer.invoke('security:isRevealPinSet'),
    setRevealPin: (pin: string) => ipcRenderer.invoke('security:setRevealPin', pin),
  },
  network: {
    listByCase: (caseId: string) => ipcRenderer.invoke('network:listByCase', caseId),
    create: (input: unknown) => ipcRenderer.invoke('network:create', input),
  },
  entities: {
    listByCase: (caseId: string) => ipcRenderer.invoke('entities:listByCase', caseId),
    listDefendantLinks: (caseId: string) => ipcRenderer.invoke('entities:listDefendantLinks', caseId),
  },
  documents: {
    listByCase: (caseId: string) => ipcRenderer.invoke('documents:listByCase', caseId),
    create: (input: unknown) => ipcRenderer.invoke('documents:create', input),
  },
  interrogations: {
    listByDefendant: (defendantId: string) => ipcRenderer.invoke('interrogations:listByDefendant', defendantId),
    create: (input: unknown) => ipcRenderer.invoke('interrogations:create', input),
  },
  deadlines: {
    appeal: (notificationDateIso: string) => ipcRenderer.invoke('deadlines:appeal', notificationDateIso),
    prosecutionReview: (fileReceivedDateIso: string) =>
      ipcRenderer.invoke('deadlines:prosecutionReview', fileReceivedDateIso),
    interception: (record: unknown) => ipcRenderer.invoke('deadlines:interception', record),
  },
  exportFile: {
    save: (defaultFileName: string, data: Uint8Array, filters: { name: string; extensions: string[] }[]) =>
      ipcRenderer.invoke('export:saveFile', defaultFileName, data, filters),
    printHtmlToPdf: (html: string) => ipcRenderer.invoke('export:printHtmlToPdf', html),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type InvestigationChamberApi = typeof api;
