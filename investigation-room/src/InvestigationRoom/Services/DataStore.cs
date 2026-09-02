using System;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using InvestigationRoom.Models;

namespace InvestigationRoom.Services;

/// <summary>
/// Reads and writes the whole workspace (all cases, defendants and the
/// procedure template) to a single JSON file under the user's AppData
/// folder. Every mutation in the app is followed by an explicit Save()
/// call so nothing is lost if the program is closed unexpectedly.
/// </summary>
public class DataStore
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
    };

    public string FilePath { get; }

    public DataStore()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var folder = Path.Combine(appData, "InvestigationRoom");
        Directory.CreateDirectory(folder);
        FilePath = Path.Combine(folder, "workspace.json");
    }

    public Workspace Load()
    {
        if (!File.Exists(FilePath))
        {
            return new Workspace();
        }

        try
        {
            var json = File.ReadAllText(FilePath);
            var workspace = JsonSerializer.Deserialize<Workspace>(json, SerializerOptions);
            return workspace ?? new Workspace();
        }
        catch (Exception)
        {
            // Corrupted or unreadable file: back it up and start fresh
            // rather than losing the ability to launch the app.
            var backupPath = FilePath + $".corrupted-{DateTime.Now:yyyyMMddHHmmss}.bak";
            try
            {
                File.Copy(FilePath, backupPath, overwrite: true);
            }
            catch
            {
                // Ignore: best-effort backup only.
            }

            return new Workspace();
        }
    }

    public void Save(Workspace workspace)
    {
        var json = JsonSerializer.Serialize(workspace, SerializerOptions);
        var tempPath = FilePath + ".tmp";
        File.WriteAllText(tempPath, json);
        File.Copy(tempPath, FilePath, overwrite: true);
        File.Delete(tempPath);
    }
}
