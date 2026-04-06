using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Models.Entities;
using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Data;

public class AppDbContext : IdentityDbContext<User, IdentityRole<Guid>, Guid>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<ServiceRequest> ServiceRequests => Set<ServiceRequest>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<UserPermission> UserPermissions => Set<UserPermission>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // User
        builder.Entity<User>(e =>
        {
            e.Property(u => u.Role).IsRequired();
            e.Property(u => u.SubTier).IsRequired();
            e.HasOne(u => u.Organization)
             .WithMany(o => o.Members)
             .HasForeignKey(u => u.OrganizationId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        // Organization
        builder.Entity<Organization>(e =>
        {
            e.HasKey(o => o.Id);
            e.Property(o => o.Name).IsRequired().HasMaxLength(200);
            e.HasOne(o => o.Owner)
             .WithMany()
             .HasForeignKey(o => o.OwnerId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ServiceRequest
        builder.Entity<ServiceRequest>(e =>
        {
            e.HasKey(r => r.Id);
            e.Property(r => r.Title).IsRequired().HasMaxLength(200);
            e.Property(r => r.Description).IsRequired().HasMaxLength(2000);
            e.Property(r => r.Category).HasMaxLength(100);
            e.Property(r => r.Latitude).HasColumnType("decimal(9,6)");
            e.Property(r => r.Longitude).HasColumnType("decimal(9,6)");
            e.Property(r => r.RowVersion).IsRowVersion();
            e.HasOne(r => r.Customer)
             .WithMany(u => u.ServiceRequests)
             .HasForeignKey(r => r.CustomerId)
             .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(r => r.AcceptedByProvider)
             .WithMany()
             .HasForeignKey(r => r.AcceptedByProviderId)
             .OnDelete(DeleteBehavior.SetNull);
            // Indexes for common query patterns
            e.HasIndex(r => r.CustomerId);
            e.HasIndex(r => r.Status);
            e.HasIndex(r => r.AcceptedByProviderId);
        });

        // ChatMessage
        builder.Entity<ChatMessage>(e =>
        {
            e.HasIndex(m => m.RequestId);
        });

        // Permission
        builder.Entity<Permission>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.Name).IsRequired().HasMaxLength(100);
            e.HasIndex(p => p.Name).IsUnique();
        });

        // RolePermission — composite PK
        builder.Entity<RolePermission>(e =>
        {
            e.HasKey(rp => new { rp.Role, rp.PermissionId });
            e.HasOne(rp => rp.Permission)
             .WithMany(p => p.RolePermissions)
             .HasForeignKey(rp => rp.PermissionId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // UserPermission — composite PK
        builder.Entity<UserPermission>(e =>
        {
            e.HasKey(up => new { up.UserId, up.PermissionId });
            e.HasOne(up => up.User)
             .WithMany(u => u.UserPermissions)
             .HasForeignKey(up => up.UserId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(up => up.Permission)
             .WithMany(p => p.UserPermissions)
             .HasForeignKey(up => up.PermissionId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        SeedPermissions(builder);
        SeedRolePermissions(builder);
    }

    private static void SeedPermissions(ModelBuilder builder)
    {
        builder.Entity<Permission>().HasData(
            new Permission { Id = 1, Name = "request.create" },
            new Permission { Id = 2, Name = "request.accept" },
            new Permission { Id = 3, Name = "request.complete" },
            new Permission { Id = 4, Name = "request.view_all" }
        );
    }

    private static void SeedRolePermissions(ModelBuilder builder)
    {
        builder.Entity<RolePermission>().HasData(
            // Customer -> request.create
            new RolePermission { Role = UserRole.Customer, PermissionId = 1 },

            // ProviderAdmin -> request.accept, request.complete, request.view_all
            new RolePermission { Role = UserRole.ProviderAdmin, PermissionId = 2 },
            new RolePermission { Role = UserRole.ProviderAdmin, PermissionId = 3 },
            new RolePermission { Role = UserRole.ProviderAdmin, PermissionId = 4 },

            // ProviderEmployee -> request.accept, request.complete
            new RolePermission { Role = UserRole.ProviderEmployee, PermissionId = 2 },
            new RolePermission { Role = UserRole.ProviderEmployee, PermissionId = 3 }
        );
    }
}
