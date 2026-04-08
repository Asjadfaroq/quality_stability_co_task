namespace ServiceMarketplace.API.Models.Entities;

public class Organization
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid OwnerId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? Owner { get; set; }
    public ICollection<User> Members { get; set; } = [];
}
