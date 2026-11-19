using Billz.Api.Api.Bills;
using Billz.Api.Data;

namespace Billz.Tests;

public class BillNextDueTests
{
    [Fact]
    public void FindsTheFirstGapAfterMoreThanTenThousandHandledOccurrences()
    {
        var start = new DateOnly(1900, 1, 1);
        var bill = new Bill
        {
            Name = "Weekly",
            AmountMinor = 100,
            Frequency = BillFrequency.Weekly,
            Interval = 1,
            StartDate = start,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        var handled = Enumerable
            .Range(0, 10_001)
            .Select(index => start.AddDays(index * 7))
            .ToHashSet();

        var next = BillNextDue.Compute(bill, handled);

        Assert.Equal(start.AddDays(10_001 * 7), next);
    }
}
