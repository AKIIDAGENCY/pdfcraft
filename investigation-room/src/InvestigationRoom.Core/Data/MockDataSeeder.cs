using InvestigationRoom.Core.Legal;
using InvestigationRoom.Core.Models;

namespace InvestigationRoom.Core.Data;

/// <summary>
/// Seeds a single realistic-looking 60-defendant cross-border
/// terrorism-financing case, for end-to-end UI/performance verification
/// (virtualized lists, detention dashboard at scale, search). All names
/// and details are synthetic.
/// </summary>
public static class MockDataSeeder
{
    public static Case SeedComplexCase(InvestigationDatabase db, int defendantCount = 60)
    {
        var caseRepo = new CaseRepository(db);
        var defendantRepo = new DefendantRepository(db);

        var now = DateTimeOffset.Now;
        var seededCase = new Case
        {
            CaseNumber = "25/إرهاب/0147",
            RegistrationDate = now.AddMonths(-7),
            Title = "قضية تمويل جماعة إرهابية وتبييض أموال عابرة للحدود",
            LegalQualification = "تمويل الإرهاب، تبييض الأموال، الانتماء لجماعة إرهابية عبر وطنية",
            IsTransnational = true,
            PrimaryJudgeName = "قاضي التحقيق الأول بالقطب الجزائي المتخصص",
            Notes = "بيانات تجريبية (Mock) لأغراض اختبار الأداء والواجهة فقط — لا تمثل قضية حقيقية.",
        };
        caseRepo.Upsert(seededCase);

        caseRepo.AddJudge(new CaseJudge { CaseId = seededCase.Id, JudgeName = "قاضي التحقيق الأول", Role = "رئيسي", AssignedAt = seededCase.RegistrationDate });
        caseRepo.AddJudge(new CaseJudge { CaseId = seededCase.Id, JudgeName = "قاضي التحقيق الملحق الثاني", Role = "ملحق", AssignedAt = seededCase.RegistrationDate.AddDays(5) });
        caseRepo.AddJudge(new CaseJudge { CaseId = seededCase.Id, JudgeName = "قاضي التحقيق الملحق الثالث", Role = "ملحق", AssignedAt = seededCase.RegistrationDate.AddDays(5) });

        var random = new Random(42);
        var firstNames = new[] { "محمد", "أحمد", "يوسف", "عبد الرحمن", "إسماعيل", "خالد", "بلال", "عمر", "طارق", "رياض", "سفيان", "ياسين" };
        var lastNames = new[] { "بوزيد", "حمادي", "مرابط", "بلخير", "صالحي", "دراجي", "زروقي", "بن علي", "قاسمي", "لعروسي", "شريف", "بوضياف" };
        var roles = new[] { "فاعل أصلي", "شريك", "محرض" };
        var lawyers = new List<Lawyer>();
        for (var i = 1; i <= 8; i++)
        {
            var lawyer = new Lawyer { Name = $"الأستاذ(ة) محامي {i}", BarId = $"BAR-{1000 + i}", Phone = $"0550-00-00-{i:00}" };
            defendantRepo.UpsertLawyer(lawyer);
            lawyers.Add(lawyer);
        }

        for (var i = 0; i < defendantCount; i++)
        {
            var name = $"{firstNames[random.Next(firstNames.Length)]} {lastNames[random.Next(lastNames.Length)]} {i + 1:000}";
            var custodyRoll = random.NextDouble();
            var custodyStatus = custodyRoll switch
            {
                < 0.55 => Models.CustodyStatus.Detained,
                < 0.80 => Models.CustodyStatus.JudicialControl,
                < 0.92 => Models.CustodyStatus.Free,
                _ => Models.CustodyStatus.Wanted,
            };

            var defendant = new Defendant
            {
                CaseId = seededCase.Id,
                FullName = name,
                NationalId = $"{100000000 + random.Next(0, 899999999):000000000}",
                RoleInCase = roles[random.Next(roles.Length)],
                CustodyStatus = custodyStatus,
                ArrestWarrantArt193 = custodyStatus == Models.CustodyStatus.Wanted,
                Notes = string.Empty,
            };
            defendantRepo.Upsert(defendant);
            defendantRepo.AttachLawyer(defendant.Id, lawyers[random.Next(lawyers.Count)].Id);

            var severe = random.NextDouble() < 0.7;
            defendantRepo.UpsertCharge(new Charge
            {
                DefendantId = defendant.Id,
                Description = severe ? "تمويل جماعة إرهابية" : "تبييض أموال",
                LegalBasis = severe ? "المادة 87 مكرر 4 - قانون العقوبات" : "المادة 389 مكرر - قانون العقوبات",
                SeverityBand = severe ? "جناية مشددة" : "جناية",
                QualifiesExtendedDetention = severe,
            });

            if (custodyStatus == Models.CustodyStatus.Detained)
            {
                SeedDetentionChain(defendantRepo, defendant, random, now);
            }

            if (custodyStatus == Models.CustodyStatus.JudicialControl)
            {
                SeedJudicialControlMeasures(defendantRepo, defendant, random, now);
            }

            defendantRepo.AddInterrogation(new Interrogation
            {
                DefendantId = defendant.Id,
                OccurredAt = seededCase.RegistrationDate.AddDays(random.Next(1, 20)),
                Kind = "استجواب",
                Summary = "استجواب أولي حول وقائع التهمة.",
                LawyerPresent = true,
            });
        }

        var supportRepo = new CaseSupportRepository(db);
        supportRepo.UpsertInterception(new Interception
        {
            CaseId = seededCase.Id,
            Kind = "تنصت",
            TargetDescription = "خط هاتفي مرتبط بالمشتبه به الرئيسي",
            AuthorizedAt = now.AddMonths(-3),
            ExpiresAt = now.AddMonths(-3) + LegalRules.InterceptionMaxPeriod,
            AuthorizedBy = "قاضي التحقيق الأول",
        });

        supportRepo.UpsertSeizure(new Seizure
        {
            CaseId = seededCase.Id,
            AssetDescription = "شركة واجهة لاستيراد وتصدير مواد البناء",
            AssetKind = "شركة واجهة",
            EstimatedValue = "≈ 450,000,000 دج",
            SeizedAt = now.AddMonths(-2),
            Status = "مجمد",
        });

        return seededCase;
    }

    private static void SeedDetentionChain(DefendantRepository repo, Defendant defendant, Random random, DateTimeOffset now)
    {
        var start = now.AddMonths(-random.Next(1, 14));
        repo.AddDetentionRecord(new DetentionRecordEntity
        {
            DefendantId = defendant.Id,
            RecordType = "ايداع",
            DecidedAt = start,
            PeriodStart = start,
            PeriodEnd = start + LegalRules.FelonyBaseDetentionTerm,
            DurationMonths = 4,
            DecidedBy = "قاضي التحقيق الأول",
            NotifiedAt = start.AddDays(1),
        });

        var cursor = start + LegalRules.FelonyBaseDetentionTerm;
        var renewals = random.Next(0, LegalRules.MaxJudgeRenewals + 1);
        for (var i = 0; i < renewals && cursor < now; i++)
        {
            repo.AddDetentionRecord(new DetentionRecordEntity
            {
                DefendantId = defendant.Id,
                RecordType = "تمديد_قاضي_تحقيق",
                DecidedAt = cursor,
                PeriodStart = cursor,
                PeriodEnd = cursor + LegalRules.RenewalStepLength,
                DurationMonths = 4,
                DecidedBy = "قاضي التحقيق الأول",
                NotifiedAt = cursor.AddDays(1),
            });
            cursor += LegalRules.RenewalStepLength;
        }
    }

    private static void SeedJudicialControlMeasures(DefendantRepository repo, Defendant defendant, Random random, DateTimeOffset now)
    {
        var count = random.Next(1, 4);
        var shuffled = LegalRules.JudicialControlMeasures.OrderBy(_ => random.Next()).Take(count);
        foreach (var (code, _) in shuffled)
        {
            repo.UpsertJudicialControl(new JudicialControlEntry
            {
                DefendantId = defendant.Id,
                MeasureCode = code,
                ImposedAt = now.AddMonths(-random.Next(1, 6)),
            });
        }
    }
}
