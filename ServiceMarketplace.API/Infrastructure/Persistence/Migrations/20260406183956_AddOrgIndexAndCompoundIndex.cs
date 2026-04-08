using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiceMarketplace.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOrgIndexAndCompoundIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_AcceptedByProviderId",
                table: "ServiceRequests");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_AcceptedByProviderId_Status",
                table: "ServiceRequests",
                columns: new[] { "AcceptedByProviderId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_AcceptedByProviderId_Status",
                table: "ServiceRequests");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_AcceptedByProviderId",
                table: "ServiceRequests",
                column: "AcceptedByProviderId");
        }
    }
}
