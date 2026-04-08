namespace ServiceMarketplace.API.Logging;

/// <summary>
/// Classifies a log entry so the UI can route it to the correct audience.
/// </summary>
public enum LogCategory
{
    /// <summary>Infrastructure: HTTP pipeline, exceptions, EF queries, background jobs.</summary>
    System,

    /// <summary>Business activity: who did what, when. Visible to the actor themselves.</summary>
    Audit
}
