using InvestigationRoom.Core.Data;
using Xunit;

namespace InvestigationRoom.Core.Tests;

public class DatabaseIntegrationTests : IDisposable
{
    private readonly string _path;

    public DatabaseIntegrationTests()
    {
        _path = Path.Combine(Path.GetTempPath(), $"ir-test-{Guid.NewGuid():N}.db");
    }

    public void Dispose()
    {
        if (File.Exists(_path))
        {
            File.Delete(_path);
        }
    }

    [Fact]
    public void EncryptedDatabase_CreatesSchema_AndSeedsSixtyDefendants()
    {
        using var db = new InvestigationDatabase(_path, "test-passphrase-123");

        var seeded = MockDataSeeder.SeedComplexCase(db, 60);

        var defendantRepo = new DefendantRepository(db);
        var defendants = defendantRepo.GetByCase(seeded.Id);

        Assert.Equal(60, defendants.Count);
        Assert.Contains(defendants, d => d.CustodyStatus == Models.CustodyStatus.Detained);
    }

    [Fact]
    public void WrongPassphrase_OnExistingEncryptedFile_FailsToRead()
    {
        using (var db = new InvestigationDatabase(_path, "correct-horse-battery-staple"))
        {
            new CaseRepository(db).Upsert(new Models.Case { Title = "test" });
        }

        Assert.ThrowsAny<Exception>(() =>
        {
            using var wrongDb = new InvestigationDatabase(_path, "wrong-password");
            wrongDb.Execute("SELECT count(*) FROM sqlite_master;");
        });
    }
}
