using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Billz.Tests;

public class SecurityTests : IClassFixture<BillzWebApplicationFactory>
{
    private readonly BillzWebApplicationFactory _clientFactory;
    private readonly HttpClient _client;

    public SecurityTests(BillzWebApplicationFactory factory)
    {
        _clientFactory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task SecurityHeadersArePresent()
    {
        var response = await _client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("default-src 'self'", GetHeader(response, "Content-Security-Policy"));
        Assert.Contains("frame-ancestors 'none'", GetHeader(response, "Content-Security-Policy"));
        Assert.Equal("nosniff", GetHeader(response, "X-Content-Type-Options"));
        Assert.Equal("no-referrer", GetHeader(response, "Referrer-Policy"));
        Assert.Equal("DENY", GetHeader(response, "X-Frame-Options"));
        Assert.Contains("camera=()", GetHeader(response, "Permissions-Policy"));
        Assert.Equal("same-origin", GetHeader(response, "Cross-Origin-Opener-Policy"));
        Assert.Equal("same-origin", GetHeader(response, "Cross-Origin-Resource-Policy"));
        Assert.False(response.Headers.Contains("Strict-Transport-Security"));
    }

    [Fact]
    public async Task HstsIsOnlySentOverHttps()
    {
        var client = _clientFactory.CreateClient(
            new WebApplicationFactoryClientOptions
            {
                BaseAddress = new Uri("https://localhost"),
            }
        );

        var response = await client.GetAsync("/api/health");

        Assert.Equal("max-age=31536000", GetHeader(response, "Strict-Transport-Security"));
    }

    private static string GetHeader(HttpResponseMessage response, string name)
    {
        Assert.True(
            response.Headers.TryGetValues(name, out var values),
            $"Expected header {name}"
        );
        return string.Join(",", values);
    }
}
