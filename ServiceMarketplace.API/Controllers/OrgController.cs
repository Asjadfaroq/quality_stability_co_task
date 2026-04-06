using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

    [HttpGet("members")]
    [ProducesResponseType(typeof(List<OrgMemberDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMembers()
    {
        if (!IsInRole(UserRole.ProviderAdmin)) return Forbid();

        var members = await _orgService.GetOrgMembersAsync(CurrentUserId);
        return Ok(members);
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
