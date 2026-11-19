namespace Billz.Api.Data;

public enum BillFrequency
{
    Once,
    Weekly,
    Monthly,
    Yearly,
}

public enum BillOccurrenceStatus
{
    Paid,
    Skipped,
}

public sealed class Bill
{
    public int Id { get; set; }

    public required string Name { get; set; }

    public long AmountMinor { get; set; }

    public BillFrequency Frequency { get; set; }

    public int Interval { get; set; } = 1;

    public DateOnly StartDate { get; set; }

    public DateOnly? EndDate { get; set; }

    public string? Category { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<BillOccurrence> Occurrences { get; } = new List<BillOccurrence>();
}

public sealed class BillOccurrence
{
    public int BillId { get; set; }

    public Bill Bill { get; set; } = null!;

    public DateOnly DueDate { get; set; }

    public BillOccurrenceStatus Status { get; set; }

    public DateOnly? PaidOn { get; set; }

    public long? AmountPaidMinor { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
