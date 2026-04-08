namespace ServiceMarketplace.API.Domain.Exceptions;

public sealed class NotFoundException : AppException
{
    public NotFoundException(string message)
        : base(404, "NOT_FOUND", message) { }

    public NotFoundException(string resource, object id)
        : base(404, "NOT_FOUND", $"{resource} with id '{id}' was not found.") { }
}
