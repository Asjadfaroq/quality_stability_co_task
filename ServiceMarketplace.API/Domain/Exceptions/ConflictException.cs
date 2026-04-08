namespace ServiceMarketplace.API.Domain.Exceptions;

public sealed class ConflictException : AppException
{
    public ConflictException(string message)
        : base(409, "CONFLICT", message) { }
}
