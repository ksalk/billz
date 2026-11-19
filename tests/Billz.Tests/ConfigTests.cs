using System.Net.Http.Json;

namespace Billz.Tests;

public class ConfigTests : IClassFixture<BillzWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ConfigTests(BillzWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task ConfigReturnsTheCurrency()
    {
        var response = await _client.GetAsync("/api/config");

        response.EnsureSuccessStatusCode();
        var config = await response.Content.ReadFromJsonAsync<ConfigResponse>();
        Assert.NotNull(config);
        Assert.Equal("PLN", config.Currency);
    }

    private sealed record ConfigResponse(string Currency);
}
