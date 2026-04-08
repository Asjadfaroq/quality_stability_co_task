using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceMarketplace.API.Helpers;
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

    // Returns null body when not yet assigned to an org.
    [HttpGet("mine")]
    [RequirePermission(PermissionNames.OrgView)]
    [ProducesResponseType(typeof(OrgDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyOrgAsMember()
    {
        var org = await _orgService.GetOrgForUserAsync(CurrentUserId);
        return Ok(org);
    }

    // Returns null body when no org created yet.
    [HttpGet]
    [RequirePermission(PermissionNames.OrgView)]
    [ProducesResponseType(typeof(OrgDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyOrg()
    {
        var org = await _orgService.GetOrgByOwnerAsync(CurrentUserId);
        return Ok(org);
    }

    [HttpPost]
    [RequirePermission(PermissionNames.OrgManage)]
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
    [RequirePermission(PermissionNames.OrgManage)]
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
    [RequirePermission(PermissionNames.OrgManage)]
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
    [RequirePermission(PermissionNames.OrgView)]
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

    [HttpGet("permissions")]
    [RequirePermission(PermissionNames.OrgManage)]
    [ProducesResponseType(typeof(List<PermissionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllPermissions()
    {
        var result = await _orgService.GetAllPermissionsAsync();
        return Ok(result);
    }

    [HttpGet("members/{id:guid}/permissions")]
    [RequirePermission(PermissionNames.OrgManage)]
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

    // granted=true → force-grant; false → force-revoke; null → remove override.
    [HttpPatch("members/{id:guid}/permissions")]
    [RequirePermission(PermissionNames.OrgManage)]
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
