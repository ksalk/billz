using Billz.Api.Data;
using Billz.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var databasePath = DatabaseExtensions.ResolveDatabasePath(
    builder.Configuration,
    builder.Environment
);

builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false;
    options.Limits.MaxRequestBodySize = ServerLimits.MaxRequestBodyBytes;
});
builder.Services.AddBillzDatabase(databasePath);

var app = builder.Build();

app.UseBillzSecurityHeaders();

app.Use(
    async (context, next) =>
    {
        context.Response.OnStarting(() =>
        {
            if (string.IsNullOrEmpty(context.Response.Headers.CacheControl))
            {
                context.Response.Headers.CacheControl = "no-cache";
            }

            return Task.CompletedTask;
        });

        await next();
    }
);

app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = context =>
    {
        context.Context.Response.Headers.CacheControl =
            context.Context.Request.Path.StartsWithSegments("/assets")
                ? "public, max-age=31536000, immutable"
                : "no-cache";
    },
});

app.UseBillzRequestGuard(
    builder.Configuration.GetSection("Billz:AllowedOrigins").Get<string[]>() ?? []
);

app.MapMethods(
    "/api/health",
    ["GET", "HEAD"],
    async (
        BillzDbContext database,
        ILogger<Program> logger,
        CancellationToken cancellationToken
    ) =>
    {
        try
        {
            await database.Database.ExecuteSqlRawAsync("SELECT 1", cancellationToken);
            return Results.Ok(new { status = "ok" });
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Database health check failed");
            return Results.Problem(
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Database unavailable"
            );
        }
    }
);

app.MapMethods(
    "/api/{**rest}",
    ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    () => Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Not found")
);

app.MapFallbackToFile("index.html");

app.Logger.LogWarning(
    "Authentication is disabled. Run Billz only on a trusted private network."
);

await app.MigrateBillzDatabaseAsync();

app.Run();

public partial class Program;
