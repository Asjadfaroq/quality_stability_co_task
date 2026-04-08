namespace ServiceMarketplace.API.Domain.Exceptions;

public sealed class UnprocessableEntityException : AppException
{
    public UnprocessableEntityException(string message)
        : base(422, "UNPROCESSABLE_ENTITY", message) { }
}
