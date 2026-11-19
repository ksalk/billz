using Billz.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Billz.Tests;

public class DatabaseTests : IClassFixture<BillzWebApplicationFactory>
{
    private readonly BillzWebApplicationFactory _factory;

    public DatabaseTests(BillzWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task InitialMigrationIsAppliedAndWalIsEnabled()
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<BillzDbContext>();

        var migrations = await database.Database.GetAppliedMigrationsAsync();
        Assert.Contains(
            migrations,
            migration => migration.EndsWith("_InitialCreate", StringComparison.Ordinal)
        );
        Assert.True(
            File.Exists(_factory.DatabasePath),
            $"Expected database at {_factory.DatabasePath}, actual connection is {database.Database.GetDbConnection().DataSource}"
        );

        var journalMode = await database.Database
            .SqlQueryRaw<string>("SELECT journal_mode AS \"Value\" FROM pragma_journal_mode")
            .SingleAsync();
        Assert.Equal("wal", journalMode, ignoreCase: true);

        var synchronous = await database.Database
            .SqlQueryRaw<int>("SELECT synchronous AS \"Value\" FROM pragma_synchronous")
            .SingleAsync();
        Assert.Equal(1, synchronous);

        var busyTimeout = await database.Database
            .SqlQueryRaw<int>("SELECT timeout AS \"Value\" FROM pragma_busy_timeout")
            .SingleAsync();
        Assert.Equal(5000, busyTimeout);
    }

    [Fact]
    public async Task BillsAndOccurrencesRoundTripWithDateOnly()
    {
        var now = DateTimeOffset.UtcNow;

        await using var scope = _factory.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<BillzDbContext>();

        var bill = new Bill
        {
            Name = "Rent",
            AmountMinor = 350_000,
            Frequency = BillFrequency.Monthly,
            Interval = 1,
            StartDate = new DateOnly(2026, 12, 1),
            EndDate = new DateOnly(2027, 12, 1),
            Category = "Home",
            Notes = "Transfer before noon",
            CreatedAt = now,
            UpdatedAt = now,
        };
        database.Bills.Add(bill);
        await database.SaveChangesAsync();

        database.BillOccurrences.Add(
            new BillOccurrence
            {
                BillId = bill.Id,
                DueDate = new DateOnly(2026, 12, 1),
                Status = BillOccurrenceStatus.Paid,
                PaidOn = new DateOnly(2026, 12, 2),
                AmountPaidMinor = 349_900,
                CreatedAt = now,
                UpdatedAt = now,
            }
        );
        await database.SaveChangesAsync();
        database.ChangeTracker.Clear();

        var loaded = await database.Bills
            .Include(item => item.Occurrences)
            .SingleAsync(item => item.Id == bill.Id);

        Assert.Equal(new DateOnly(2026, 12, 1), loaded.StartDate);
        Assert.Equal(new DateOnly(2027, 12, 1), loaded.EndDate);
        Assert.Equal(BillFrequency.Monthly, loaded.Frequency);

        var occurrence = Assert.Single(loaded.Occurrences);
        Assert.Equal(new DateOnly(2026, 12, 1), occurrence.DueDate);
        Assert.Equal(BillOccurrenceStatus.Paid, occurrence.Status);
        Assert.Equal(new DateOnly(2026, 12, 2), occurrence.PaidOn);
        Assert.Equal(349_900, occurrence.AmountPaidMinor);
    }

    [Theory]
    [InlineData("   ")]
    [InlineData("\t")]
    public async Task WhitespaceOnlyNameIsRejected(string name)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<BillzDbContext>();
        database.Bills.Add(NewBill(name));

        await Assert.ThrowsAsync<DbUpdateException>(() => database.SaveChangesAsync());
    }

    [Fact]
    public async Task InvalidIntervalIsRejected()
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<BillzDbContext>();
        var bill = NewBill("Invalid interval");
        bill.Interval = 0;
        database.Bills.Add(bill);

        await Assert.ThrowsAsync<DbUpdateException>(() => database.SaveChangesAsync());
    }

    [Fact]
    public async Task EndDateBeforeStartDateIsRejected()
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<BillzDbContext>();
        var bill = NewBill("Invalid end date");
        bill.EndDate = bill.StartDate.AddDays(-1);
        database.Bills.Add(bill);

        await Assert.ThrowsAsync<DbUpdateException>(() => database.SaveChangesAsync());
    }

    [Fact]
    public async Task PaidOccurrenceWithoutPaidFieldsIsRejected()
    {
        var now = DateTimeOffset.UtcNow;

        await using var scope = _factory.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<BillzDbContext>();
        var bill = NewBill("Paid fields");
        database.Bills.Add(bill);
        await database.SaveChangesAsync();

        database.BillOccurrences.Add(
            new BillOccurrence
            {
                BillId = bill.Id,
                DueDate = bill.StartDate,
                Status = BillOccurrenceStatus.Paid,
                CreatedAt = now,
                UpdatedAt = now,
            }
        );

        await Assert.ThrowsAsync<DbUpdateException>(() => database.SaveChangesAsync());
    }

    [Fact]
    public async Task DeletingBillCascadesToOccurrences()
    {
        var now = DateTimeOffset.UtcNow;

        await using var scope = _factory.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<BillzDbContext>();

        var bill = new Bill
        {
            Name = "Internet",
            AmountMinor = 7_900,
            Frequency = BillFrequency.Monthly,
            Interval = 1,
            StartDate = new DateOnly(2026, 12, 10),
            CreatedAt = now,
            UpdatedAt = now,
        };
        database.Bills.Add(bill);
        await database.SaveChangesAsync();

        database.BillOccurrences.Add(
            new BillOccurrence
            {
                BillId = bill.Id,
                DueDate = new DateOnly(2026, 12, 10),
                Status = BillOccurrenceStatus.Skipped,
                CreatedAt = now,
                UpdatedAt = now,
            }
        );
        await database.SaveChangesAsync();
        database.ChangeTracker.Clear();

        await database.Bills.Where(item => item.Id == bill.Id).ExecuteDeleteAsync();

        Assert.Equal(
            0,
            await database.BillOccurrences.CountAsync(item => item.BillId == bill.Id)
        );
    }

    private static Bill NewBill(string name)
    {
        var now = DateTimeOffset.UtcNow;

        return new Bill
        {
            Name = name,
            AmountMinor = 1_000,
            Frequency = BillFrequency.Monthly,
            Interval = 1,
            StartDate = new DateOnly(2026, 12, 1),
            CreatedAt = now,
            UpdatedAt = now,
        };
    }
}
