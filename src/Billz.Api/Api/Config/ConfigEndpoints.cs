namespace Billz.Api.Api.Config;

public sealed record BillzSettings(string Currency);

public static class ConfigEndpoints
{
    public static IEndpointRouteBuilder MapConfigEndpoint(this IEndpointRouteBuilder app)
    {
        app.MapGet(
            "/api/config",
            (BillzSettings settings) => Results.Ok(new { settings.Currency })
        );

        return app;
    }
}
