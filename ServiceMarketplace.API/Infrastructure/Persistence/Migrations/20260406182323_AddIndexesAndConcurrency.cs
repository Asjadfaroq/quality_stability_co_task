using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiceMarketplace.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddIndexesAndConcurrency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "ServiceRequests",
                type: "rowversion",
                rowVersion: true,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_Status",
                table: "ServiceRequests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_RequestId",
                table: "ChatMessages",
                column: "RequestId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_Status",
                table: "ServiceRequests");

            migrationBuilder.DropIndex(
                name: "IX_ChatMessages_RequestId",
                table: "ChatMessages");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "ServiceRequests");
        }
    }
}
