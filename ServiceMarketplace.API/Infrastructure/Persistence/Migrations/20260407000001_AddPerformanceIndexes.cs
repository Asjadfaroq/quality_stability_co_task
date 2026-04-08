using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiceMarketplace.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Replace the single-column RequestId index with a composite (RequestId, SentAt) index.
            // This eliminates the sort operator for GetHistoryAsync (ORDER BY SentAt) and for
            // GetConversationsAsync (GROUP BY RequestId + MAX(SentAt)) — both queries are now
            // fully covered by a single index seek + range scan.
            migrationBuilder.DropIndex(
                name: "IX_ChatMessages_RequestId",
                table: "ChatMessages");

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_RequestId_SentAt",
                table: "ChatMessages",
                columns: new[] { "RequestId", "SentAt" });

            // New geo index covering the bounding-box pre-filter in GetNearbyAsync:
            //   WHERE Status = Pending AND Latitude BETWEEN @latMin AND @latMax
            //                          AND Longitude BETWEEN @lngMin AND @lngMax
            // Without this index, SQL Server falls back to a full scan of ServiceRequests
            // after filtering on Status. The leading Status column allows a filtered scan
            // restricted to Pending rows only, making it equivalent to a filtered index.
            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_Status_Latitude_Longitude",
                table: "ServiceRequests",
                columns: new[] { "Status", "Latitude", "Longitude" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ChatMessages_RequestId_SentAt",
                table: "ChatMessages");

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_RequestId",
                table: "ChatMessages",
                column: "RequestId");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_Status_Latitude_Longitude",
                table: "ServiceRequests");
        }
    }
}
