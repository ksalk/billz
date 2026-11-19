using Billz.Api.Api.Bills;
using Billz.Api.Data;
using Billz.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Billz.Api.Api.Occurrences;

public static class OccurrenceEndpoints
{
    private const int MaxRangeDays = 366;

    public static IEndpointRouteBuilder MapOccurrenceEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/occurrences", ListOccurrences);
        app.MapPut("/api/bills/{billId:int}/occurrences/{dueDate}", SaveOccurrence);
        app.MapDelete("/api/bills/{billId:int}/occurrences/{dueDate}", ResetOccurrence);

        return app;
    }

    private static async Task<IResult> ListOccurrences(
        DateOnly? from,
        DateOnly? to,
        BillzDbContext database,
        CancellationToken cancellationToken
    )
    {
        var errors = ValidateRange(from, to);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var rangeStart = from!.Value;
        var rangeEnd = to!.Value;
        var bills = await database.Bills.AsNoTracking().ToListAsync(cancellationToken);
        var overrideRows = await database.BillOccurrences
            .AsNoTracking()
            .Where(occurrence =>
                occurrence.DueDate >= rangeStart && occurrence.DueDate <= rangeEnd
            )
            .ToListAsync(cancellationToken);
        var overrides = overrideRows.ToDictionary(
            occurrence => (occurrence.BillId, occurrence.DueDate)
        );

        var result = new List<OccurrenceDto>();

        foreach (var bill in bills)
        {
            var dates = ScheduleCalculator.Occurrences(
                bill.Frequency,
                bill.Interval,
                bill.StartDate,
                bill.EndDate,
                rangeStart,
                rangeEnd
            );

            foreach (var date in dates)
            {
                result.Add(
                    OccurrenceDto.From(
                        bill,
                        date,
                        overrides.GetValueOrDefault((bill.Id, date))
                    )
                );
            }
        }

        // Schedule edits leave paid/skipped rows behind. Keep those history rows
        // visible in the requested range so they can be inspected or reset.
        var emitted = result.Select(item => (item.BillId, item.DueDate)).ToHashSet();
        var billsById = bills.ToDictionary(bill => bill.Id);

        foreach (var row in overrideRows)
        {
            if (
                emitted.Contains((row.BillId, row.DueDate))
                || !billsById.TryGetValue(row.BillId, out var bill)
            )
            {
                continue;
            }

            result.Add(OccurrenceDto.From(bill, row.DueDate, row));
        }

        return Results.Ok(
            result
                .OrderBy(item => item.DueDate)
                .ThenBy(item => item.BillName, StringComparer.OrdinalIgnoreCase)
                .ToList()
        );
    }

    private static async Task<IResult> SaveOccurrence(
        int billId,
        DateOnly dueDate,
        SaveOccurrenceRequest request,
        BillzDbContext database,
        CancellationToken cancellationToken
    )
    {
        var bill = await database.Bills
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == billId, cancellationToken);

        if (bill is null)
        {
            return NotFoundBill();
        }

        var occurrence = await database.BillOccurrences.FirstOrDefaultAsync(
            item => item.BillId == billId && item.DueDate == dueDate,
            cancellationToken
        );

        // Existing history rows stay editable after a schedule edit; only new
        // rows must match the bill's current schedule.
        if (occurrence is null && !IsScheduled(bill, dueDate))
        {
            return InvalidDueDate();
        }

        var status = request.Status?.Trim();
        var errors = ValidateRequest(request, bill, status);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var isPaid = string.Equals(status, "paid", StringComparison.OrdinalIgnoreCase);
        long? amountPaid = isPaid ? request.AmountMinor ?? bill.AmountMinor : null;
        var now = DateTimeOffset.UtcNow;

        if (occurrence is not null)
        {
            Apply(occurrence, isPaid, request.PaidOn, amountPaid, now);

            try
            {
                await database.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                database.Entry(occurrence).State = EntityState.Detached;
                occurrence = NewOccurrence(billId, dueDate, now);
                Apply(occurrence, isPaid, request.PaidOn, amountPaid, now);
                database.BillOccurrences.Add(occurrence);
                await database.SaveChangesAsync(cancellationToken);
            }

            return Results.Ok(OccurrenceDto.From(bill, dueDate, occurrence));
        }

        occurrence = NewOccurrence(billId, dueDate, now);
        Apply(occurrence, isPaid, request.PaidOn, amountPaid, now);
        database.BillOccurrences.Add(occurrence);

        try
        {
            await database.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            database.Entry(occurrence).State = EntityState.Detached;
            var concurrent = await database.BillOccurrences.FirstOrDefaultAsync(
                item => item.BillId == billId && item.DueDate == dueDate,
                cancellationToken
            );

            if (concurrent is null)
            {
                throw;
            }

            Apply(concurrent, isPaid, request.PaidOn, amountPaid, now);
            await database.SaveChangesAsync(cancellationToken);
            occurrence = concurrent;
        }

        return Results.Ok(OccurrenceDto.From(bill, dueDate, occurrence));
    }

    private static async Task<IResult> ResetOccurrence(
        int billId,
        DateOnly dueDate,
        BillzDbContext database,
        CancellationToken cancellationToken
    )
    {
        var bill = await database.Bills
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == billId, cancellationToken);

        if (bill is null)
        {
            return NotFoundBill();
        }

        var occurrence = await database.BillOccurrences.FirstOrDefaultAsync(
            item => item.BillId == billId && item.DueDate == dueDate,
            cancellationToken
        );

        if (occurrence is not null)
        {
            database.BillOccurrences.Remove(occurrence);

            try
            {
                await database.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                // A concurrent reset or bill deletion already removed the row.
            }

            return Results.NoContent();
        }

        return IsScheduled(bill, dueDate) ? Results.NoContent() : InvalidDueDate();
    }

    private static void Apply(
        BillOccurrence occurrence,
        bool isPaid,
        DateOnly? paidOn,
        long? amountPaid,
        DateTimeOffset now
    )
    {
        occurrence.Status = isPaid ? BillOccurrenceStatus.Paid : BillOccurrenceStatus.Skipped;
        occurrence.PaidOn = isPaid ? paidOn : null;
        occurrence.AmountPaidMinor = isPaid ? amountPaid : null;
        occurrence.UpdatedAt = now;
    }

    private static BillOccurrence NewOccurrence(
        int billId,
        DateOnly dueDate,
        DateTimeOffset now
    ) =>
        new()
        {
            BillId = billId,
            DueDate = dueDate,
            CreatedAt = now,
            UpdatedAt = now,
        };

    private static Dictionary<string, string[]> ValidateRange(DateOnly? from, DateOnly? to)
    {
        var errors = new Dictionary<string, string[]>();

        if (from is null)
        {
            errors["from"] = ["Start date is required."];
        }
        else if (!BillValidation.IsSupportedDate(from.Value))
        {
            errors["from"] = ["Start date is outside the supported range."];
        }

        if (to is null)
        {
            errors["to"] = ["End date is required."];
        }
        else if (!BillValidation.IsSupportedDate(to.Value))
        {
            errors["to"] = ["End date is outside the supported range."];
        }

        if (from is not null && to is not null)
        {
            if (from > to)
            {
                errors["from"] = ["Start date must not be after the end date."];
            }
            else if (to.Value.DayNumber - from.Value.DayNumber >= MaxRangeDays)
            {
                errors["to"] = [$"Range must be {MaxRangeDays} days or fewer."];
            }
        }

        return errors;
    }

    private static Dictionary<string, string[]> ValidateRequest(
        SaveOccurrenceRequest request,
        Bill bill,
        string? status
    )
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

        var isPaid = string.Equals(status, "paid", StringComparison.OrdinalIgnoreCase);
        var isSkipped = string.Equals(status, "skipped", StringComparison.OrdinalIgnoreCase);

        if (!isPaid && !isSkipped)
        {
            Add("status", "Status must be paid or skipped.");
        }

        if (isPaid)
        {
            if (request.PaidOn is null)
            {
                Add("paidOn", "Paid date is required when marking an occurrence paid.");
            }
            else if (!BillValidation.IsSupportedDate(request.PaidOn.Value))
            {
                Add("paidOn", "Paid date must be between 1900-01-01 and 2100-12-31.");
            }

            var amount = request.AmountMinor ?? bill.AmountMinor;
            if (amount is < 0 or > BillValidation.MaxAmountMinor)
            {
                Add("amountMinor", "Amount is outside the supported range.");
            }
        }
        else if (isSkipped && (request.PaidOn is not null || request.AmountMinor is not null))
        {
            Add("status", "Skipped occurrences must not include paid date or amount.");
        }

        return errors.ToDictionary(
            entry => entry.Key,
            entry => entry.Value.ToArray(),
            StringComparer.Ordinal
        );
    }

    private static bool IsScheduled(Bill bill, DateOnly dueDate) =>
        ScheduleCalculator.IsOccurrence(
            bill.Frequency,
            bill.Interval,
            bill.StartDate,
            bill.EndDate,
            dueDate
        );

    private static IResult NotFoundBill() =>
        Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Bill not found");

    private static IResult InvalidDueDate() =>
        Results.ValidationProblem(
            new Dictionary<string, string[]>
            {
                ["dueDate"] = ["Due date does not match the bill schedule."],
            }
        );
}
