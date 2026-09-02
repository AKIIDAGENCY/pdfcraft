/**
 * Populates the local database with the 60-defendant mock case for
 * end-to-end verification. Run with `npm run seed`.
 *
 * Safe to re-run: it always seeds a fresh case (new UUIDs), so running it
 * twice just adds a second demo case rather than corrupting existing data.
 */
import { generateMockCase } from '../../shared/data/mockCaseGenerator';
import { getDb, closeDb } from './connection';

export function runSeed(closeAfter = true): void {
  const bundle = generateMockCase();
  const db = getDb();

  const txn = db.transaction(() => {
    for (const judge of bundle.judges) {
      db.prepare('INSERT INTO judges (id, full_name, role) VALUES (?, ?, ?)').run(
        judge.id,
        judge.fullName,
        judge.role,
      );
    }
    for (const lawyer of bundle.lawyers) {
      db.prepare('INSERT INTO lawyers (id, full_name, bar_number, phone, email) VALUES (?, ?, ?, ?, ?)').run(
        lawyer.id,
        lawyer.fullName,
        lawyer.barNumber,
        lawyer.phone ?? null,
        lawyer.email ?? null,
      );
    }

    db.prepare(
      `INSERT INTO cases (id, case_number, registration_date, title, legal_qualifications, is_transnational,
         requires_forensic_or_cross_border, primary_investigating_judge_id, status, notes, created_at, updated_at)
       VALUES (@id, @caseNumber, @registrationDate, @title, @legalQualifications, @isTransnational,
         @requiresForensicOrCrossBorder, @primaryInvestigatingJudgeId, @status, @notes, @createdAt, @updatedAt)`,
    ).run({
      id: bundle.case.id,
      caseNumber: bundle.case.caseNumber,
      registrationDate: bundle.case.registrationDate,
      title: bundle.case.title,
      legalQualifications: JSON.stringify(bundle.case.legalQualifications),
      isTransnational: bundle.case.isTransnational ? 1 : 0,
      requiresForensicOrCrossBorder: bundle.case.requiresForensicOrCrossBorder ? 1 : 0,
      primaryInvestigatingJudgeId: bundle.case.primaryInvestigatingJudgeId,
      status: bundle.case.status,
      notes: bundle.case.notes ?? null,
      createdAt: bundle.case.createdAt,
      updatedAt: bundle.case.updatedAt,
    });
    for (const judgeId of bundle.case.ancillaryInvestigatingJudgeIds) {
      db.prepare('INSERT INTO case_ancillary_judges (case_id, judge_id) VALUES (?, ?)').run(
        bundle.case.id,
        judgeId,
      );
    }

    for (const entity of bundle.entities) {
      db.prepare(
        'INSERT INTO entities (id, case_id, name, registration_number, jurisdiction) VALUES (?, ?, ?, ?, ?)',
      ).run(entity.id, entity.caseId, entity.name, entity.registrationNumber ?? null, entity.jurisdiction ?? null);
    }

    for (const defendant of bundle.defendants) {
      db.prepare(
        `INSERT INTO defendants (id, case_id, full_name, alias_hidden, national_id, nationality, date_of_birth,
           role, custody_status, created_at, updated_at)
         VALUES (@id, @caseId, @fullName, @aliasHidden, @nationalId, @nationality, @dateOfBirth, @role,
           @custodyStatus, @createdAt, @updatedAt)`,
      ).run({
        id: defendant.id,
        caseId: defendant.caseId,
        fullName: defendant.fullName,
        aliasHidden: defendant.aliasHidden ? 1 : 0,
        nationalId: defendant.nationalId ?? null,
        nationality: defendant.nationality ?? null,
        dateOfBirth: defendant.dateOfBirth ?? null,
        role: defendant.role,
        custodyStatus: defendant.custodyStatus,
        createdAt: defendant.createdAt,
        updatedAt: defendant.updatedAt,
      });
      for (const lawyerId of defendant.lawyerIds) {
        db.prepare('INSERT OR IGNORE INTO defendant_lawyers (defendant_id, lawyer_id) VALUES (?, ?)').run(
          defendant.id,
          lawyerId,
        );
      }
    }

    for (const link of bundle.defendantEntityLinks) {
      db.prepare(
        'INSERT OR IGNORE INTO defendant_entities (defendant_id, entity_id, role_in_entity) VALUES (?, ?, ?)',
      ).run(link.defendantId, link.entityId, link.roleInEntity);
    }

    for (const charge of bundle.charges) {
      db.prepare(
        `INSERT INTO charges (id, case_id, defendant_id, qualification, article_references, severity_tier, max_penalty_description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        charge.id,
        charge.caseId,
        charge.defendantId,
        charge.qualification,
        JSON.stringify(charge.articleReferences),
        charge.severityTier,
        charge.maxPenaltyDescription,
      );
    }

    for (const event of bundle.detentionEvents) {
      db.prepare(
        `INSERT INTO detention_records (id, defendant_id, case_id, type, ordered_by, start_date, duration_months,
           notification_date, document_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        event.id,
        event.defendantId,
        event.caseId,
        event.type,
        event.orderedBy,
        event.startDate,
        event.durationMonths,
        event.notificationDate ?? null,
        event.documentId ?? null,
        event.createdAt,
      );
    }

    for (const jc of bundle.judicialControlMeasures) {
      db.prepare(
        `INSERT INTO judicial_control (id, defendant_id, case_id, measure_code, imposed_date, review_date, active, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(jc.id, jc.defendantId, jc.caseId, jc.measureCode, jc.imposedDate, jc.reviewDate ?? null, jc.active ? 1 : 0, jc.notes ?? null);
    }

    for (const interception of bundle.interceptions) {
      db.prepare(
        `INSERT INTO interceptions (id, case_id, defendant_id, target, authorized_by, start_date, duration_months, renewal_of, article_references)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        interception.id,
        interception.caseId,
        interception.defendantId ?? null,
        interception.target,
        interception.authorizedBy,
        interception.startDate,
        interception.durationMonths,
        interception.renewalOf ?? null,
        JSON.stringify(interception.articleReferences),
      );
    }

    for (const infiltration of bundle.infiltrations) {
      db.prepare(
        `INSERT INTO infiltrations (id, case_id, authorized_by, start_date, duration_months, agent_code_name, extension_of)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        infiltration.id,
        infiltration.caseId,
        infiltration.authorizedBy,
        infiltration.startDate,
        infiltration.durationMonths,
        infiltration.agentCodeName,
        infiltration.extensionOf ?? null,
      );
    }

    for (const seizure of bundle.seizures) {
      db.prepare(
        `INSERT INTO seizures (id, case_id, defendant_id, asset_description, estimated_value, currency, seizure_date, status, article_references)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        seizure.id,
        seizure.caseId,
        seizure.defendantId ?? null,
        seizure.assetDescription,
        seizure.estimatedValue ?? null,
        seizure.currency ?? null,
        seizure.seizureDate,
        seizure.status,
        JSON.stringify(seizure.articleReferences),
      );
    }

    for (const { record, realIdentity } of bundle.protectedWitnesses) {
      db.prepare(
        `INSERT INTO witnesses_protected (id, case_id, pseudonym, sealed_file_ref, protection_measures, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(record.id, record.caseId, record.pseudonym, record.sealedFileRef, JSON.stringify(record.protectionMeasures), record.createdAt);
      db.prepare(
        `INSERT INTO witness_sealed_identity (sealed_file_ref, real_full_name, real_address, access_log)
         VALUES (?, ?, ?, '[]')`,
      ).run(record.sealedFileRef, realIdentity.fullName, realIdentity.address ?? null);
    }

    for (const link of bundle.networkLinks) {
      db.prepare(
        `INSERT INTO network_links (id, case_id, source_defendant_id, target_defendant_id, relationship, shared_asset_ids)
         VALUES (?, ?, ?, ?, ?, '[]')`,
      ).run(link.id, link.caseId, link.sourceDefendantId, link.targetDefendantId, link.relationship);
    }

    for (const interrogation of bundle.interrogations) {
      db.prepare(
        `INSERT INTO interrogations (id, defendant_id, case_id, date, type, judge_id, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        interrogation.id,
        interrogation.defendantId,
        interrogation.caseId,
        interrogation.date,
        interrogation.type,
        interrogation.judgeId,
        interrogation.summary,
      );
    }
  });

  txn();

  console.log(`Seeded case "${bundle.case.title}" (${bundle.case.caseNumber})`);
  console.log(`  ${bundle.defendants.length} defendants, ${bundle.detentionEvents.length} detention events,`);
  console.log(`  ${bundle.interceptions.length} interceptions, ${bundle.seizures.length} seizures,`);
  console.log(`  ${bundle.protectedWitnesses.length} protected witnesses, ${bundle.networkLinks.length} network links.`);

  if (closeAfter) closeDb();
}

// Only auto-run when this file is executed directly (`npm run seed`), not
// when imported as a module (e.g. by a test harness reusing runSeed()).
if (require.main === module) {
  runSeed();
}
