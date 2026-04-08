using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceMarketplace.API.Helpers;
using ServiceMarketplace.API.Models.DTOs.Billing;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Controllers;

[Route("api/billing")]
[Authorize]
public class BillingController : BaseController
{
    private readonly IStripeService _stripeService;
    private readonly ILogger<BillingController> _logger;

    public BillingController(IStripeService stripeService, ILogger<BillingController> logger)
    {
        _stripeService = stripeService;
        _logger        = logger;
    }

    /// <summary>
    /// Creates a Stripe Checkout session and returns the redirect URL.
    /// Customers only — redirects to Stripe-hosted payment page.
    /// </summary>
    [HttpPost("checkout")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateCheckoutSession()
    {
        if (CurrentUserRole != UserRole.Customer)
            return Forbidden("Subscription checkout is available to Customer accounts only.");

        var userId = CurrentUserId;

        if (await _stripeService.HasActiveSubscriptionAsync(userId))
            return BadRequest(new { message = "You already have an active subscription." });

        var email = User.FindFirstValue(ClaimConstants.Email)
                 ?? User.FindFirstValue(ClaimTypes.Email)
                 ?? string.Empty;

        var origin     = Request.Headers.Origin.ToString();
        var successUrl = $"{origin}/customer/subscription/success";
        var cancelUrl  = $"{origin}/customer/subscription";

        try
        {
            var url = await _stripeService.CreateCheckoutSessionAsync(userId, email, successUrl, cancelUrl);
            return Ok(new { url });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("Checkout unavailable due to billing configuration: {Message}", ex.Message);
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Opens the Stripe Customer Portal so customers can manage or cancel their subscription.
    /// </summary>
    [HttpPost("portal")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreatePortalSession()
    {
        if (CurrentUserRole != UserRole.Customer)
            return Forbidden("Subscription management is available to Customer accounts only.");

        var userId    = CurrentUserId;
        var origin    = Request.Headers.Origin.ToString();
        var returnUrl = $"{origin}/customer/subscription";

        try
        {
            var url = await _stripeService.CreateCustomerPortalSessionAsync(userId, returnUrl);
            return Ok(new { url });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("Billing portal unavailable: {Message}", ex.Message);
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Returns the current subscription status for the authenticated customer.
    /// </summary>
    [HttpGet("status")]
    [ProducesResponseType(typeof(SubscriptionStatusDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSubscriptionStatus()
    {
        if (CurrentUserRole != UserRole.Customer)
            return Forbidden("Subscription status is available to Customer accounts only.");

        var status = await _stripeService.GetSubscriptionStatusAsync(CurrentUserId);
        return Ok(status);
    }

    /// <summary>
    /// Stripe webhook endpoint — receives payment/subscription lifecycle events.
    /// No authentication; verified via Stripe-Signature header.
    /// Raw body buffering is enabled globally for this path in Program.cs.
    /// </summary>
    [HttpPost("webhook")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Webhook()
    {
        var payload   = await new StreamReader(Request.Body).ReadToEndAsync();
        var signature = Request.Headers["Stripe-Signature"].ToString();

        if (string.IsNullOrEmpty(signature))
        {
            _logger.LogWarning("Stripe webhook received without Stripe-Signature header.");
            return BadRequest(new { message = "Missing Stripe-Signature header." });
        }

        try
        {
            await _stripeService.HandleWebhookAsync(payload, signature);
            return Ok();
        }
        catch (Stripe.StripeException ex)
        {
            _logger.LogWarning("Stripe webhook rejected: {Message}", ex.Message);
            return BadRequest(new { message = "Invalid webhook signature." });
        }
    }
}
