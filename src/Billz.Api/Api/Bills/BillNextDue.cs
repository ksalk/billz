using Billz.Api.Data;
using Billz.Api.Domain;

namespace Billz.Api.Api.Bills;

public static class BillNextDue
{
    public static DateOnly? Compute(Bill bill, IReadOnlySet<DateOnly> handled)
    {
        var candidate = bill.StartDate;
        var maxIterations = handled.Count + 1;

        for (var index = 0; index < maxIterations; index++)
        {
            if (!handled.Contains(candidate))
            {
                return candidate;
            }

            if (candidate == DateOnly.MaxValue)
            {
                return null;
            }

            var next = ScheduleCalculator.NextOccurrenceOnOrAfter(
                bill.Frequency,
                bill.Interval,
                bill.StartDate,
                bill.EndDate,
                candidate.AddDays(1)
            );

            if (next is null)
            {
                return null;
            }

            candidate = next.Value;
        }

        return null;
    }
}
