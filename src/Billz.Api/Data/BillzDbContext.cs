using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Billz.Api.Data;

public sealed class BillzDbContext(DbContextOptions<BillzDbContext> options)
    : DbContext(options)
{
    public DbSet<Bill> Bills => Set<Bill>();

    public DbSet<BillOccurrence> BillOccurrences => Set<BillOccurrence>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var frequencyConverter = new ValueConverter<BillFrequency, string>(
            value => value.ToString().ToLowerInvariant(),
            value => Enum.Parse<BillFrequency>(value, true)
        );
        var statusConverter = new ValueConverter<BillOccurrenceStatus, string>(
            value => value.ToString().ToLowerInvariant(),
            value => Enum.Parse<BillOccurrenceStatus>(value, true)
        );
        var timestampConverter = new ValueConverter<DateTimeOffset, long>(
            value => value.ToUnixTimeMilliseconds(),
            value => DateTimeOffset.FromUnixTimeMilliseconds(value)
        );

        modelBuilder.Entity<Bill>(bill =>
        {
            bill.ToTable("bills", table =>
            {
                table.HasCheckConstraint(
                    "ck_bills_amount_minor",
                    "amount_minor >= 0 AND amount_minor <= 9999999999"
                );
                table.HasCheckConstraint(
                    "ck_bills_interval",
                    "interval >= 1 AND interval <= 60"
                );
                table.HasCheckConstraint(
                    "ck_bills_end_date",
                    "end_date IS NULL OR end_date >= start_date"
                );
                table.HasCheckConstraint(
                    "ck_bills_frequency",
                    "frequency IN ('once', 'weekly', 'monthly', 'yearly')"
                );
                table.HasCheckConstraint(
                    "ck_bills_name",
                    "length(trim(name, char(9) || char(10) || char(13) || ' ')) > 0 AND length(name) <= 120"
                );
                table.HasCheckConstraint(
                    "ck_bills_category",
                    "category IS NULL OR length(category) <= 40"
                );
                table.HasCheckConstraint(
                    "ck_bills_notes",
                    "notes IS NULL OR length(notes) <= 2000"
                );
            });

            bill.HasKey(x => x.Id);
            bill.Property(x => x.Id).HasColumnName("id");
            bill.Property(x => x.Name).HasColumnName("name").IsRequired().HasMaxLength(120);
            bill.Property(x => x.AmountMinor).HasColumnName("amount_minor").IsRequired();
            bill.Property(x => x.Frequency)
                .HasColumnName("frequency")
                .HasConversion(frequencyConverter)
                .HasMaxLength(16)
                .IsRequired();
            bill.Property(x => x.Interval).HasColumnName("interval").IsRequired();
            bill.Property(x => x.StartDate).HasColumnName("start_date").IsRequired();
            bill.Property(x => x.EndDate).HasColumnName("end_date");
            bill.Property(x => x.Category).HasColumnName("category").HasMaxLength(40);
            bill.Property(x => x.Notes).HasColumnName("notes").HasMaxLength(2000);
            bill.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .HasConversion(timestampConverter)
                .IsRequired();
            bill.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .HasConversion(timestampConverter)
                .IsRequired();

            bill.HasMany(x => x.Occurrences)
                .WithOne(x => x.Bill)
                .HasForeignKey(x => x.BillId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BillOccurrence>(occurrence =>
        {
            occurrence.ToTable(
                "bill_occurrences",
                table =>
                {
                    table.HasCheckConstraint(
                        "ck_bill_occurrences_status",
                        "status IN ('paid', 'skipped')"
                    );
                    table.HasCheckConstraint(
                        "ck_bill_occurrences_paid_fields",
                        "(status = 'paid' AND paid_on IS NOT NULL AND amount_paid_minor IS NOT NULL) "
                            + "OR (status = 'skipped' AND paid_on IS NULL AND amount_paid_minor IS NULL)"
                    );
                    table.HasCheckConstraint(
                        "ck_bill_occurrences_amount_paid_minor",
                        "amount_paid_minor IS NULL OR (amount_paid_minor >= 0 AND amount_paid_minor <= 9999999999)"
                    );
                }
            );

            occurrence.HasKey(x => new { x.BillId, x.DueDate });
            occurrence.Property(x => x.BillId).HasColumnName("bill_id");
            occurrence.Property(x => x.DueDate).HasColumnName("due_date").IsRequired();
            occurrence.Property(x => x.Status)
                .HasColumnName("status")
                .HasConversion(statusConverter)
                .HasMaxLength(16)
                .IsRequired();
            occurrence.Property(x => x.PaidOn).HasColumnName("paid_on");
            occurrence.Property(x => x.AmountPaidMinor).HasColumnName("amount_paid_minor");
            occurrence.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .HasConversion(timestampConverter)
                .IsRequired();
            occurrence.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .HasConversion(timestampConverter)
                .IsRequired();

            occurrence.HasIndex(x => x.DueDate).HasDatabaseName("ix_bill_occurrences_due_date");
        });
    }
}
