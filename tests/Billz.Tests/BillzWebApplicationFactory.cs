using Billz.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Billz.Tests;

public sealed class BillzWebApplicationFactory : WebApplicationFactory<Program>
{
    public string? WebRoot { get; init; }

    public string DatabasePath { get; } = Path.Combine(
        Path.GetTempPath(),
        $"billz-tests-{Guid.NewGuid():N}",
        "billz.db"
    );

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        if (WebRoot is not null)
        {
            builder.UseWebRoot(WebRoot);
        }

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<BillzDbContext>();
            services.RemoveAll<DbContextOptions<BillzDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<BillzDbContext>>();

            var connectionString = new SqliteConnectionStringBuilder
            {
                DataSource = DatabasePath,
                ForeignKeys = true,
                DefaultTimeout = 5,
                Pooling = false,
            }.ToString();

            services.AddDbContext<BillzDbContext>(options =>
                options.UseSqlite(connectionString).AddInterceptors(new SqlitePragmaInterceptor())
            );
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        SqliteConnection.ClearAllPools();

        var directory = Path.GetDirectoryName(DatabasePath);
        if (directory is not null && Directory.Exists(directory))
        {
            try
            {
                Directory.Delete(directory, recursive: true);
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
    }
}
