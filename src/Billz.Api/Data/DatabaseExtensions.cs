using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Billz.Api.Data;

public static class DatabaseExtensions
{
    public static string ResolveDatabasePath(
        IConfiguration configuration,
        IHostEnvironment environment
    )
    {
        var configuredPath = configuration["Billz:DatabasePath"];

        if (string.IsNullOrWhiteSpace(configuredPath))
        {
            configuredPath = GetDefaultDatabasePath();
        }
        else if (
            configuredPath.StartsWith("~/", StringComparison.Ordinal)
            || configuredPath.StartsWith("~\\", StringComparison.Ordinal)
        )
        {
            var remainder = configuredPath[2..];
            if (configuredPath.Length <= 2 || Path.IsPathRooted(remainder))
            {
                throw new InvalidOperationException(
                    "Billz:DatabasePath must include a file name inside the home directory."
                );
            }

            var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            configuredPath = Path.Combine(home, remainder);
        }
        else if (configuredPath.StartsWith('~'))
        {
            throw new InvalidOperationException(
                "Billz:DatabasePath may only use the current user's home directory (~/...)."
            );
        }

        if (
            configuredPath.EndsWith(Path.DirectorySeparatorChar)
            || configuredPath.EndsWith(Path.AltDirectorySeparatorChar)
        )
        {
            throw new InvalidOperationException(
                "Billz:DatabasePath must include a database file name."
            );
        }

        var absolutePath = Path.IsPathRooted(configuredPath)
            ? configuredPath
            : Path.Combine(environment.ContentRootPath, configuredPath);

        return Path.GetFullPath(absolutePath);
    }

    public static IServiceCollection AddBillzDatabase(
        this IServiceCollection services,
        string databasePath
    )
    {
        var connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = databasePath,
            ForeignKeys = true,
            DefaultTimeout = 5,
        }.ToString();

        services.AddDbContext<BillzDbContext>(options =>
            options.UseSqlite(connectionString).AddInterceptors(new SqlitePragmaInterceptor())
        );

        return services;
    }

    public static async Task MigrateBillzDatabaseAsync(this WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<BillzDbContext>();
        var databasePath = database.Database.GetDbConnection().DataSource;
        var directory = Path.GetDirectoryName(databasePath);

        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        using var migrationLock = await AcquireMigrationLockAsync(databasePath);

        await database.Database.MigrateAsync();
        await database.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;");

        app.Logger.LogInformation("Using SQLite database at {DatabasePath}", databasePath);
    }

    private static string GetDefaultDatabasePath()
    {
        var dataRoot = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

        if (string.IsNullOrWhiteSpace(dataRoot))
        {
            var userProfile = Environment.GetFolderPath(
                Environment.SpecialFolder.UserProfile
            );

            if (string.IsNullOrWhiteSpace(userProfile))
            {
                throw new InvalidOperationException(
                    "Could not resolve a per-user data directory. Set Billz:DatabasePath explicitly."
                );
            }

            dataRoot = Path.Combine(userProfile, ".local", "share");
        }

        return Path.Combine(dataRoot, "billz", "billz.db");
    }

    private static async Task<FileStream> AcquireMigrationLockAsync(string databasePath)
    {
        var lockPath = databasePath + ".migrate.lock";
        IOException? lastContention = null;

        for (var attempt = 0; attempt < 60; attempt++)
        {
            try
            {
                return new FileStream(
                    lockPath,
                    FileMode.OpenOrCreate,
                    FileAccess.ReadWrite,
                    FileShare.None
                );
            }
            catch (IOException exception) when (IsLockContention(exception))
            {
                lastContention = exception;

                if (attempt == 59)
                {
                    break;
                }

                await Task.Delay(500);
            }
        }

        throw new InvalidOperationException(
            $"Could not acquire the database migration lock for {databasePath}.",
            lastContention
        );
    }

    private static bool IsLockContention(IOException exception) =>
        exception.HResult is 11 or 32 or 33 or 35 or unchecked((int)0x80070020)
            or unchecked((int)0x80070021);
}
