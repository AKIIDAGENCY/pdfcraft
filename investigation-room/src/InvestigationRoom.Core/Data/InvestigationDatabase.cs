using System.Reflection;
using Microsoft.Data.Sqlite;

namespace InvestigationRoom.Core.Data;

/// <summary>
/// Opens the local, SQLCipher-encrypted SQLite file (AES-256 at rest via
/// SQLitePCLRaw.bundle_e_sqlcipher), applies the schema, and exposes small
/// ADO.NET helpers the repositories build on.
/// </summary>
public sealed class InvestigationDatabase : IDisposable
{
    static InvestigationDatabase()
    {
        SQLitePCL.Batteries_V2.Init();
    }

    public SqliteConnection Connection { get; }

    public InvestigationDatabase(string filePath, string passphrase)
    {
        var builder = new SqliteConnectionStringBuilder
        {
            DataSource = filePath,
            // Pooling must be off: Microsoft.Data.Sqlite pools connections
            // by connection string, and the passphrase is applied via a
            // PRAGMA afterwards rather than being part of that string. A
            // pooled, already-keyed connection would silently ignore a
            // *different* (e.g. wrong) passphrase on a later open of the
            // same file — exactly the confidentiality bug this exists to
            // prevent.
            Pooling = false,
        };

        Connection = new SqliteConnection(builder.ConnectionString);
        Connection.Open();

        if (!string.IsNullOrEmpty(passphrase))
        {
            using var keyCmd = Connection.CreateCommand();
            // SQLCipher's PRAGMA key does not take a bound parameter; the
            // value is escaped (doubled single quotes) to stay a literal.
            keyCmd.CommandText = $"PRAGMA key = '{passphrase.Replace("'", "''")}';";
            keyCmd.ExecuteNonQuery();
        }

        ApplySchema();
    }

    private void ApplySchema()
    {
        using var cmd = Connection.CreateCommand();
        cmd.CommandText = ReadEmbeddedSchema();
        cmd.ExecuteNonQuery();
    }

    private static string ReadEmbeddedSchema()
    {
        var assembly = typeof(InvestigationDatabase).Assembly;
        var resourceName = assembly.GetManifestResourceNames().First(n => n.EndsWith("schema.sql", StringComparison.Ordinal));
        using var stream = assembly.GetManifestResourceStream(resourceName)!;
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }

    public int Execute(string sql, Action<SqliteParameterCollection>? bind = null)
    {
        using var cmd = Connection.CreateCommand();
        cmd.CommandText = sql;
        bind?.Invoke(cmd.Parameters);
        return cmd.ExecuteNonQuery();
    }

    public List<T> Query<T>(string sql, Func<SqliteDataReader, T> map, Action<SqliteParameterCollection>? bind = null)
    {
        using var cmd = Connection.CreateCommand();
        cmd.CommandText = sql;
        bind?.Invoke(cmd.Parameters);
        using var reader = cmd.ExecuteReader();
        var results = new List<T>();
        while (reader.Read())
        {
            results.Add(map(reader));
        }

        return results;
    }

    public T? QuerySingle<T>(string sql, Func<SqliteDataReader, T> map, Action<SqliteParameterCollection>? bind = null)
        where T : class
    {
        return Query(sql, map, bind).FirstOrDefault();
    }

    public void Dispose() => Connection.Dispose();
}

internal static class ReaderExtensions
{
    public static string GetStringOrEmpty(this SqliteDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? string.Empty : reader.GetString(ordinal);
    }

    public static DateTimeOffset GetDateTimeOffset(this SqliteDataReader reader, string column) =>
        DateTimeOffset.Parse(reader.GetString(reader.GetOrdinal(column)));

    public static DateTimeOffset? GetNullableDateTimeOffset(this SqliteDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? null : DateTimeOffset.Parse(reader.GetString(ordinal));
    }

    public static bool GetBool(this SqliteDataReader reader, string column) =>
        reader.GetInt64(reader.GetOrdinal(column)) != 0;

    public static string? GetNullableString(this SqliteDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    public static void AddP(this SqliteParameterCollection parameters, string name, object? value) =>
        parameters.AddWithValue(name, value ?? DBNull.Value);

    public static void AddP(this SqliteParameterCollection parameters, string name, DateTimeOffset value) =>
        parameters.AddWithValue(name, value.ToString("O"));

    public static void AddP(this SqliteParameterCollection parameters, string name, DateTimeOffset? value) =>
        parameters.AddWithValue(name, value.HasValue ? value.Value.ToString("O") : DBNull.Value);

    public static void AddP(this SqliteParameterCollection parameters, string name, bool value) =>
        parameters.AddWithValue(name, value ? 1 : 0);
}
