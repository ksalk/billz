using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Billz.Api.Api.Bills;
using Billz.Api.Data;
using Microsoft.Extensions.DependencyInjection;

namespace Billz.Tests;

public class OccurrenceApiTests : IClassFixture<BillzWebApplicationFactory>
{
    private readonly BillzWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public OccurrenceApiTests(BillzWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task RangeExpandsSchedulesWithPendingStatus()
    {
        var bill = await CreateBillAsync("Calendar bill", "monthly", "2026-12-01");

        var occurrences = await GetOccurrencesAsync("2026-11-01", "2027-02-28");

        var forBill = occurrences.Where(item => item.BillId == bill.Id).ToList();
        Assert.Equal(
            ["2026-12-01", "2027-01-01", "2027-02-01"],
            forBill.Select(item => item.DueDate)
        );
        Assert.All(forBill, item => Assert.Equal("pending", item.Status));
        Assert.All(forBill, item => Assert.Equal(bill.Name, item.BillName));
        Assert.All(forBill, item => Assert.Equal(350_000, item.AmountMinor));
    }

    [Fact]
    public async Task RangeRespectsTheEndDateAndIsSorted()
    {
        var first = await CreateBillAsync("A end", "monthly", "2026-12-15", endDate: "2027-01-15");
        var second = await CreateBillAsync("B end", "monthly", "2026-12-10", endDate: "2026-12-10");

        var occurrences = await GetOccurrencesAsync("2026-12-01", "2027-02-28");
        var relevant = occurrences
            .Where(item => item.BillId == first.Id || item.BillId == second.Id)
            .ToList();

        Assert.Equal(
            ["2026-12-10", "2026-12-15", "2027-01-15"],
            relevant.Select(item => item.DueDate)
        );
        Assert.Equal(
            [second.Name, first.Name, first.Name],
            relevant.Select(item => item.BillName)
        );
    }

    [Fact]
    public async Task MarkPaidPersistsPaidFieldsAndAdvancesNextDue()
    {
        var bill = await CreateBillAsync("Paid bill", "monthly", "2026-12-01");

        var response = await SaveOccurrenceAsync(
            bill.Id,
            "2026-12-01",
            new { status = " paid ", paidOn = "2026-12-02", amountMinor = 340_000L }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var occurrence = await ReadOccurrenceAsync(response);
        Assert.Equal("paid", occurrence.Status);
        Assert.Equal("2026-12-02", occurrence.PaidOn);
        Assert.Equal(340_000, occurrence.AmountPaidMinor);

        var list = await GetOccurrencesAsync("2026-12-01", "2026-12-01");
        var stored = Assert.Single(list, item => item.BillId == bill.Id);
        Assert.Equal("paid", stored.Status);
        Assert.Equal(340_000, stored.AmountPaidMinor);

        var billResponse = await _client.GetAsync($"/api/bills/{bill.Id}");
        var updatedBill = await billResponse.Content.ReadFromJsonAsync<BillResponse>(
            BillJson.Options
        );
        Assert.NotNull(updatedBill);
        Assert.Equal("2027-01-01", updatedBill.NextDue);
    }

    [Fact]
    public async Task PaidAmountDefaultsToTheBillAmount()
    {
        var bill = await CreateBillAsync("Default amount", "monthly", "2026-12-01");

        var response = await SaveOccurrenceAsync(
            bill.Id,
            "2026-12-01",
            new { status = "paid", paidOn = "2026-12-01" }
        );

        var occurrence = await ReadOccurrenceAsync(response);
        Assert.Equal(350_000, occurrence.AmountPaidMinor);
    }

    [Fact]
    public async Task SkippedOccurrenceHasNoPaidFields()
    {
        var bill = await CreateBillAsync("Skipped bill", "monthly", "2026-12-01");

        var response = await SaveOccurrenceAsync(
            bill.Id,
            "2026-12-01",
            new { status = "skipped" }
        );

        var occurrence = await ReadOccurrenceAsync(response);
        Assert.Equal("skipped", occurrence.Status);
        Assert.Null(occurrence.PaidOn);
        Assert.Null(occurrence.AmountPaidMinor);

        var billResponse = await _client.GetAsync($"/api/bills/{bill.Id}");
        var updatedBill = await billResponse.Content.ReadFromJsonAsync<BillResponse>(
            BillJson.Options
        );
        Assert.NotNull(updatedBill);
        Assert.Equal("2027-01-01", updatedBill.NextDue);
    }

    [Fact]
    public async Task PaidToSkippedClearsPaidFields()
    {
        var bill = await CreateBillAsync("Paid to skipped", "monthly", "2026-12-01");

        await SaveOccurrenceAsync(
            bill.Id,
            "2026-12-01",
            new { status = "paid", paidOn = "2026-12-02", amountMinor = 340_000L }
        );
        var response = await SaveOccurrenceAsync(
            bill.Id,
            "2026-12-01",
            new { status = "skipped" }
        );

        var occurrence = await ReadOccurrenceAsync(response);
        Assert.Equal("skipped", occurrence.Status);
        Assert.Null(occurrence.PaidOn);
        Assert.Null(occurrence.AmountPaidMinor);
    }

    [Fact]
    public async Task SkippedOccurrenceRejectsPaidFields()
    {
        var bill = await CreateBillAsync("Skipped reject", "monthly", "2026-12-01");

        var response = await SaveOccurrenceAsync(
            bill.Id,
            "2026-12-01",
            new { status = "skipped", paidOn = "2026-12-01" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task MarkPaidRequiresPaidDate()
    {
        var bill = await CreateBillAsync("Paid without date", "monthly", "2026-12-01");

        var response = await SaveOccurrenceAsync(bill.Id, "2026-12-01", new { status = "paid" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task NonOccurrenceDateIsRejected()
    {
        var bill = await CreateBillAsync("Non occurrence", "monthly", "2026-12-01");

        var saveResponse = await SaveOccurrenceAsync(
            bill.Id,
            "2026-12-02",
            new { status = "paid", paidOn = "2026-12-02" }
        );
        Assert.Equal(HttpStatusCode.BadRequest, saveResponse.StatusCode);

        var resetResponse = await _client.DeleteAsync(
            $"/api/bills/{bill.Id}/occurrences/2026-12-02"
        );
        Assert.Equal(HttpStatusCode.BadRequest, resetResponse.StatusCode);
    }

    [Fact]
    public async Task RepeatedPaidSaveUpdatesTheSameOccurrence()
    {
        var bill = await CreateBillAsync("Repeat paid", "monthly", "2026-12-01");

        await SaveOccurrenceAsync(
            bill.Id,
            "2026-12-01",
            new { status = "paid", paidOn = "2026-12-02", amountMinor = 340_000L }
        );
        await SaveOccurrenceAsync(
            bill.Id,
            "2026-12-01",
            new { status = "paid", paidOn = "2026-12-03", amountMinor = 330_000L }
        );

        var occurrences = await GetOccurrencesAsync("2026-12-01", "2026-12-01");
        var stored = Assert.Single(occurrences, item => item.BillId == bill.Id);
        Assert.Equal("2026-12-03", stored.PaidOn);
        Assert.Equal(330_000, stored.AmountPaidMinor);
    }

    [Fact]
    public async Task ResetReturnsOccurrenceToPending()
    {
        var bill = await CreateBillAsync("Reset bill", "monthly", "2026-12-01");

        await SaveOccurrenceAsync(
            bill.Id,
            "2026-12-01",
            new { status = "paid", paidOn = "2026-12-01" }
        );

        var reset = await _client.DeleteAsync($"/api/bills/{bill.Id}/occurrences/2026-12-01");
        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);

        var occurrences = await GetOccurrencesAsync("2026-12-01", "2026-12-01");
        var stored = Assert.Single(occurrences, item => item.BillId == bill.Id);
        Assert.Equal("pending", stored.Status);
        Assert.Null(stored.PaidOn);

        var secondReset = await _client.DeleteAsync(
            $"/api/bills/{bill.Id}/occurrences/2026-12-01"
        );
        Assert.Equal(HttpStatusCode.NoContent, secondReset.StatusCode);

        var billResponse = await _client.GetAsync($"/api/bills/{bill.Id}");
        var resetBill = await billResponse.Content.ReadFromJsonAsync<BillResponse>(
            BillJson.Options
        );
        Assert.NotNull(resetBill);
        Assert.Equal("2026-12-01", resetBill.NextDue);
    }

    [Fact]
    public async Task OrphanedOccurrenceCanBeReset()
    {
        var bill = await CreateBillAsync("Orphan reset", "monthly", "2026-12-01");

        await SaveOccurrenceAsync(
            bill.Id,
            "2026-12-01",
            new { status = "paid", paidOn = "2026-12-02" }
        );

        var update = new
        {
            name = bill.Name,
            amountMinor = 350_000L,
            frequency = "monthly",
            interval = 1,
            startDate = "2027-01-01",
            endDate = (string?)null,
            category = "Test",
            notes = (string?)null,
        };
        var updateResponse = await _client.PutAsync(
            $"/api/bills/{bill.Id}",
            JsonContent.Create(update, options: BillJson.Options)
        );
        updateResponse.EnsureSuccessStatusCode();

        var reset = await _client.DeleteAsync(
            $"/api/bills/{bill.Id}/occurrences/2026-12-01"
        );
        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);

        var occurrences = await GetOccurrencesAsync("2026-12-01", "2026-12-31");
        Assert.DoesNotContain(occurrences, item => item.BillId == bill.Id);

        var billResponse = await _client.GetAsync($"/api/bills/{bill.Id}");
        var updatedBill = await billResponse.Content.ReadFromJsonAsync<BillResponse>(
            BillJson.Options
        );
        Assert.NotNull(updatedBill);
        Assert.Equal("2027-01-01", updatedBill.NextDue);
    }

    [Fact]
    public async Task SkippedOccurrenceCanBeReset()
    {
        var bill = await CreateBillAsync("Skipped reset", "monthly", "2026-12-01");

        await SaveOccurrenceAsync(bill.Id, "2026-12-01", new { status = "skipped" });

        var reset = await _client.DeleteAsync(
            $"/api/bills/{bill.Id}/occurrences/2026-12-01"
        );
        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);

        var occurrences = await GetOccurrencesAsync("2026-12-01", "2026-12-01");
        var stored = Assert.Single(occurrences, item => item.BillId == bill.Id);
        Assert.Equal("pending", stored.Status);
    }

    [Fact]
    public async Task MissingBillIsRejected()
    {
        var response = await SaveOccurrenceAsync(
            999999,
            "2026-12-01",
            new { status = "paid", paidOn = "2026-12-01" }
        );

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var deleteResponse = await _client.DeleteAsync(
            "/api/bills/999999/occurrences/2026-12-01"
        );
        Assert.Equal(HttpStatusCode.NotFound, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task InvalidStatusAndAmountAreRejected()
    {
        var bill = await CreateBillAsync("Invalid paid", "monthly", "2026-12-01");

        var badStatus = await SaveOccurrenceAsync(
            bill.Id,
            "2026-12-01",
            new { status = "maybe" }
        );
        Assert.Equal(HttpStatusCode.BadRequest, badStatus.StatusCode);

        var badAmount = await SaveOccurrenceAsync(
            bill.Id,
            "2026-12-01",
            new { status = "paid", paidOn = "2026-12-01", amountMinor = -1L }
        );
        Assert.Equal(HttpStatusCode.BadRequest, badAmount.StatusCode);
    }

    [Theory]
    [InlineData("2026-01-01", "2027-01-02")]
    [InlineData("2026-12-31", "2026-12-01")]
    [InlineData("1899-12-31", "1900-01-31")]
    [InlineData("2101-01-01", "2101-01-31")]
    public async Task InvalidRangeIsRejected(string from, string to)
    {
        var response = await _client.GetAsync($"/api/occurrences?from={from}&to={to}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task FullLeapYearRangeIsAccepted()
    {
        var response = await _client.GetAsync("/api/occurrences?from=2024-01-01&to=2024-12-31");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task MissingRangeIsRejected()
    {
        var response = await _client.GetAsync("/api/occurrences");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CrossOriginOccurrenceMutationIsRejected()
    {
        var bill = await CreateBillAsync("Guard paid", "monthly", "2026-12-01");

        using var request = new HttpRequestMessage(
            HttpMethod.Put,
            $"/api/bills/{bill.Id}/occurrences/2026-12-01"
        )
        {
            Content = JsonContent.Create(
                new { status = "paid", paidOn = "2026-12-01" },
                options: BillJson.Options
            ),
        };
        request.Headers.TryAddWithoutValidation("Origin", "https://evil.example");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DatabaseConstraintRejectsInvalidPaidState()
    {
        var bill = await CreateBillAsync("Constraint paid", "monthly", "2026-12-01");

        await using var scope = _factory.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<BillzDbContext>();
        var now = DateTimeOffset.UtcNow;
        database.BillOccurrences.Add(
            new BillOccurrence
            {
                BillId = bill.Id,
                DueDate = new DateOnly(2026, 12, 1),
                Status = BillOccurrenceStatus.Paid,
                CreatedAt = now,
                UpdatedAt = now,
            }
        );

        await Assert.ThrowsAsync<Microsoft.EntityFrameworkCore.DbUpdateException>(
            () => database.SaveChangesAsync()
        );
    }

    private async Task<BillResponse> CreateBillAsync(
        string name,
        string frequency,
        string startDate,
        string? endDate = null
    )
    {
        var payload = new
        {
            name = $"{name} {Guid.NewGuid():N}",
            amountMinor = 350_000L,
            frequency,
            interval = 1,
            startDate,
            endDate,
            category = "Test",
            notes = (string?)null,
        };

        var response = await _client.PostAsync(
            "/api/bills",
            JsonContent.Create(payload, options: BillJson.Options)
        );
        response.EnsureSuccessStatusCode();

        var bill = await response.Content.ReadFromJsonAsync<BillResponse>(BillJson.Options);
        Assert.NotNull(bill);
        return bill;
    }

    private async Task<List<OccurrenceResponse>> GetOccurrencesAsync(string from, string to)
    {
        var response = await _client.GetAsync($"/api/occurrences?from={from}&to={to}");
        response.EnsureSuccessStatusCode();

        var occurrences = await response.Content.ReadFromJsonAsync<List<OccurrenceResponse>>(
            BillJson.Options
        );
        Assert.NotNull(occurrences);
        return occurrences;
    }

    private async Task<HttpResponseMessage> SaveOccurrenceAsync(
        int billId,
        string dueDate,
        object payload
    ) =>
        await _client.PutAsync(
            $"/api/bills/{billId}/occurrences/{dueDate}",
            JsonContent.Create(payload, options: BillJson.Options)
        );

    private static async Task<OccurrenceResponse> ReadOccurrenceAsync(
        HttpResponseMessage response
    )
    {
        response.EnsureSuccessStatusCode();
        var occurrence = await response.Content.ReadFromJsonAsync<OccurrenceResponse>(
            BillJson.Options
        );
        Assert.NotNull(occurrence);
        return occurrence;
    }

    private sealed record BillResponse(int Id, string Name, string? NextDue);

    private sealed record OccurrenceResponse(
        int BillId,
        string BillName,
        long AmountMinor,
        string DueDate,
        string Status,
        string? PaidOn,
        long? AmountPaidMinor,
        string? Category
    );
}
