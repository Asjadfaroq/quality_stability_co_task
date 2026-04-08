namespace ServiceMarketplace.API.Models.DTOs;

/// <summary>
/// Generic paginated response.
/// </summary>
public sealed class PagedResult<T>
{
    public List<T> Items      { get; init; } = [];
    public int     Page       { get; init; }
    public int     PageSize   { get; init; }
    public int     TotalCount { get; init; }
    public int     TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    public bool    HasNext    => Page < TotalPages;
    public bool    HasPrev    => Page > 1;

    /// <summary>Creates an empty page result.</summary>
    public static PagedResult<T> Empty(int page, int pageSize) => new()
    {
        Items      = [],
        Page       = page,
        PageSize   = pageSize,
        TotalCount = 0
    };
}
