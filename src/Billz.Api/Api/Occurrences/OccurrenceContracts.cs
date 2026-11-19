using Billz.Api.Data;

namespace Billz.Api.Api.Occurrences;

public sealed record SaveOccurrenceRequest(
    string? Status,
    DateOnly? PaidOn,
    long? AmountMinor
);

public enum OccurrenceDisplayStatus
{
    Pending,
    Paid,
    Skipped,
}

public sealed record OccurrenceDto(
    int BillId,
    string BillName,
    long AmountMinor,
    DateOnly DueDate,
    OccurrenceDisplayStatus Status,
    DateOnly? PaidOn,
    long? AmountPaidMinor,
    string? Category
)
{
    public static OccurrenceDto From(Bill bill, DateOnly dueDate, BillOccurrence? occurrence)
    {
        var status = occurrence?.Status switch
        {
            BillOccurrenceStatus.Paid => OccurrenceDisplayStatus.Paid,
            BillOccurrenceStatus.Skipped => OccurrenceDisplayStatus.Skipped,
            _ => OccurrenceDisplayStatus.Pending,
        };

        return new OccurrenceDto(
            bill.Id,
            bill.Name,
            bill.AmountMinor,
            dueDate,
            status,
            occurrence?.PaidOn,
            occurrence?.AmountPaidMinor,
            bill.Category
        );
    }
}
