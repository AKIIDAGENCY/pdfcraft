import { ipcMain, BrowserWindow, dialog } from 'electron';
import fs from 'node:fs';
import * as repo from '../db/repository';
import { computeDetentionStatus, evaluateRenewalEligibility } from '../../shared/engine/detentionEngine';
import {
  computeAppealDeadline,
  computeProsecutionReviewDeadline,
  computeInterceptionStatus,
} from '../../shared/engine/deadlineEngine';
import type { CrimeSeverityTier } from '../../shared/types';

/** Registers every renderer-facing IPC channel. Call once from main.ts. */
export function registerIpcHandlers(): void {
  // Dashboard -------------------------------------------------------------
  ipcMain.handle('dashboard:stats', () => repo.computeDashboardStats());

  // Cases ---------------------------------------------------------------
  ipcMain.handle('cases:list', () => repo.listCases());
  ipcMain.handle('cases:get', (_e, caseId: string) => repo.getCase(caseId));
  ipcMain.handle('cases:create', (_e, input) => repo.createCase(input));

  // Judges / Lawyers ------------------------------------------------------
  ipcMain.handle('judges:list', () => repo.listJudges());
  ipcMain.handle('judges:create', (_e, input) => repo.createJudge(input));
  ipcMain.handle('lawyers:list', () => repo.listLawyers());
  ipcMain.handle('lawyers:create', (_e, input) => repo.createLawyer(input));

  // Defendants ------------------------------------------------------------
  ipcMain.handle('defendants:listByCase', (_e, caseId: string) => repo.listDefendantsByCase(caseId));
  ipcMain.handle('defendants:get', (_e, id: string) => repo.getDefendant(id));
  ipcMain.handle('defendants:create', (_e, input) => repo.createDefendant(input));
  ipcMain.handle('defendants:bulkUpdateCustodyStatus', (_e, ids: string[], status) =>
    repo.bulkUpdateCustodyStatus(ids, status),
  );
  ipcMain.handle('defendants:matrix', (_e, caseId: string) => repo.getDefendantMatrix(caseId));

  // Charges -----------------------------------------------------------------
  ipcMain.handle('charges:listByDefendant', (_e, defendantId: string) => repo.listChargesByDefendant(defendantId));
  ipcMain.handle('charges:create', (_e, input) => repo.createCharge(input));

  // Detention + legal engine ------------------------------------------------
  ipcMain.handle('detention:listByDefendant', (_e, defendantId: string) =>
    repo.listDetentionEventsByDefendant(defendantId),
  );
  ipcMain.handle('detention:create', (_e, input) => repo.createDetentionEvent(input));
  ipcMain.handle(
    'detention:status',
    (_e, defendantId: string, severityTier: CrimeSeverityTier, chamberExtensionEligible: boolean) => {
      const events = repo.listDetentionEventsByDefendant(defendantId);
      const status = computeDetentionStatus(events, severityTier, { chamberExtensionEligible });
      const eligibility = evaluateRenewalEligibility(status);
      return { status, eligibility };
    },
  );

  // Judicial control --------------------------------------------------------
  ipcMain.handle('judicialControl:listByDefendant', (_e, defendantId: string) =>
    repo.listJudicialControlByDefendant(defendantId),
  );
  ipcMain.handle('judicialControl:create', (_e, input) => repo.createJudicialControlMeasure(input));

  // Interceptions / infiltrations / seizures --------------------------------
  ipcMain.handle('interceptions:listByCase', (_e, caseId: string) => repo.listInterceptionsByCase(caseId));
  ipcMain.handle('interceptions:create', (_e, input) => repo.createInterception(input));
  ipcMain.handle('infiltrations:listByCase', (_e, caseId: string) => repo.listInfiltrationsByCase(caseId));
  ipcMain.handle('infiltrations:create', (_e, input) => repo.createInfiltration(input));
  ipcMain.handle('seizures:listByCase', (_e, caseId: string) => repo.listSeizuresByCase(caseId));
  ipcMain.handle('seizures:create', (_e, input) => repo.createSeizure(input));

  // Protected witnesses -------------------------------------------------------
  ipcMain.handle('witnesses:listByCase', (_e, caseId: string) => repo.listProtectedWitnessesByCase(caseId));
  ipcMain.handle('witnesses:create', (_e, input, realIdentity) =>
    repo.createProtectedWitness(input, realIdentity),
  );
  ipcMain.handle('witnesses:revealIdentity', (_e, sealedFileRef: string, userId: string) =>
    repo.revealProtectedWitnessIdentity(sealedFileRef, userId),
  );

  // Network graph ------------------------------------------------------------
  ipcMain.handle('network:listByCase', (_e, caseId: string) => repo.listNetworkLinksByCase(caseId));
  ipcMain.handle('network:create', (_e, input) => repo.createNetworkLink(input));

  // Shell entities (Art. 100) --------------------------------------------------
  ipcMain.handle('entities:listByCase', (_e, caseId: string) => repo.listEntitiesByCase(caseId));
  ipcMain.handle('entities:listDefendantLinks', (_e, caseId: string) => repo.listDefendantEntityLinksByCase(caseId));

  // Documents & interrogations -------------------------------------------------
  ipcMain.handle('documents:listByCase', (_e, caseId: string) => repo.listDocumentsByCase(caseId));
  ipcMain.handle('documents:create', (_e, input) => repo.createDocumentRecord(input));
  ipcMain.handle('interrogations:listByDefendant', (_e, defendantId: string) =>
    repo.listInterrogationsByDefendant(defendantId),
  );
  ipcMain.handle('interrogations:create', (_e, input) => repo.createInterrogation(input));

  // Deadlines -----------------------------------------------------------------
  ipcMain.handle('deadlines:appeal', (_e, notificationDateIso: string) =>
    computeAppealDeadline(new Date(notificationDateIso)),
  );
  ipcMain.handle('deadlines:prosecutionReview', (_e, fileReceivedDateIso: string) =>
    computeProsecutionReviewDeadline(new Date(fileReceivedDateIso)),
  );
  ipcMain.handle('deadlines:interception', (_e, record) => computeInterceptionStatus(record));

  // Export: save an ArrayBuffer/Buffer (docx or pdf bytes) via native save dialog.
  ipcMain.handle(
    'export:saveFile',
    async (event, defaultFileName: string, data: Uint8Array, filters: { name: string; extensions: string[] }[]) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showSaveDialog(win ?? undefined as any, {
        defaultPath: defaultFileName,
        filters,
      });
      if (result.canceled || !result.filePath) return { saved: false };
      fs.writeFileSync(result.filePath, Buffer.from(data));
      return { saved: true, filePath: result.filePath };
    },
  );

  // Export: render an arbitrary HTML document (a statutory order template)
  // to PDF using a hidden, disposable window — this relies on Chromium's
  // own text shaping engine, which renders Arabic correctly (kerning,
  // ligatures, RTL) without any extra font-shaping library.
  ipcMain.handle('export:printHtmlToPdf', async (_event, html: string) => {
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    try {
      await printWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
      const buffer = await printWindow.webContents.printToPDF({
        landscape: false,
        printBackground: true,
        pageSize: 'A4',
      });
      return buffer;
    } finally {
      printWindow.destroy();
    }
  });
}
