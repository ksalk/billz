using System.Net;
using System.Text;
using Billz.Api.Infrastructure;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Billz.Tests;

public class RequestGuardTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public RequestGuardTests(WebApplicationFactory<Program> factory)
    {
        // WebApplicationFactory defaults to the Development environment, which is
        // where the Vite origin allowlist comes from.
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task SameOriginMutationPassesGuard()
    {
        using var request = JsonMutation(HttpMethod.Post, "/api/missing", "http://localhost");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DevelopmentOriginPassesGuard()
    {
        using var request = JsonMutation(
            HttpMethod.Post,
            "/api/missing",
            "http://localhost:5173"
        );

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task RequestWithoutBrowserHeadersPassesGuard()
    {
        using var request = JsonMutation(HttpMethod.Post, "/api/missing", origin: null);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("HTTP://LOCALHOST:5173")]
    [InlineData("http://localhost:80")]
    public async Task EquivalentOriginsPassGuard(string origin)
    {
        using var request = JsonMutation(HttpMethod.Post, "/api/missing", origin);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("https://evil.example")]
    [InlineData("http://localhost.evil.example")]
    [InlineData("http://localhost:5173.evil.example")]
    [InlineData("http://localhost/path")]
    [InlineData("null")]
    public async Task CrossOriginMutationIsRejected(string origin)
    {
        using var request = JsonMutation(HttpMethod.Post, "/api/missing", origin);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.True(response.Headers.Contains("Content-Security-Policy"));
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("no-cache", response.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task DuplicateOriginIsRejected()
    {
        using var request = JsonMutation(HttpMethod.Post, "/api/missing", origin: null);
        request.Headers.TryAddWithoutValidation(
            "Origin",
            ["http://localhost", "https://evil.example"]
        );

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CrossSiteFetchMetadataIsRejected()
    {
        using var request = JsonMutation(HttpMethod.Post, "/api/missing", origin: null);
        request.Headers.TryAddWithoutValidation("Sec-Fetch-Site", "cross-site");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData("cross-site")]
    [InlineData("same-site, cross-site")]
    [InlineData("CROSS-SITE")]
    [InlineData("same-site,cross-site")]
    public async Task InvalidFetchMetadataIsRejected(string value)
    {
        using var request = JsonMutation(HttpMethod.Post, "/api/missing", origin: null);
        request.Headers.TryAddWithoutValidation("Sec-Fetch-Site", value);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DuplicateFetchMetadataIsRejected()
    {
        using var request = JsonMutation(HttpMethod.Post, "/api/missing", origin: null);
        request.Headers.TryAddWithoutValidation(
            "Sec-Fetch-Site",
            ["same-site", "cross-site"]
        );

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task SameSiteFetchMetadataPassesGuard()
    {
        using var request = JsonMutation(HttpMethod.Post, "/api/missing", origin: null);
        request.Headers.TryAddWithoutValidation("Sec-Fetch-Site", "same-site");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task NonJsonMutationIsRejected()
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/missing")
        {
            Content = new StringContent("{}", Encoding.UTF8, "text/plain"),
        };

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
    }

    [Fact]
    public async Task OversizedMutationIsRejected()
    {
        using var request = JsonMutation(
            HttpMethod.Post,
            "/api/missing",
            "http://localhost",
            body: new string('x', 70 * 1024)
        );

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
    }

    [Fact]
    public async Task ChunkedMutationIsRejected()
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/missing")
        {
            Content = new StringContent("{}", Encoding.UTF8, "application/json"),
        };
        request.Headers.TransferEncodingChunked = true;

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.LengthRequired, response.StatusCode);
    }

    [Theory]
    [InlineData(ServerLimits.MaxRequestBodyBytes, HttpStatusCode.NotFound)]
    [InlineData(ServerLimits.MaxRequestBodyBytes + 1, HttpStatusCode.RequestEntityTooLarge)]
    public async Task BodyLimitBoundaryIsEnforced(long length, HttpStatusCode expected)
    {
        using var request = JsonMutation(
            HttpMethod.Post,
            "/api/missing",
            "http://localhost",
            body: new string('x', (int)length)
        );

        var response = await _client.SendAsync(request);

        Assert.Equal(expected, response.StatusCode);
    }

    [Fact]
    public async Task CrossOriginDeleteIsRejected()
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, "/api/missing");
        request.Headers.TryAddWithoutValidation("Origin", "https://evil.example");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DeleteWithoutBodyPassesGuard()
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, "/api/missing");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CrossOriginReadIsNotGuarded()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/missing");
        request.Headers.TryAddWithoutValidation("Origin", "https://evil.example");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static HttpRequestMessage JsonMutation(
        HttpMethod method,
        string path,
        string? origin,
        string body = "{}"
    )
    {
        var request = new HttpRequestMessage(method, path)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };

        if (origin is not null)
        {
            request.Headers.TryAddWithoutValidation("Origin", origin);
        }

        return request;
    }
}
