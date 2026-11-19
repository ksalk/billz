using Billz.Api.Data;

namespace Billz.Api.Api.Bills;

public static class BillValidation
{
    public const long MaxAmountMinor = 9_999_999_999;

    private static readonly DateOnly MinDate = new(1900, 1, 1);
    private static readonly DateOnly MaxDate = new(2100, 12, 31);
    private static readonly Dictionary<string, BillFrequency> FrequencyNames =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["once"] = BillFrequency.Once,
            ["weekly"] = BillFrequency.Weekly,
            ["monthly"] = BillFrequency.Monthly,
            ["yearly"] = BillFrequency.Yearly,
        };

    public static bool TryParseFrequency(string? value, out BillFrequency frequency)
    {
        frequency = default;

        return value is not null
            && FrequencyNames.TryGetValue(value.Trim(), out frequency);
    }

    public static Dictionary<string, string[]> Validate(SaveBillRequest request)
    {
        var errors = new Dictionary<string, List<string>>();

        void Add(string field, string message)
        {
            if (!errors.TryGetValue(field, out var messages))
            {
                messages = [];
                errors[field] = messages;
            }

            messages.Add(message);
        }

        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            Add("name", "Name is required.");
        }
        else if (name.Length > 120)
        {
            Add("name", "Name must be 120 characters or fewer.");
        }

        if (request.AmountMinor is null)
        {
            Add("amountMinor", "Amount is required.");
        }
        else if (request.AmountMinor is < 0 or > MaxAmountMinor)
        {
            Add("amountMinor", "Amount is outside the supported range.");
        }

        if (!TryParseFrequency(request.Frequency, out _))
        {
            Add("frequency", "Frequency must be once, weekly, monthly or yearly.");
        }

        if (request.Interval is null or < 1 or > 60)
        {
            Add("interval", "Interval must be between 1 and 60.");
        }

        if (request.StartDate is null)
        {
            Add("startDate", "Start date is required.");
        }
        else if (request.StartDate < MinDate || request.StartDate > MaxDate)
        {
            Add("startDate", "Start date must be between 1900-01-01 and 2100-12-31.");
        }

        if (request.EndDate is not null)
        {
            if (request.EndDate < MinDate || request.EndDate > MaxDate)
            {
                Add("endDate", "End date must be between 1900-01-01 and 2100-12-31.");
            }

            if (request.StartDate is not null && request.EndDate < request.StartDate)
            {
                Add("endDate", "End date must not be before the start date.");
            }
        }

        if (request.Category?.Trim().Length > 40)
        {
            Add("category", "Category must be 40 characters or fewer.");
        }

        if (request.Notes?.Trim().Length > 2000)
        {
            Add("notes", "Notes must be 2000 characters or fewer.");
        }

        return errors.ToDictionary(
            entry => entry.Key,
            entry => entry.Value.ToArray(),
            StringComparer.Ordinal
        );
    }
}
