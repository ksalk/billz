using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Billz.Api.Api.Bills;
using Billz.Api.Data;
using Microsoft.Extensions.DependencyInjection;

namespace Billz.Tests;

public class BillApiTests : IClassFixture<BillzWebApplicationFactory>
{
    private readonly BillzWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public BillApiTests(BillzWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task BillLifecycleWorksEndToEnd()
    {
        var name = $"Rent {Guid.NewGuid():N}";
        var payload = ValidPayload();
        payload["name"] = name;

        var createResponse = await PostBillAsync(payload);
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await ReadBillAsync(createResponse);
        Assert.Equal(name, created.Name);
        Assert.Equal(350_000, created.AmountMinor);
        Assert.Equal("monthly", created.Frequency);
        Assert.Equal("2026-12-01", created.StartDate);
        Assert.Equal("2026-12-01", created.NextDue);
        Assert.Equal("Home", created.Category);
        Assert.Equal($"/api/bills/{created.Id}", createResponse.Headers.Location?.ToString());

        var getResponse = await _client.GetAsync($"/api/bills/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        Assert.Equal(name, (await ReadBillAsync(getResponse)).Name);

        var list = await _client.GetFromJsonAsync<List<BillResponse>>(
            "/api/bills",
            BillJson.Options
        );
        Assert.NotNull(list);
        Assert.Contains(list, item => item.Id == created.Id);

        payload["name"] = $"{name} updated";
        payload["amountMinor"] = 400_000L;
        payload["startDate"] = "2027-01-15";

        var updateResponse = await _client.PutAsync(
            $"/api/bills/{created.Id}",
            JsonContent.Create(payload, options: BillJson.Options)
        );
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var updated = await ReadBillAsync(updateResponse);
        Assert.Equal($"{name} updated", updated.Name);
        Assert.Equal(400_000, updated.AmountMinor);
        Assert.Equal("2027-01-15", updated.StartDate);
        Assert.Equal("2027-01-15", updated.NextDue);

        var deleteResponse = await _client.DeleteAsync($"/api/bills/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var missingResponse = await _client.GetAsync($"/api/bills/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, missingResponse.StatusCode);

        var secondDelete = await _client.DeleteAsync($"/api/bills/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, secondDelete.StatusCode);
    }

    [Fact]
    public async Task CreateTrimsOptionalFields()
    {
        var payload = ValidPayload();
        payload["name"] = "  Netflix  ";
        payload["category"] = "  Streaming  ";
        payload["notes"] = "   ";

        var response = await PostBillAsync(payload);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var bill = await ReadBillAsync(response);
        Assert.Equal("Netflix", bill.Name);
        Assert.Equal("Streaming", bill.Category);
        Assert.Null(bill.Notes);
    }

    [Theory]
    [MemberData(nameof(InvalidPayloads))]
    public async Task InvalidPayloadIsRejectedWithFieldError(string field, object? value)
    {
        var payload = ValidPayload();
        payload[field] = value;

        var response = await PostBillAsync(payload);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(
            document.RootElement.GetProperty("errors").TryGetProperty(field, out _),
            $"Expected a validation error for '{field}'."
        );
    }

    public static TheoryData<string, object?> InvalidPayloads =>
        new()
        {
            { "name", "" },
            { "name", "   " },
            { "name", new string('x', 121) },
            { "amountMinor", -1L },
            { "amountMinor", 10_000_000_000L },
            { "frequency", null },
            { "interval", 0 },
            { "interval", 61 },
            { "startDate", null },
            { "startDate", "1899-12-31" },
            { "endDate", "2026-11-30" },
            { "endDate", "2101-01-01" },
            { "category", new string('x', 41) },
            { "notes", new string('x', 2001) },
        };

    [Fact]
    public async Task MissingAmountIsRejected()
    {
        var payload = ValidPayload();
        payload.Remove("amountMinor");

        var response = await PostBillAsync(payload);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(
            document.RootElement.GetProperty("errors").TryGetProperty("amountMinor", out _)
        );
    }

    [Theory]
    [InlineData("hourly")]
    [InlineData("3")]
    [InlineData("monthly,weekly")]
    [InlineData("")]
    public async Task InvalidFrequencyValueIsRejected(string frequency)
    {
        var payload = ValidPayload();
        payload["frequency"] = frequency;

        var response = await PostBillAsync(payload);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(
            document.RootElement.GetProperty("errors").TryGetProperty("frequency", out _)
        );
    }

    [Fact]
    public async Task NumericFrequencyIsRejectedDuringBinding()
    {
        var payload = ValidPayload();
        payload["frequency"] = 3;

        var response = await PostBillAsync(payload);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task MalformedJsonIsRejected()
    {
        using var content = new StringContent("{", Encoding.UTF8, "application/json");
        var response = await _client.PostAsync("/api/bills", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task ListSortsByNextDueThenName()
    {
        var later = ValidPayload();
        later["name"] = $"Later {Guid.NewGuid():N}";
        later["startDate"] = "2026-12-20";
        var first = await ReadBillAsync(await PostBillAsync(later));

        var earlier = ValidPayload();
        earlier["name"] = $"Earlier {Guid.NewGuid():N}";
        earlier["startDate"] = "2026-12-10";
        var second = await ReadBillAsync(await PostBillAsync(earlier));

        var tiedB = ValidPayload();
        tiedB["name"] = $"B tied {Guid.NewGuid():N}";
        tiedB["startDate"] = "2026-12-15";
        var tiedSecond = await ReadBillAsync(await PostBillAsync(tiedB));

        var tiedA = ValidPayload();
        tiedA["name"] = $"A tied {Guid.NewGuid():N}";
        tiedA["startDate"] = "2026-12-15";
        var tiedFirst = await ReadBillAsync(await PostBillAsync(tiedA));

        var list = await _client.GetFromJsonAsync<List<BillResponse>>(
            "/api/bills",
            BillJson.Options
        );
        Assert.NotNull(list);

        var firstIndex = list.FindIndex(item => item.Id == first.Id);
        var secondIndex = list.FindIndex(item => item.Id == second.Id);
        Assert.True(secondIndex < firstIndex);

        var tiedAIndex = list.FindIndex(item => item.Id == tiedFirst.Id);
        var tiedBIndex = list.FindIndex(item => item.Id == tiedSecond.Id);
        Assert.True(tiedAIndex < tiedBIndex);
    }

    [Fact]
    public async Task NextDueAdvancesPastPaidOccurrences()
    {
        var payload = ValidPayload();
        payload["name"] = $"Monthly {Guid.NewGuid():N}";
        var bill = await ReadBillAsync(await PostBillAsync(payload));

        await SeedPaidOccurrenceAsync(bill.Id, new DateOnly(2026, 12, 1));

        var response = await _client.GetAsync($"/api/bills/{bill.Id}");
        var updated = await ReadBillAsync(response);
        Assert.Equal("2027-01-01", updated.NextDue);
    }

    [Fact]
    public async Task NextDueAdvancesPastSkippedOccurrences()
    {
        var payload = ValidPayload();
        payload["name"] = $"Skipped {Guid.NewGuid():N}";
        var bill = await ReadBillAsync(await PostBillAsync(payload));

        await SeedOccurrenceAsync(bill.Id, new DateOnly(2026, 12, 1), BillOccurrenceStatus.Skipped);

        var response = await _client.GetAsync($"/api/bills/{bill.Id}");
        var updated = await ReadBillAsync(response);
        Assert.Equal("2027-01-01", updated.NextDue);
    }

    [Fact]
    public async Task NextDueIsNullWhenTheSeriesHasEnded()
    {
        var payload = ValidPayload();
        payload["name"] = $"Once {Guid.NewGuid():N}";
        payload["frequency"] = "once";
        payload["startDate"] = "2026-12-01";
        payload["endDate"] = "2026-12-01";
        var bill = await ReadBillAsync(await PostBillAsync(payload));

        await SeedPaidOccurrenceAsync(bill.Id, new DateOnly(2026, 12, 1));

        var response = await _client.GetAsync($"/api/bills/{bill.Id}");
        var updated = await ReadBillAsync(response);
        Assert.Null(updated.NextDue);
    }

    [Fact]
    public async Task UpdateValidatesThePayload()
    {
        var payload = ValidPayload();
        payload["name"] = $"Update validation {Guid.NewGuid():N}";
        var bill = await ReadBillAsync(await PostBillAsync(payload));

        var invalid = ValidPayload();
        invalid["name"] = "";
        var response = await _client.PutAsync(
            $"/api/bills/{bill.Id}",
            JsonContent.Create(invalid, options: BillJson.Options)
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(document.RootElement.GetProperty("errors").TryGetProperty("name", out _));
    }

    [Fact]
    public async Task MissingBillReturnsNotFoundForReadsAndWrites()
    {
        var getResponse = await _client.GetAsync("/api/bills/999999");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);

        var putResponse = await _client.PutAsync(
            "/api/bills/999999",
            JsonContent.Create(ValidPayload(), options: BillJson.Options)
        );
        Assert.Equal(HttpStatusCode.NotFound, putResponse.StatusCode);
    }

    [Fact]
    public async Task CrossOriginCreateIsRejectedBeforeValidation()
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/bills")
        {
            Content = JsonContent.Create(ValidPayload(), options: BillJson.Options),
        };
        request.Headers.TryAddWithoutValidation("Origin", "https://evil.example");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    private async Task<HttpResponseMessage> PostBillAsync(Dictionary<string, object?> payload)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/bills")
        {
            Content = JsonContent.Create(payload, options: BillJson.Options),
        };

        return await _client.SendAsync(request);
    }

    private static async Task<BillResponse> ReadBillAsync(HttpResponseMessage response)
    {
        var bill = await response.Content.ReadFromJsonAsync<BillResponse>(BillJson.Options);
        Assert.NotNull(bill);
        return bill;
    }

    private async Task SeedPaidOccurrenceAsync(int billId, DateOnly dueDate) =>
        await SeedOccurrenceAsync(billId, dueDate, BillOccurrenceStatus.Paid);

    private async Task SeedOccurrenceAsync(
        int billId,
        DateOnly dueDate,
        BillOccurrenceStatus status
    )
    {
        var now = DateTimeOffset.UtcNow;
        var paid = status == BillOccurrenceStatus.Paid;

        await using var scope = _factory.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<BillzDbContext>();
        database.BillOccurrences.Add(
            new BillOccurrence
            {
                BillId = billId,
                DueDate = dueDate,
                Status = status,
                PaidOn = paid ? dueDate : null,
                AmountPaidMinor = paid ? 350_000 : null,
                CreatedAt = now,
                UpdatedAt = now,
            }
        );
        await database.SaveChangesAsync();
    }

    private static Dictionary<string, object?> ValidPayload() =>
        new()
        {
            ["name"] = "Rent",
            ["amountMinor"] = 350_000L,
            ["frequency"] = "monthly",
            ["interval"] = 1,
            ["startDate"] = "2026-12-01",
            ["endDate"] = null,
            ["category"] = "Home",
            ["notes"] = null,
        };

    private sealed record BillResponse(
        int Id,
        string Name,
        long AmountMinor,
        string Frequency,
        int Interval,
        string StartDate,
        string? EndDate,
        string? Category,
        string? Notes,
        string? NextDue,
        string CreatedAt,
        string UpdatedAt
    );
}
