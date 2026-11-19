using Billz.Api.Data;
using Billz.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Billz.Api.Api.Bills;

public static class BillEndpoints
{
    private static readonly IReadOnlySet<DateOnly> NoHandledOccurrences =
        new HashSet<DateOnly>();

    public static IEndpointRouteBuilder MapBillEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/bills", ListBills);
        app.MapGet("/api/bills/{id:int}", GetBill);
        app.MapPost("/api/bills", CreateBill);
        app.MapPut("/api/bills/{id:int}", UpdateBill);
        app.MapDelete("/api/bills/{id:int}", DeleteBill);

        return app;
    }

    private static async Task<IResult> ListBills(
        BillzDbContext database,
        CancellationToken cancellationToken
    )
    {
        var bills = await database.Bills.AsNoTracking().ToListAsync(cancellationToken);
        var handledRows = await (
            from occurrence in database.BillOccurrences.AsNoTracking()
            join bill in database.Bills.AsNoTracking() on occurrence.BillId equals bill.Id
            where occurrence.DueDate >= bill.StartDate
            select new { occurrence.BillId, occurrence.DueDate }
        ).ToListAsync(cancellationToken);

        var handledByBill = handledRows
            .GroupBy(row => row.BillId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlySet<DateOnly>)group.Select(row => row.DueDate).ToHashSet()
            );

        var result = bills
            .Select(bill =>
                BillDto.From(
                    bill,
                    BillNextDue.Compute(
                        bill,
                        handledByBill.GetValueOrDefault(bill.Id) ?? NoHandledOccurrences
                    )
                )
            )
            .OrderBy(dto => dto.NextDue ?? DateOnly.MaxValue)
            .ThenBy(dto => dto.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return Results.Ok(result);
    }

    private static async Task<IResult> GetBill(
        int id,
        BillzDbContext database,
        CancellationToken cancellationToken
    )
    {
        var bill = await database.Bills
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (bill is null)
        {
            return NotFound();
        }

        var handled = await database.BillOccurrences
            .AsNoTracking()
            .Where(occurrence =>
                occurrence.BillId == id && occurrence.DueDate >= bill.StartDate
            )
            .Select(occurrence => occurrence.DueDate)
            .ToListAsync(cancellationToken);

        return Results.Ok(BillDto.From(bill, BillNextDue.Compute(bill, handled.ToHashSet())));
    }

    private static async Task<IResult> CreateBill(
        SaveBillRequest request,
        BillzDbContext database,
        CancellationToken cancellationToken
    )
    {
        var errors = BillValidation.Validate(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        BillValidation.TryParseFrequency(request.Frequency, out var frequency);
        var now = DateTimeOffset.UtcNow;
        var bill = new Bill
        {
            Name = request.Name!.Trim(),
            AmountMinor = request.AmountMinor!.Value,
            Frequency = frequency,
            Interval = request.Interval!.Value,
            StartDate = request.StartDate!.Value,
            EndDate = request.EndDate,
            Category = NormalizeOptional(request.Category),
            Notes = NormalizeOptional(request.Notes),
            CreatedAt = now,
            UpdatedAt = now,
        };

        database.Bills.Add(bill);
        await database.SaveChangesAsync(cancellationToken);

        return Results.Created(
            $"/api/bills/{bill.Id}",
            BillDto.From(bill, bill.StartDate)
        );
    }

    private static async Task<IResult> UpdateBill(
        int id,
        SaveBillRequest request,
        BillzDbContext database,
        CancellationToken cancellationToken
    )
    {
        var bill = await database.Bills.FirstOrDefaultAsync(
            item => item.Id == id,
            cancellationToken
        );

        if (bill is null)
        {
            return NotFound();
        }

        var errors = BillValidation.Validate(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        BillValidation.TryParseFrequency(request.Frequency, out var frequency);
        bill.Name = request.Name!.Trim();
        bill.AmountMinor = request.AmountMinor!.Value;
        bill.Frequency = frequency;
        bill.Interval = request.Interval!.Value;
        bill.StartDate = request.StartDate!.Value;
        bill.EndDate = request.EndDate;
        bill.Category = NormalizeOptional(request.Category);
        bill.Notes = NormalizeOptional(request.Notes);
        bill.UpdatedAt = DateTimeOffset.UtcNow;

        await database.SaveChangesAsync(cancellationToken);

        var handled = await database.BillOccurrences
            .AsNoTracking()
            .Where(occurrence =>
                occurrence.BillId == id && occurrence.DueDate >= bill.StartDate
            )
            .Select(occurrence => occurrence.DueDate)
            .ToListAsync(cancellationToken);

        return Results.Ok(BillDto.From(bill, BillNextDue.Compute(bill, handled.ToHashSet())));
    }

    private static async Task<IResult> DeleteBill(
        int id,
        BillzDbContext database,
        CancellationToken cancellationToken
    )
    {
        var deleted = await database.Bills
            .Where(item => item.Id == id)
            .ExecuteDeleteAsync(cancellationToken);

        return deleted == 0 ? NotFound() : Results.NoContent();
    }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static IResult NotFound() =>
        Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Bill not found");
}
