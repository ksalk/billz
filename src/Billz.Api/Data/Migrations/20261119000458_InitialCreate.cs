using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Billz.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bills",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    name = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                    amount_minor = table.Column<long>(type: "INTEGER", nullable: false),
                    frequency = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    interval = table.Column<int>(type: "INTEGER", nullable: false),
                    start_date = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    end_date = table.Column<DateOnly>(type: "TEXT", nullable: true),
                    category = table.Column<string>(type: "TEXT", maxLength: 40, nullable: true),
                    notes = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: true),
                    created_at = table.Column<long>(type: "INTEGER", nullable: false),
                    updated_at = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bills", x => x.id);
                    table.CheckConstraint("ck_bills_amount_minor", "amount_minor >= 0 AND amount_minor <= 9999999999");
                    table.CheckConstraint("ck_bills_category", "category IS NULL OR length(category) <= 40");
                    table.CheckConstraint("ck_bills_end_date", "end_date IS NULL OR end_date >= start_date");
                    table.CheckConstraint("ck_bills_frequency", "frequency IN ('once', 'weekly', 'monthly', 'yearly')");
                    table.CheckConstraint("ck_bills_interval", "interval >= 1 AND interval <= 60");
                    table.CheckConstraint("ck_bills_name", "length(trim(name, char(9) || char(10) || char(13) || ' ')) > 0 AND length(name) <= 120");
                    table.CheckConstraint("ck_bills_notes", "notes IS NULL OR length(notes) <= 2000");
                });

            migrationBuilder.CreateTable(
                name: "bill_occurrences",
                columns: table => new
                {
                    bill_id = table.Column<int>(type: "INTEGER", nullable: false),
                    due_date = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    status = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    paid_on = table.Column<DateOnly>(type: "TEXT", nullable: true),
                    amount_paid_minor = table.Column<long>(type: "INTEGER", nullable: true),
                    created_at = table.Column<long>(type: "INTEGER", nullable: false),
                    updated_at = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bill_occurrences", x => new { x.bill_id, x.due_date });
                    table.CheckConstraint("ck_bill_occurrences_amount_paid_minor", "amount_paid_minor IS NULL OR (amount_paid_minor >= 0 AND amount_paid_minor <= 9999999999)");
                    table.CheckConstraint("ck_bill_occurrences_paid_fields", "(status = 'paid' AND paid_on IS NOT NULL AND amount_paid_minor IS NOT NULL) OR (status = 'skipped' AND paid_on IS NULL AND amount_paid_minor IS NULL)");
                    table.CheckConstraint("ck_bill_occurrences_status", "status IN ('paid', 'skipped')");
                    table.ForeignKey(
                        name: "FK_bill_occurrences_bills_bill_id",
                        column: x => x.bill_id,
                        principalTable: "bills",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_bill_occurrences_due_date",
                table: "bill_occurrences",
                column: "due_date");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bill_occurrences");

            migrationBuilder.DropTable(
                name: "bills");
        }
    }
}
