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
    public DbSet<UserStripeInfo> UserStripeInfos => Set<UserStripeInfo>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<User>(e =>
        {
            e.Property(u => u.Role).IsRequired();
            e.Property(u => u.SubTier).IsRequired();
            e.HasOne(u => u.Organization)
             .WithMany(o => o.Members)
             .HasForeignKey(u => u.OrganizationId)
             .OnDelete(DeleteBehavior.SetNull);
            e.HasIndex(u => u.OrganizationId);
        });

        builder.Entity<Organization>(e =>
        {
            e.HasKey(o => o.Id);
            e.Property(o => o.Name).IsRequired().HasMaxLength(200);
            e.HasOne(o => o.Owner)
             .WithMany()
             .HasForeignKey(o => o.OwnerId)
             .OnDelete(DeleteBehavior.Restrict);
        });

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
            e.HasIndex(r => r.CustomerId);
            e.HasIndex(r => r.Status);
            // Covers the provider query: pending requests OR accepted by this provider
            e.HasIndex(r => new { r.AcceptedByProviderId, r.Status });
            // Covers the bounding-box geo filter in GetNearbyAsync:
            // WHERE Status = Pending AND Latitude BETWEEN x AND y AND Longitude BETWEEN a AND b
            e.HasIndex(r => new { r.Status, r.Latitude, r.Longitude })
             .HasDatabaseName("IX_ServiceRequests_Status_Latitude_Longitude");
        });

        builder.Entity<ChatMessage>(e =>
        {
            // Composite index covers both the history query (WHERE RequestId = x ORDER BY SentAt)
            // and the conversation query (GROUP BY RequestId, MAX(SentAt)) without a separate sort.
            e.HasIndex(m => new { m.RequestId, m.SentAt })
             .HasDatabaseName("IX_ChatMessages_RequestId_SentAt");
        });

        builder.Entity<Permission>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.Name).IsRequired().HasMaxLength(100);
            e.HasIndex(p => p.Name).IsUnique();
        });

        builder.Entity<RolePermission>(e =>
        {
            e.HasKey(rp => new { rp.Role, rp.PermissionId });
            e.HasOne(rp => rp.Permission)
             .WithMany(p => p.RolePermissions)
             .HasForeignKey(rp => rp.PermissionId)
             .OnDelete(DeleteBehavior.Cascade);
        });

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

        builder.Entity<UserStripeInfo>(e =>
        {
            e.HasKey(s => s.UserId);
            e.HasOne(s => s.User)
             .WithOne()
             .HasForeignKey<UserStripeInfo>(s => s.UserId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(s => s.StripeCustomerId).IsUnique();
            e.HasIndex(s => s.StripeSubscriptionId);
            e.Property(s => s.StripeCustomerId).IsRequired().HasMaxLength(100);
            e.Property(s => s.StripeSubscriptionId).HasMaxLength(100);
            e.Property(s => s.SubscriptionStatus).HasMaxLength(50);
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
            new RolePermission { Role = UserRole.Customer,         PermissionId = 1 },

            new RolePermission { Role = UserRole.ProviderAdmin,    PermissionId = 2 },
            new RolePermission { Role = UserRole.ProviderAdmin,    PermissionId = 3 },
            new RolePermission { Role = UserRole.ProviderAdmin,    PermissionId = 4 },

            new RolePermission { Role = UserRole.ProviderEmployee, PermissionId = 2 },
            new RolePermission { Role = UserRole.ProviderEmployee, PermissionId = 3 }
        );
    }
}
