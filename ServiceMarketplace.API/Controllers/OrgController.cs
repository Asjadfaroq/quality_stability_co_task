using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceMarketplace.API.Models.DTOs;
using ServiceMarketplace.API.Models.DTOs.Admin;
using ServiceMarketplace.API.Models.DTOs.Org;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Controllers;

[Route("api/org")]
[Authorize]
public class OrgController : BaseController
{
    private readonly IOrgService _orgService;

    public OrgController(IOrgService orgService)
    {
        _orgService = orgService;
    }

    /// <summary>
    /// Returns the current ProviderAdmin's organization, or null if none exists yet.
    /// Always 200 — callers distinguish "no org" by checking for a null body.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(OrgDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMyOrg()
    {
        if (!IsInRole(UserRole.ProviderAdmin)) return Forbid();

        var org = await _orgService.GetOrgByOwnerAsync(CurrentUserId);
        return Ok(org);
    }

    /// <summary>
    /// Creates a new organization owned by the current ProviderAdmin.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(OrgDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateOrg([FromBody] CreateOrgRequest request)
    {
        if (!IsInRole(UserRole.ProviderAdmin)) return Forbid();

        try
        {
            var org = await _orgService.CreateOrgAsync(CurrentUserId, request.Name);
            return CreatedAtAction(nameof(GetMyOrg), org);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Adds a ProviderEmployee to the current ProviderAdmin's organization by email.
    /// Returns 400 if the user is already in another org, not a ProviderEmployee, or not found.
    /// </summary>
    [HttpPost("members")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddMember([FromBody] AddMemberRequest request)
    {
        if (!IsInRole(UserRole.ProviderAdmin)) return Forbid();

        try
        {
            await _orgService.AddMemberAsync(CurrentUserId, request.Email);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Removes a member from the current ProviderAdmin's organization.
    /// The owner cannot remove themselves.
    /// </summary>
    [HttpDelete("members/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveMember(Guid id)
    {
        if (!IsInRole(UserRole.ProviderAdmin)) return Forbid();

        try
        {
            await _orgService.RemoveMemberAsync(CurrentUserId, id);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("members")]
    [ProducesResponseType(typeof(PagedResult<OrgMemberDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMembers(
        [FromQuery] int page     = 1,
        [FromQuery] int pageSize = 20)
    {
        if (!IsInRole(UserRole.ProviderAdmin)) return Forbid();

        page     = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var result = await _orgService.GetOrgMembersAsync(CurrentUserId, page, pageSize);
        return Ok(result);
    }

    [HttpPatch("members/{id:guid}/permissions")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateMemberPermissions(Guid id, [FromBody] UpdatePermissionsRequest request)
    {
        if (!IsInRole(UserRole.ProviderAdmin)) return Forbid();

        try
        {
            await _orgService.UpdateMemberPermissionsAsync(CurrentUserId, id, request.Overrides);
            return Ok(new { message = "Permissions updated." });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
