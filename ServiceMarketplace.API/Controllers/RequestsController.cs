using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceMarketplace.API.Middleware;
using ServiceMarketplace.API.Models.DTOs.Requests;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Controllers;

/// <summary>Service request lifecycle management.</summary>
[Route("api/requests")]
[Authorize]
public class RequestsController : BaseController
{
    private readonly IRequestService _requestService;
    private readonly IValidator<CreateRequestDto> _validator;

    public RequestsController(IRequestService requestService, IValidator<CreateRequestDto> validator)
    {
        _requestService = requestService;
        _validator = validator;
    }

    /// <summary>Create a new service request. Requires request.create permission. Free tier limited to 3 requests.</summary>
    [HttpPost]
    [RequirePermission("request.create")]
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

    /// <summary>Get requests filtered by role: Customer=own, Provider=all pending, Admin=all.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<ServiceRequestDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll()
    {
        var result = await _requestService.GetAllAsync(CurrentUserId, CurrentUserRole);
        return Ok(result);
    }

    /// <summary>Find pending requests within a radius using Haversine. Requires request.view_all permission.</summary>
    [HttpGet("nearby")]
    [RequirePermission("request.view_all")]
    [ProducesResponseType(typeof(List<ServiceRequestDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetNearby([FromQuery] double lat, [FromQuery] double lng, [FromQuery] double radiusKm)
    {
        if (lat < -90 || lat > 90)
            return BadRequest(new { message = "Latitude must be between -90 and 90." });

        if (lng < -180 || lng > 180)
            return BadRequest(new { message = "Longitude must be between -180 and 180." });

        if (radiusKm <= 0)
            return BadRequest(new { message = "radiusKm must be greater than 0." });

        var result = await _requestService.GetNearbyAsync(lat, lng, radiusKm);
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
    [RequirePermission("request.accept")]
    [ProducesResponseType(typeof(ServiceRequestDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Accept(Guid id)
    {
        var result = await _requestService.AcceptAsync(id, CurrentUserId);
        return Ok(result);
    }

    /// <summary>Complete an accepted request. Returns 403 if caller is not the acceptor, 422 if not in Accepted state.</summary>
    [HttpPatch("{id:guid}/complete")]
    [RequirePermission("request.complete")]
    [ProducesResponseType(typeof(ServiceRequestDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Complete(Guid id)
    {
        var result = await _requestService.CompleteAsync(id, CurrentUserId);
        return Ok(result);
    }
}
