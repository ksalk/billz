namespace Billz.Api.Infrastructure;

public static class RequestGuardExtensions
{
    private static readonly string[] AllowedFetchSiteValues =
    [
        "same-origin",
        "same-site",
        "none",
    ];

    public static IApplicationBuilder UseBillzRequestGuard(
        this IApplicationBuilder app,
        IEnumerable<string> allowedOrigins
    )
    {
        var logger = app
            .ApplicationServices.GetRequiredService<ILoggerFactory>()
            .CreateLogger("Billz.RequestGuard");
        var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var configuredOrigin in allowedOrigins)
        {
            var normalized = NormalizeOrigin(configuredOrigin);
            if (normalized is null)
            {
                logger.LogWarning(
                    "Ignoring invalid allowed origin {Origin}",
                    configuredOrigin
                );
                continue;
            }

            allowed.Add(normalized);
        }

        logger.LogInformation(
            "Allowed request origins: {Origins}",
            allowed.Count == 0 ? "same-origin only" : string.Join(", ", allowed)
        );

        return app.Use(
            async (context, next) =>
            {
                if (!IsMutation(context.Request.Method))
                {
                    await next();
                    return;
                }

                if (context.Request.Headers.TransferEncoding.Count > 0)
                {
                    await WriteProblem(
                        context,
                        StatusCodes.Status411LengthRequired,
                        "Content-Length is required"
                    );
                    return;
                }

                if (context.Request.ContentLength is > ServerLimits.MaxRequestBodyBytes)
                {
                    await WriteProblem(
                        context,
                        StatusCodes.Status413PayloadTooLarge,
                        "Request body too large"
                    );
                    return;
                }

                var bodyMethod =
                    HttpMethods.IsPost(context.Request.Method)
                    || HttpMethods.IsPut(context.Request.Method)
                    || HttpMethods.IsPatch(context.Request.Method);

                if (bodyMethod && context.Request.Headers.ContentType.Count > 1)
                {
                    await WriteProblem(
                        context,
                        StatusCodes.Status415UnsupportedMediaType,
                        "Ambiguous Content-Type"
                    );
                    return;
                }

                if (bodyMethod && !IsJson(context.Request.ContentType))
                {
                    await WriteProblem(
                        context,
                        StatusCodes.Status415UnsupportedMediaType,
                        "JSON body required"
                    );
                    return;
                }

                var originValues = context.Request.Headers.Origin;
                if (originValues.Count > 1)
                {
                    await Reject(context, logger, "duplicate Origin header");
                    return;
                }

                var fetchSiteValues = context.Request.Headers["Sec-Fetch-Site"];
                if (
                    fetchSiteValues.Count > 1
                    || (
                        fetchSiteValues.Count == 1
                        && !AllowedFetchSiteValues.Contains(
                            fetchSiteValues[0]?.Trim(),
                            StringComparer.OrdinalIgnoreCase
                        )
                    )
                )
                {
                    await Reject(context, logger, "invalid Sec-Fetch-Site header");
                    return;
                }

                if (originValues.Count == 1 && !string.IsNullOrEmpty(originValues[0]))
                {
                    var origin = NormalizeOrigin(originValues[0]);
                    var requestOrigin = NormalizeOrigin(
                        $"{context.Request.Scheme}://{context.Request.Host.Value}"
                    );

                    if (
                        origin is null
                        || (
                            !string.Equals(origin, requestOrigin, StringComparison.OrdinalIgnoreCase)
                            && !allowed.Contains(origin)
                        )
                    )
                    {
                        await Reject(context, logger, "origin mismatch");
                        return;
                    }
                }

                await next();
            }
        );
    }

    private static bool IsMutation(string method) =>
        HttpMethods.IsPost(method)
        || HttpMethods.IsPut(method)
        || HttpMethods.IsPatch(method)
        || HttpMethods.IsDelete(method);

    private static bool IsJson(string? contentType)
    {
        if (string.IsNullOrEmpty(contentType) || contentType.Contains(','))
        {
            return false;
        }

        var mediaType = contentType.Split(';', 2)[0].Trim();

        return mediaType.Equals("application/json", StringComparison.OrdinalIgnoreCase)
            || mediaType.EndsWith("+json", StringComparison.OrdinalIgnoreCase);
    }

    private static string? NormalizeOrigin(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
        {
            return null;
        }

        if (
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            || uri.AbsolutePath != "/"
            || !string.IsNullOrEmpty(uri.Query)
            || !string.IsNullOrEmpty(uri.Fragment)
        )
        {
            return null;
        }

        return uri.GetLeftPart(UriPartial.Authority);
    }

    private static Task Reject(HttpContext context, ILogger logger, string reason)
    {
        logger.LogWarning(
            "Rejected {Method} {Path}: {Reason}; origin={Origin}; scheme={Scheme}; host={Host}",
            context.Request.Method,
            context.Request.Path.Value,
            reason,
            context.Request.Headers.Origin.ToString(),
            context.Request.Scheme,
            context.Request.Host.Value
        );

        return WriteProblem(
            context,
            StatusCodes.Status403Forbidden,
            "Cross-origin request rejected"
        );
    }

    private static async Task WriteProblem(HttpContext context, int statusCode, string title)
    {
        await Results.Problem(statusCode: statusCode, title: title).ExecuteAsync(context);
    }
}
