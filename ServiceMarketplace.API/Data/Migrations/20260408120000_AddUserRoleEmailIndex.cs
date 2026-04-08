using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiceMarketplace.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUserRoleEmailIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Composite index on (Role, Email) covering the admin user-list query:
            //   WHERE Role = @role ORDER BY Email  (role-filter tab)
            //   ORDER BY Email                     (All tab, no role filter)
            //
            // SQL Server can seek into the leading Role column for filtered tabs,
            // then range-scan the Email column for the ORDER BY — eliminating
            // both a table scan and a sort operator in every user-list query.
            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_Role_Email",
                table: "AspNetUsers",
                columns: new[] { "Role", "Email" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_Role_Email",
                table: "AspNetUsers");
        }
    }
}
