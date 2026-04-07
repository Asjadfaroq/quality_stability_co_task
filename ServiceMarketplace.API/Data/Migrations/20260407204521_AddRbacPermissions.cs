using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiceMarketplace.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRbacPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Use IF NOT EXISTS so this migration is safe to apply even when some
            // rows were inserted manually during development.
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM [Permissions] WHERE [Id] = 5)
                    INSERT INTO [Permissions] ([Id], [Name]) VALUES (5, N'admin.manage_users');

                IF NOT EXISTS (SELECT 1 FROM [Permissions] WHERE [Id] = 6)
                    INSERT INTO [Permissions] ([Id], [Name]) VALUES (6, N'org.manage');

                IF NOT EXISTS (SELECT 1 FROM [Permissions] WHERE [Id] = 7)
                    INSERT INTO [Permissions] ([Id], [Name]) VALUES (7, N'org.view');

                -- ProviderEmployee -> request.view_all
                IF NOT EXISTS (SELECT 1 FROM [RolePermissions] WHERE [Role] = 2 AND [PermissionId] = 4)
                    INSERT INTO [RolePermissions] ([Role], [PermissionId]) VALUES (2, 4);

                -- ProviderAdmin -> org.manage
                IF NOT EXISTS (SELECT 1 FROM [RolePermissions] WHERE [Role] = 1 AND [PermissionId] = 6)
                    INSERT INTO [RolePermissions] ([Role], [PermissionId]) VALUES (1, 6);

                -- ProviderAdmin -> org.view
                IF NOT EXISTS (SELECT 1 FROM [RolePermissions] WHERE [Role] = 1 AND [PermissionId] = 7)
                    INSERT INTO [RolePermissions] ([Role], [PermissionId]) VALUES (1, 7);

                -- ProviderEmployee -> org.view
                IF NOT EXISTS (SELECT 1 FROM [RolePermissions] WHERE [Role] = 2 AND [PermissionId] = 7)
                    INSERT INTO [RolePermissions] ([Role], [PermissionId]) VALUES (2, 7);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumns: new[] { "PermissionId", "Role" },
                keyValues: new object[] { 4, 2 });

            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumns: new[] { "PermissionId", "Role" },
                keyValues: new object[] { 6, 1 });

            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumns: new[] { "PermissionId", "Role" },
                keyValues: new object[] { 7, 1 });

            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumns: new[] { "PermissionId", "Role" },
                keyValues: new object[] { 7, 2 });

            migrationBuilder.DeleteData(
                table: "Permissions",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DeleteData(
                table: "Permissions",
                keyColumn: "Id",
                keyValue: 6);

            migrationBuilder.DeleteData(
                table: "Permissions",
                keyColumn: "Id",
                keyValue: 7);
        }
    }
}
