using ServiceMarketplace.API.Models.DTOs.Ai;

namespace ServiceMarketplace.API.Services.Interfaces;

public interface IAiService
{
    Task<EnhanceDescriptionResponse> EnhanceDescriptionAsync(EnhanceDescriptionRequest request);

    /// <summary>
    /// Answer a user question about ServiceMarket.
    /// The AI is constrained by a system prompt so it only responds within app context.
    /// </summary>
    Task<AiChatResponse> ChatAsync(AiChatRequest request, CancellationToken ct = default);
}
