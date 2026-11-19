using Billz.Api.Data;

namespace Billz.Api.Domain;

public static class ScheduleCalculator
{
    public const int MaxOccurrences = 10_000;

    /// <summary>
    /// Expands a schedule into due dates inside an inclusive range.
    /// The recurrence is anchored to <paramref name="startDate"/>: the calendar
    /// day-of-month (or weekday) always comes from the start date, and impossible
    /// days are clamped to the month length without moving the anchor.
    /// </summary>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The frequency is undefined or the interval is outside 1..60.
    /// </exception>
    /// <exception cref="ArgumentException">
    /// The range is inverted or the end date precedes the start date.
    /// </exception>
    /// <exception cref="InvalidOperationException">
    /// The range would produce more than <see cref="MaxOccurrences"/> dates.
    /// </exception>
    public static IReadOnlyList<DateOnly> Occurrences(
        BillFrequency frequency,
        int interval,
        DateOnly startDate,
        DateOnly? endDate,
        DateOnly from,
        DateOnly to
    )
    {
        Validate(frequency, interval, startDate, endDate, from, to);

        var results = new List<DateOnly>();
        var lastDate = endDate is not null && endDate < to ? endDate.Value : to;

        if (startDate > lastDate)
        {
            return results;
        }

        if (frequency == BillFrequency.Once)
        {
            if (startDate >= from)
            {
                results.Add(startDate);
            }

            return results;
        }

        if (frequency == BillFrequency.Weekly)
        {
            var stepDays = checked(interval * 7);
            var offset = from > startDate ? (from.DayNumber - startDate.DayNumber) : 0;
            var index = offset == 0 ? 0 : (int)Math.Ceiling(offset / (double)stepDays);
            var firstDayNumber = startDate.DayNumber + ((long)index * stepDays);

            if (firstDayNumber > DateOnly.MaxValue.DayNumber)
            {
                return results;
            }

            var current = DateOnly.FromDayNumber((int)firstDayNumber);

            while (current <= lastDate)
            {
                if (current >= from)
                {
                    AddResult(results, current);
                }

                if (current > DateOnly.MaxValue.AddDays(-stepDays))
                {
                    break;
                }

                current = current.AddDays(stepDays);
            }

            return results;
        }

        var monthInterval =
            frequency == BillFrequency.Yearly ? checked(interval * 12) : interval;
        var monthDelta = MonthDelta(startDate, from);
        var anchorIndex = monthDelta <= 0 ? 0 : monthDelta / monthInterval;

        while (true)
        {
            var current = TryMonthlyDate(startDate, anchorIndex * monthInterval);

            if (current is null || current > lastDate)
            {
                break;
            }

            if (current >= from)
            {
                AddResult(results, current.Value);
            }

            anchorIndex++;
        }

        return results;
    }

    /// <summary>
    /// Returns the first generated occurrence on or after <paramref name="onOrAfter"/>,
    /// or null when the schedule has ended.
    /// </summary>
    public static DateOnly? NextOccurrenceOnOrAfter(
        BillFrequency frequency,
        int interval,
        DateOnly startDate,
        DateOnly? endDate,
        DateOnly onOrAfter
    )
    {
        Validate(frequency, interval, startDate, endDate, startDate, startDate);

        if (onOrAfter <= startDate)
        {
            return startDate;
        }

        if (frequency == BillFrequency.Once)
        {
            return null;
        }

        DateOnly candidate;

        if (frequency == BillFrequency.Weekly)
        {
            var stepDays = checked(interval * 7);
            var offset = onOrAfter.DayNumber - startDate.DayNumber;
            var index = (int)Math.Ceiling(offset / (double)stepDays);
            var dayNumber = startDate.DayNumber + ((long)index * stepDays);

            if (dayNumber > DateOnly.MaxValue.DayNumber)
            {
                return null;
            }

            candidate = DateOnly.FromDayNumber((int)dayNumber);
        }
        else
        {
            var monthInterval =
                frequency == BillFrequency.Yearly ? checked(interval * 12) : interval;
            var monthDelta = MonthDelta(startDate, onOrAfter);
            var anchorIndex = monthDelta / monthInterval;
            var current = TryMonthlyDate(startDate, anchorIndex * monthInterval);

            while (current is not null && current < onOrAfter)
            {
                anchorIndex++;
                current = TryMonthlyDate(startDate, anchorIndex * monthInterval);
            }

            if (current is null)
            {
                return null;
            }

            candidate = current.Value;
        }

        return endDate is null || candidate <= endDate ? candidate : null;
    }

    /// <summary>
    /// Checks whether <paramref name="date"/> is a generated occurrence. This
    /// agrees with <see cref="Occurrences"/> for any schedule and date, including
    /// clamped month-end dates.
    /// </summary>
    public static bool IsOccurrence(
        BillFrequency frequency,
        int interval,
        DateOnly startDate,
        DateOnly? endDate,
        DateOnly date
    )
    {
        Validate(frequency, interval, startDate, endDate, startDate, startDate);

        if (date < startDate || (endDate is not null && date > endDate))
        {
            return false;
        }

        if (frequency == BillFrequency.Once)
        {
            return date == startDate;
        }

        if (frequency == BillFrequency.Weekly)
        {
            var stepDays = checked(interval * 7);
            return (date.DayNumber - startDate.DayNumber) % stepDays == 0;
        }

        var monthInterval =
            frequency == BillFrequency.Yearly ? checked(interval * 12) : interval;
        var delta = MonthDelta(startDate, date);
        var expected = TryMonthlyDate(startDate, delta);

        return delta % monthInterval == 0 && expected is not null && date == expected.Value;
    }

    private static void Validate(
        BillFrequency frequency,
        int interval,
        DateOnly startDate,
        DateOnly? endDate,
        DateOnly from,
        DateOnly to
    )
    {
        if (!Enum.IsDefined(frequency))
        {
            throw new ArgumentOutOfRangeException(nameof(frequency));
        }

        if (interval is < 1 or > 60)
        {
            throw new ArgumentOutOfRangeException(nameof(interval));
        }

        if (endDate is not null && endDate < startDate)
        {
            throw new ArgumentException("End date must not be before the start date.", nameof(endDate));
        }

        if (from > to)
        {
            throw new ArgumentException("Range start must not be after range end.", nameof(from));
        }
    }

    private static void AddResult(List<DateOnly> results, DateOnly date)
    {
        if (results.Count >= MaxOccurrences)
        {
            throw new InvalidOperationException(
                $"Schedule produces more than {MaxOccurrences} occurrences in the requested range."
            );
        }

        results.Add(date);
    }

    private static int MonthDelta(DateOnly start, DateOnly later) =>
        (later.Year - start.Year) * 12 + (later.Month - start.Month);

    private static DateOnly? TryMonthlyDate(DateOnly start, int monthOffset)
    {
        var totalMonths = (start.Year * 12) + (start.Month - 1) + monthOffset;

        if (totalMonths is < 0 or > (9999 * 12) + 11)
        {
            return null;
        }

        var year = totalMonths / 12;
        var month = (totalMonths % 12) + 1;
        var day = Math.Min(start.Day, DateTime.DaysInMonth(year, month));

        return new DateOnly(year, month, day);
    }
}
