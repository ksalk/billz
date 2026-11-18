var builder = WebApplication.CreateBuilder(args);

var app = builder.Build();

app.Use(async (context, next) =>
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
});

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

app.MapMethods(
    "/api/health",
    ["GET", "HEAD"],
    () => Results.Ok(new { status = "ok" })
);

app.MapMethods(
    "/api/{**rest}",
    ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    () => Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Not found")
);

app.MapFallbackToFile("index.html");

app.Run();

public partial class Program;
