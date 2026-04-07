using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceMarketplace.API.Middleware;
using ServiceMarketplace.API.Models.DTOs;
using ServiceMarketplace.API.Models.DTOs.Admin;
using ServiceMarketplace.API.Models.DTOs.Org;
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
    /// Returns the org the calling user belongs to (ProviderAdmin or ProviderEmployee).
    /// Always 200; null body means not yet assigned to an org.
    /// </summary>
    [HttpGet("mine")]
    [RequirePermission("org.view")]
    [ProducesResponseType(typeof(OrgDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyOrgAsMember()
    {
        var org = await _orgService.GetOrgForUserAsync(CurrentUserId);
        return Ok(org);
    }

    /// <summary>
    /// Returns the calling ProviderAdmin's organization.
    /// Always 200; null body means no org created yet.
    /// Requires org.view — management operations within the page require org.manage.
    /// </summary>
    [HttpGet]
    [RequirePermission("org.view")]
    [ProducesResponseType(typeof(OrgDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyOrg()
    {
        var org = await _orgService.GetOrgByOwnerAsync(CurrentUserId);
        return Ok(org);
    }

    [HttpPost]
    [RequirePermission("org.manage")]
    [ProducesResponseType(typeof(OrgDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateOrg([FromBody] CreateOrgRequest request)
    {
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

    [HttpPost("members")]
    [RequirePermission("org.manage")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddMember([FromBody] AddMemberRequest request)
    {
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

    [HttpDelete("members/{id:guid}")]
    [RequirePermission("org.manage")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveMember(Guid id)
    {
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
    [RequirePermission("org.view")]
    [ProducesResponseType(typeof(PagedResult<OrgMemberDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMembers(
        [FromQuery] int page     = 1,
        [FromQuery] int pageSize = 20)
    {
        page     = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var result = await _orgService.GetOrgMembersAsync(CurrentUserId, page, pageSize);
        return Ok(result);
    }

    // ── Member permission overrides ───────────────────────────────────────────

    /// <summary>
    /// Returns all platform permissions (list only — no role assignments).
    /// Used by ProviderAdmin to populate the member permission override UI.
    /// </summary>
    [HttpGet("permissions")]
    [RequirePermission("org.manage")]
    [ProducesResponseType(typeof(List<PermissionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllPermissions()
    {
        var result = await _orgService.GetAllPermissionsAsync();
        return Ok(result);
    }

    /// <summary>
    /// Returns explicit permission overrides for a member of the calling ProviderAdmin's org.
    /// </summary>
    [HttpGet("members/{id:guid}/permissions")]
    [RequirePermission("org.manage")]
    [ProducesResponseType(typeof(List<UserPermissionOverrideDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMemberPermissions(Guid id)
    {
        try
        {
            var result = await _orgService.GetMemberPermissionsAsync(CurrentUserId, id);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Sets or removes an explicit permission override for an org member.
    /// granted=true → force-grant; false → force-revoke; null → remove override.
    /// </summary>
    [HttpPatch("members/{id:guid}/permissions")]
    [RequirePermission("org.manage")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateMemberPermission(Guid id, [FromBody] UpdateUserPermissionRequest request)
    {
        try
        {
            await _orgService.UpdateMemberPermissionAsync(CurrentUserId, id, request.PermissionName, request.Granted);
            return Ok(new { message = "Member permission updated." });
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
