namespace ServiceMarketplace.API.Models.DTOs;

/// <summary>
/// Generic paginated response envelope returned by all list endpoints.
/// Consumers read <see cref="Items"/> for data and the metadata fields for
/// building navigation controls.
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

    /// <summary>Convenience factory for an empty page (e.g., when the underlying query returns nothing).</summary>
    public static PagedResult<T> Empty(int page, int pageSize) => new()
    {
        Items      = [],
        Page       = page,
        PageSize   = pageSize,
        TotalCount = 0
    };
}
