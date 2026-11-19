using Billz.Api.Data;
using Billz.Api.Domain;

namespace Billz.Tests;

public class ScheduleCalculatorTests
{
    [Fact]
    public void OnceOffOccursOnlyOnItsDate()
    {
        var date = D(2026, 12, 15);

        Assert.Equal(
            [date],
            ScheduleCalculator.Occurrences(
                BillFrequency.Once,
                1,
                date,
                null,
                D(2026, 12, 1),
                D(2026, 12, 31)
            )
        );
        Assert.Empty(
            ScheduleCalculator.Occurrences(
                BillFrequency.Once,
                1,
                date,
                null,
                D(2027, 1, 1),
                D(2027, 1, 31)
            )
        );
        Assert.True(
            ScheduleCalculator.IsOccurrence(BillFrequency.Once, 1, date, null, date)
        );
        Assert.False(
            ScheduleCalculator.IsOccurrence(
                BillFrequency.Once,
                1,
                date,
                null,
                date.AddDays(1)
            )
        );
    }

    [Fact]
    public void WeeklyEveryTwoWeeksUsesTheStartWeekday()
    {
        var occurrences = ScheduleCalculator.Occurrences(
            BillFrequency.Weekly,
            2,
            D(2026, 11, 20),
            null,
            D(2026, 11, 1),
            D(2026, 12, 31)
        );

        Assert.Equal([D(2026, 11, 20), D(2026, 12, 4), D(2026, 12, 18)], occurrences);
    }

    [Fact]
    public void WeeklyRangeStartsAtFirstOccurrenceInsideTheWindow()
    {
        var occurrences = ScheduleCalculator.Occurrences(
            BillFrequency.Weekly,
            2,
            D(2026, 12, 1),
            null,
            D(2026, 12, 10),
            D(2026, 12, 31)
        );

        Assert.Equal([D(2026, 12, 15), D(2026, 12, 29)], occurrences);
    }

    [Theory]
    [InlineData(2026, 2, 28)]
    [InlineData(2028, 2, 29)]
    public void MonthlyOnTheThirtyFirstClampsFebruary(int year, int month, int day)
    {
        var occurrences = ScheduleCalculator.Occurrences(
            BillFrequency.Monthly,
            1,
            D(2026, 1, 31),
            null,
            D(year, month, 1),
            D(year, month, day)
        );

        Assert.Equal([D(year, month, day)], occurrences);
    }

    [Fact]
    public void MonthlyThirtyFirstClampsAcrossAWholeYear()
    {
        var occurrences = ScheduleCalculator.Occurrences(
            BillFrequency.Monthly,
            1,
            D(2026, 1, 31),
            null,
            D(2026, 1, 1),
            D(2026, 6, 30)
        );

        Assert.Equal(
            [
                D(2026, 1, 31),
                D(2026, 2, 28),
                D(2026, 3, 31),
                D(2026, 4, 30),
                D(2026, 5, 31),
                D(2026, 6, 30),
            ],
            occurrences
        );
    }

    [Fact]
    public void MonthlyIntervalKeepsItsAnchorMonth()
    {
        var occurrences = ScheduleCalculator.Occurrences(
            BillFrequency.Monthly,
            2,
            D(2026, 1, 31),
            null,
            D(2026, 1, 1),
            D(2026, 7, 31)
        );

        Assert.Equal(
            [D(2026, 1, 31), D(2026, 3, 31), D(2026, 5, 31), D(2026, 7, 31)],
            occurrences
        );
    }

    [Fact]
    public void QuarterlyIsMonthlyWithIntervalThree()
    {
        var occurrences = ScheduleCalculator.Occurrences(
            BillFrequency.Monthly,
            3,
            D(2026, 2, 15),
            null,
            D(2026, 1, 1),
            D(2026, 12, 31)
        );

        Assert.Equal(
            [D(2026, 2, 15), D(2026, 5, 15), D(2026, 8, 15), D(2026, 11, 15)],
            occurrences
        );
    }

    [Fact]
    public void YearlyLeapDayClampsInCommonYears()
    {
        var occurrences = ScheduleCalculator.Occurrences(
            BillFrequency.Yearly,
            1,
            D(2028, 2, 29),
            null,
            D(2028, 1, 1),
            D(2032, 12, 31)
        );

        Assert.Equal(
            [
                D(2028, 2, 29),
                D(2029, 2, 28),
                D(2030, 2, 28),
                D(2031, 2, 28),
                D(2032, 2, 29),
            ],
            occurrences
        );
    }

    [Fact]
    public void YearlyIntervalFourKeepsLeapDay()
    {
        var occurrences = ScheduleCalculator.Occurrences(
            BillFrequency.Yearly,
            4,
            D(2028, 2, 29),
            null,
            D(2028, 1, 1),
            D(2044, 12, 31)
        );

        Assert.Equal(
            [
                D(2028, 2, 29),
                D(2032, 2, 29),
                D(2036, 2, 29),
                D(2040, 2, 29),
                D(2044, 2, 29),
            ],
            occurrences
        );
    }

    [Fact]
    public void RangeIsClippedToTheRequestedWindow()
    {
        var occurrences = ScheduleCalculator.Occurrences(
            BillFrequency.Monthly,
            1,
            D(2025, 1, 15),
            null,
            D(2025, 6, 1),
            D(2025, 8, 31)
        );

        Assert.Equal([D(2025, 6, 15), D(2025, 7, 15), D(2025, 8, 15)], occurrences);
    }

    [Fact]
    public void EndDateIsInclusive()
    {
        var occurrences = ScheduleCalculator.Occurrences(
            BillFrequency.Monthly,
            1,
            D(2026, 1, 31),
            D(2026, 3, 31),
            D(2026, 1, 1),
            D(2026, 12, 31)
        );

        Assert.Equal([D(2026, 1, 31), D(2026, 2, 28), D(2026, 3, 31)], occurrences);
    }

    [Fact]
    public void ScheduleStartingAfterTheRangeIsEmpty()
    {
        Assert.Empty(
            ScheduleCalculator.Occurrences(
                BillFrequency.Monthly,
                1,
                D(2027, 1, 1),
                null,
                D(2026, 1, 1),
                D(2026, 12, 31)
            )
        );
    }

    [Theory]
    [InlineData(2026, 2, 28, true)]
    [InlineData(2028, 2, 29, true)]
    [InlineData(2026, 1, 31, true)]
    [InlineData(2026, 3, 30, false)]
    [InlineData(2026, 1, 30, false)]
    [InlineData(2025, 12, 31, false)]
    public void IsOccurrenceUnderstandsMonthlyClamping(
        int year,
        int month,
        int day,
        bool expected
    )
    {
        Assert.Equal(
            expected,
            ScheduleCalculator.IsOccurrence(
                BillFrequency.Monthly,
                1,
                D(2026, 1, 31),
                null,
                D(year, month, day)
            )
        );
    }

    [Theory]
    [InlineData(2028, 2, 29, true)]
    [InlineData(2029, 2, 28, true)]
    [InlineData(2032, 2, 29, true)]
    [InlineData(2029, 3, 1, false)]
    [InlineData(2032, 2, 28, false)]
    [InlineData(2027, 2, 28, false)]
    public void IsOccurrenceUnderstandsYearlyClamping(
        int year,
        int month,
        int day,
        bool expected
    )
    {
        Assert.Equal(
            expected,
            ScheduleCalculator.IsOccurrence(
                BillFrequency.Yearly,
                1,
                D(2028, 2, 29),
                null,
                D(year, month, day)
            )
        );
    }

    [Fact]
    public void IsOccurrenceUsesTheWeeklyInterval()
    {
        Assert.True(
            ScheduleCalculator.IsOccurrence(
                BillFrequency.Weekly,
                2,
                D(2026, 11, 20),
                null,
                D(2026, 12, 4)
            )
        );
        Assert.False(
            ScheduleCalculator.IsOccurrence(
                BillFrequency.Weekly,
                2,
                D(2026, 11, 20),
                null,
                D(2026, 11, 27)
            )
        );
    }

    [Fact]
    public void IsOccurrenceRespectsTheEndDate()
    {
        Assert.True(
            ScheduleCalculator.IsOccurrence(
                BillFrequency.Monthly,
                1,
                D(2026, 1, 31),
                D(2026, 3, 31),
                D(2026, 3, 31)
            )
        );
        Assert.False(
            ScheduleCalculator.IsOccurrence(
                BillFrequency.Monthly,
                1,
                D(2026, 1, 31),
                D(2026, 3, 31),
                D(2026, 4, 30)
            )
        );
    }

    [Fact]
    public void WeeklyNearTheMaximumDateDoesNotOverflow()
    {
        Assert.Empty(
            ScheduleCalculator.Occurrences(
                BillFrequency.Weekly,
                1,
                D(9999, 12, 25),
                null,
                D(9999, 12, 31),
                D(9999, 12, 31)
            )
        );
    }

    [Fact]
    public void MonthlyNearTheMaximumDateStopsCleanly()
    {
        Assert.Equal(
            [D(9999, 12, 30)],
            ScheduleCalculator.Occurrences(
                BillFrequency.Monthly,
                1,
                D(9999, 11, 30),
                null,
                D(9999, 12, 1),
                D(9999, 12, 31)
            )
        );
    }

    [Fact]
    public void OccurrenceLimitIncludesTheBoundary()
    {
        var start = D(2000, 1, 1);
        var lastAllowed = start.AddDays((ScheduleCalculator.MaxOccurrences - 1) * 7);
        var firstRejected = lastAllowed.AddDays(7);

        var occurrences = ScheduleCalculator.Occurrences(
            BillFrequency.Weekly,
            1,
            start,
            null,
            start,
            lastAllowed
        );
        Assert.Equal(ScheduleCalculator.MaxOccurrences, occurrences.Count);
        Assert.Equal(start, occurrences[0]);
        Assert.Equal(lastAllowed, occurrences[^1]);

        Assert.Throws<InvalidOperationException>(() =>
            ScheduleCalculator.Occurrences(
                BillFrequency.Weekly,
                1,
                start,
                null,
                start,
                firstRejected
            )
        );
    }

    [Fact]
    public void MonthlyIntervalTwoDoesNotOccurInOffAnchorMonths()
    {
        Assert.Empty(
            ScheduleCalculator.Occurrences(
                BillFrequency.Monthly,
                2,
                D(2026, 1, 31),
                null,
                D(2026, 2, 28),
                D(2026, 2, 28)
            )
        );
        Assert.False(
            ScheduleCalculator.IsOccurrence(
                BillFrequency.Monthly,
                2,
                D(2026, 1, 31),
                null,
                D(2026, 2, 28)
            )
        );
        Assert.True(
            ScheduleCalculator.IsOccurrence(
                BillFrequency.Monthly,
                2,
                D(2026, 1, 31),
                null,
                D(2026, 3, 31)
            )
        );
    }

    [Fact]
    public void ClampedEndDateBoundaryIsRespected()
    {
        Assert.Empty(
            ScheduleCalculator.Occurrences(
                BillFrequency.Monthly,
                1,
                D(2026, 1, 31),
                null,
                D(2026, 6, 29),
                D(2026, 6, 29)
            )
        );
        Assert.Equal(
            [D(2026, 6, 30)],
            ScheduleCalculator.Occurrences(
                BillFrequency.Monthly,
                1,
                D(2026, 1, 31),
                null,
                D(2026, 6, 30),
                D(2026, 6, 30)
            )
        );
    }

    [Fact]
    public void WeeklyWindowCanStraddleTheStartDate()
    {
        Assert.Equal(
            [D(2026, 12, 1)],
            ScheduleCalculator.Occurrences(
                BillFrequency.Weekly,
                2,
                D(2026, 12, 1),
                null,
                D(2026, 11, 20),
                D(2026, 12, 10)
            )
        );
    }

    [Fact]
    public void OnceOffRespectsEndDateAndRange()
    {
        Assert.Empty(
            ScheduleCalculator.Occurrences(
                BillFrequency.Once,
                1,
                D(2026, 12, 15),
                D(2026, 12, 15),
                D(2026, 12, 16),
                D(2026, 12, 31)
            )
        );
    }

    [Fact]
    public void MonthlyWorksNearTheMinimumDate()
    {
        Assert.Equal(
            [D(1, 1, 31), D(1, 2, 28), D(1, 3, 31)],
            ScheduleCalculator.Occurrences(
                BillFrequency.Monthly,
                1,
                D(1, 1, 31),
                null,
                D(1, 1, 1),
                D(1, 3, 31)
            )
        );
    }

    [Theory]
    [InlineData(0)]
    [InlineData(61)]
    public void InvalidIntervalIsRejected(int interval)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            ScheduleCalculator.Occurrences(
                BillFrequency.Monthly,
                interval,
                D(2026, 1, 1),
                null,
                D(2026, 1, 1),
                D(2026, 12, 31)
            )
        );
    }

    [Fact]
    public void InvalidRangesAreRejected()
    {
        Assert.Throws<ArgumentException>(() =>
            ScheduleCalculator.Occurrences(
                BillFrequency.Monthly,
                1,
                D(2026, 1, 1),
                null,
                D(2026, 12, 31),
                D(2026, 1, 1)
            )
        );

        Assert.Throws<ArgumentException>(() =>
            ScheduleCalculator.Occurrences(
                BillFrequency.Monthly,
                1,
                D(2026, 1, 1),
                D(2025, 12, 31),
                D(2026, 1, 1),
                D(2026, 12, 31)
            )
        );
    }

    private static DateOnly D(int year, int month, int day) => new(year, month, day);
}
