using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceMarketplace.API.Constants;

namespace ServiceMarketplace.API.Controllers;

[Route("api/metadata")]
[Authorize]
public class MetadataController : BaseController
{
    [HttpGet("categories")]
    [ProducesResponseType(typeof(string[]), StatusCodes.Status200OK)]
    public IActionResult GetServiceCategories() => Ok(ServiceCategories.All);
}
