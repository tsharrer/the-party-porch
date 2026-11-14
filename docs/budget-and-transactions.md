# Budget and transaction workbook

The private `Party-Porch-Budget-and-Transactions.xlsx` workbook belongs in the
business Google Drive Documents folder, not the public repository. Actual
financial entries are intentionally not reproduced here.

## Open as a Google Sheet

1. In Google Drive Documents, open the workbook with Google Sheets.
2. Select **File -> Save as Google Sheets**.
3. Use the resulting Google Sheet as the working ledger. Rename/archive the
   original Excel file if needed to avoid maintaining two competing copies.
4. Keep sharing restricted to the business and explicitly authorized users.

Uploading an Excel workbook does not automatically make it a native Google Sheet.
The file can be edited in compatibility mode, but the conversion step creates
the requested Google Sheets document.

## Tabs

| Tab | Purpose |
| --- | --- |
| Dashboard | Recorded cash in/out, known net cash, missing expenses and open pipeline |
| Budget | Enter planned amounts by category; compare them with known paid expenses |
| Transactions | Actual money received/spent, dates, categories, status and receipt links |
| Pipeline | Potential bookings, expected totals and collected payments |
| Instructions | Entry rules and the limits of the opening summary |

The opening spending/income entries are owner-reported aggregate amounts, not
itemized receipt data. Unknown fee amounts are visibly marked as needing amounts.
No transaction dates, budgets, fees or payments were guessed.

## Record transactions

Use positive amounts and set Type to Income or Expense; the formulas determine
cash direction. Set Status to Paid only when money actually changed hands.
Amounts are in USD. Do not type a minus sign for an expense.

Fill dates from bank/provider records, categorize the expense and link a receipt
privately. Unknown fees remain Amount needed and are not included in known totals.
Enter the actual billed amount, including zero if billing confirms zero.

Do not duplicate opening aggregate entries when you later itemize their receipts.
Replace an aggregate with its itemized components, preserving the same total, or
mark the aggregate Replaced before adding the individual Paid entries.

The workbook reserves rows through 1000 for entry. Extend summary ranges and
validation if you need more rows.

## Track bookings separately from cash

Potential revenue stays in Pipeline, not the paid Income total. When a booking
pays a deposit, enter only that deposit as Income/Paid in Transactions, using the
same booking reference as Pipeline. Later enter the balance as a separate payment.

Pipeline calculates collected payments from matching paid income references and
remaining potential value from the expected total. It excludes Lost and Complete
rows from open pipeline. Use one unique booking reference per party.

No automatic link to Stripe, Twilio, bank accounts or calendar was configured.
Update from actual statements and invoices. The known cash figure is not
accounting profit and excludes fees still needing amounts.

## Budget and review

Budget plans start blank so you can choose a cap rather than inheriting a guessed
plan. Positive Remaining means room under the plan; negative means over plan.
Compare only known paid expenses and resolve Missing amounts before treating the
comparison as complete.

Review weekly: provider bills, received payments, outstanding invoices, missing
amounts, upcoming pipeline and new purchases. This is an operating tracker, not
a tax return or substitute for professional bookkeeping.
