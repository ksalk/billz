using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Billz.Api.Data;

public sealed class BillzDbContextFactory : IDesignTimeDbContextFactory<BillzDbContext>
{
    public BillzDbContext CreateDbContext(string[] args)
    {
        // Design-time model generation only. Runtime migrations run at startup
        // against the configured data directory.
        var options = new DbContextOptionsBuilder<BillzDbContext>()
            .UseSqlite(
                $"Data Source={Path.Combine(Path.GetTempPath(), "billz-design-time-model-only.db")}"
            )
            .Options;

        return new BillzDbContext(options);
    }
}
