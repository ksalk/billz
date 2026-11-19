using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Billz.Tests;

public class HostFilteringTests : IClassFixture<BillzWebApplicationFactory>
{
    private readonly HttpClient _client;

    public HostFilteringTests(BillzWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task LoopbackHostIsAllowed()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/health");
        request.Headers.Host = "127.0.0.1";

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task UnknownHostIsRejected()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/health");
        request.Headers.Host = "rebind.attacker.example";

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
