namespace Billz.Api.Infrastructure;

public static class SecurityHeadersExtensions
{
    private const string ContentSecurityPolicy =
        "default-src 'self'; base-uri 'none'; object-src 'none'; "
        + "frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; "
        + "font-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'";

    public static IApplicationBuilder UseBillzSecurityHeaders(this IApplicationBuilder app)
    {
        return app.Use(
            async (context, next) =>
            {
                var headers = context.Response.Headers;
                headers["Content-Security-Policy"] = ContentSecurityPolicy;
                headers["X-Content-Type-Options"] = "nosniff";
                headers["Referrer-Policy"] = "no-referrer";
                headers["X-Frame-Options"] = "DENY";
                headers["Permissions-Policy"] =
                    "camera=(), microphone=(), geolocation=(), payment=()";
                headers["Cross-Origin-Opener-Policy"] = "same-origin";
                headers["Cross-Origin-Resource-Policy"] = "same-origin";

                if (context.Request.IsHttps)
                {
                    headers["Strict-Transport-Security"] = "max-age=31536000";
                }

                await next();
            }
        );
    }
}
