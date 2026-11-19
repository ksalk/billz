using System.Text.Json;
using System.Text.Json.Serialization;
using Billz.Api.Data;

namespace Billz.Api.Api.Bills;

public sealed record SaveBillRequest(
    string? Name,
    long? AmountMinor,
    string? Frequency,
    int? Interval,
    DateOnly? StartDate,
    DateOnly? EndDate,
    string? Category,
    string? Notes
);

public sealed record BillDto(
    int Id,
    string Name,
    long AmountMinor,
    BillFrequency Frequency,
    int Interval,
    DateOnly StartDate,
    DateOnly? EndDate,
    string? Category,
    string? Notes,
    DateOnly? NextDue,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
)
{
    public static BillDto From(Bill bill, DateOnly? nextDue) =>
        new(
            bill.Id,
            bill.Name,
            bill.AmountMinor,
            bill.Frequency,
            bill.Interval,
            bill.StartDate,
            bill.EndDate,
            bill.Category,
            bill.Notes,
            nextDue,
            bill.CreatedAt,
            bill.UpdatedAt
        );
}

public static class BillJson
{
    public static readonly JsonSerializerOptions Options = CreateOptions();

    public static void Configure(JsonSerializerOptions options)
    {
        options.Converters.Add(
            new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false)
        );
    }

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        Configure(options);
        return options;
    }
}
