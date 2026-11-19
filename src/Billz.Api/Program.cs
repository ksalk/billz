using System.Text.Json;
using Billz.Api.Api.Bills;
using Billz.Api.Data;
using Billz.Api.Infrastructure;
using Microsoft.AspNetCore.Diagnostics;
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
builder.Services.Configure<RouteHandlerOptions>(options =>
{
    options.ThrowOnBadRequest = true;
});
builder.Services.ConfigureHttpJsonOptions(options => BillJson.Configure(options.SerializerOptions));

var app = builder.Build();

app.UseBillzSecurityHeaders();
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        if (context.Response.HasStarted)
        {
            return;
        }

        var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;

        if (exception is OperationCanceledException)
        {
            context.Response.StatusCode = 499;
            return;
        }

        var statusCode = exception switch
        {
            BadHttpRequestException badRequest => badRequest.StatusCode,
            JsonException => StatusCodes.Status400BadRequest,
            _ => StatusCodes.Status500InternalServerError,
        };
        var logger = context.RequestServices
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("Billz.Errors");

        if (statusCode >= StatusCodes.Status500InternalServerError)
        {
            logger.LogError(exception, "Unhandled request error");
        }
        else
        {
            logger.LogWarning("Request rejected with status {StatusCode}", statusCode);
        }

        await Results.Problem(
            statusCode: statusCode,
            title:
                statusCode is >= 400 and < 500
                    ? "Invalid request"
                    : "An unexpected error occurred"
        ).ExecuteAsync(context);
    });
});

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

app.MapBillEndpoints();

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
