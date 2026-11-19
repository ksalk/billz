using System.Net;
using System.Net.Http.Json;

namespace Billz.Tests;

public class HealthTests : IClassFixture<BillzWebApplicationFactory>
{
    private readonly HttpClient _client;

    public HealthTests(BillzWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task HealthEndpointReturnsOk()
    {
        var response = await _client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<HealthResponse>();
        Assert.NotNull(body);
        Assert.Equal("ok", body.Status);
    }

    [Fact]
    public async Task HealthEndpointAnswersHead()
    {
        var request = new HttpRequestMessage(HttpMethod.Head, "/api/health");
        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private sealed record HealthResponse(string Status);
}
