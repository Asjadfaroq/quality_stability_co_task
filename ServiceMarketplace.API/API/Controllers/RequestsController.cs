using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ServiceMarketplace.API.Helpers;
using ServiceMarketplace.API.Middleware;
using ServiceMarketplace.API.Models.DTOs;
using ServiceMarketplace.API.Models.DTOs.Requests;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Controllers;

[Route("api/requests")]
[Authorize]
public class RequestsController : BaseController
{
    private const int DefaultPageSize = 50;
    private const int MaxPageSize     = 200;

    private readonly IRequestService _requestService;
    private readonly IValidator<CreateRequestDto> _validator;

    public RequestsController(IRequestService requestService, IValidator<CreateRequestDto> validator)
    {
        _requestService = requestService;
        _validator = validator;
    }

    /// <summary>Create a service request.</summary>
    [HttpPost]
    [EnableRateLimiting(RateLimitPolicies.Writes)]
    [RequirePermission(PermissionNames.RequestCreate)]
    [ProducesResponseType(typeof(ServiceRequestDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromBody] CreateRequestDto dto)
    {
        var validation = await _validator.ValidateAsync(dto);
        if (!validation.IsValid)
            return BadRequest(validation.Errors.Select(e => new { e.PropertyName, e.ErrorMessage }));

        var result = await _requestService.CreateAsync(CurrentUserId, dto);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>
    /// Returns paginated requests scoped by caller role.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<ServiceRequestDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page         = 1,
        [FromQuery] int     pageSize     = DefaultPageSize,
        [FromQuery] string? statusFilter = null,
        [FromQuery] string? search       = null)
    {
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        page     = Math.Max(1, page);

        var result = await _requestService.GetAllAsync(CurrentUserId, CurrentUserRole, page, pageSize, statusFilter, search);
        return Ok(result);
    }

    /// <summary>Find pending requests within a radius.</summary>
    [HttpGet("nearby")]
    [EnableRateLimiting(RateLimitPolicies.Nearby)]
    [RequirePermission(PermissionNames.RequestViewAll)]
    [ProducesResponseType(typeof(List<ServiceRequestDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetNearby(
        [FromQuery] double lat,
        [FromQuery] double lng,
        [FromQuery] double radiusKm)
    {
        if (lat is < -90 or > 90)
            return BadRequest(new { message = "Latitude must be between -90 and 90." });

        if (lng is < -180 or > 180)
            return BadRequest(new { message = "Longitude must be between -180 and 180." });

        if (radiusKm is <= 0 or > 500)
            return BadRequest(new { message = "radiusKm must be between 1 and 500." });

        var result = await _requestService.GetNearbyAsync(lat, lng, radiusKm);
        return Ok(result);
    }

    /// <summary>
    /// Get all completed jobs for the calling provider. Paginated.
    /// </summary>
    [HttpGet("completed")]
    [RequirePermission(PermissionNames.RequestComplete)]
    [ProducesResponseType(typeof(PagedResult<ServiceRequestDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetCompleted(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = DefaultPageSize,
        [FromQuery] string? search   = null)
    {
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        page     = Math.Max(1, page);

        var result = await _requestService.GetCompletedAsync(CurrentUserId, page, pageSize, search);
        return Ok(result);
    }

    /// <summary>
    /// Returns map-ready jobs scoped to caller role.
    /// </summary>
    [HttpGet("map")]
    [ProducesResponseType(typeof(List<MapJobDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetForMap()
    {
        var result = await _requestService.GetForMapAsync(CurrentUserId, CurrentUserRole);
        return Ok(result);
    }

    /// <summary>Get a single request by ID. Customers can only access their own.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ServiceRequestDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _requestService.GetByIdAsync(id, CurrentUserId, CurrentUserRole);
        return Ok(result);
    }

    /// <summary>Accept a pending request. Returns 409 if already accepted.</summary>
    [HttpPatch("{id:guid}/accept")]
    [EnableRateLimiting(RateLimitPolicies.Writes)]
    [RequirePermission(PermissionNames.RequestAccept)]
    [ProducesResponseType(typeof(ServiceRequestDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Accept(Guid id)
    {
        var result = await _requestService.AcceptAsync(id, CurrentUserId);
        return Ok(result);
    }

    /// <summary>Mark an accepted request as pending customer confirmation.</summary>
    [HttpPatch("{id:guid}/complete")]
    [EnableRateLimiting(RateLimitPolicies.Writes)]
    [RequirePermission(PermissionNames.RequestComplete)]
    [ProducesResponseType(typeof(ServiceRequestDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Complete(Guid id)
    {
        var result = await _requestService.CompleteAsync(id, CurrentUserId);
        return Ok(result);
    }

    /// <summary>Customer confirms completion of a request. Restricted to the Customer role.</summary>
    [HttpPatch("{id:guid}/confirm")]
    [EnableRateLimiting(RateLimitPolicies.Writes)]
    [ProducesResponseType(typeof(ServiceRequestDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Confirm(Guid id)
    {
        if (CurrentUserRole != UserRole.Customer)
            return Forbidden("Only customers can confirm job completion.");

        var result = await _requestService.ConfirmAsync(id, CurrentUserId);
        return Ok(result);
    }
}
