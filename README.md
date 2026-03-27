# pdf2csv — Invoice Processor

A web application that extracts structured data from PDF invoices using Claude AI and exports the results as a CSV file ready for accounting or ERP import.

## What it does

- **PDF upload** — drag and drop one or multiple PDF invoice files at once
- **AI extraction** — each invoice is sent to Claude AI, which reads the document and extracts key fields automatically (debtor name, address, invoice number, dates, amounts, VAT numbers)
- **Multi-page PDF rendering** — the original invoice is displayed page by page alongside the extracted fields so the user can verify the data visually
- **Field validation** — all extracted values are validated (date formats, amount ranges, required fields) before the invoice can be marked as done
- **VAT number detection** — the app detects EU VAT numbers (28 country formats) present in the invoice and assigns them to creditor and debtor; the creditor VAT is always required
- **VAT switch button** — if Claude assigns the VAT numbers to the wrong party, a single click swaps creditor and debtor values; a hint is shown when the assignment looks incorrect
- **B2B / B2C debtor type selector** — when only the creditor VAT is known, the user classifies the debtor as a company (B2B) or individual (B2C); this drives downstream validation and the debtor code
- **Debtor code generation** — for B2B debtors without a known VAT, a 12-character code is auto-generated from the debtor's name, city, street, and postal code; it updates automatically when any of those fields change
- **Duplicate detection** — the app warns if the same invoice file is uploaded twice
- **Skip & export** — invoices that cannot be processed can be skipped; a warning is shown before export listing how many were skipped
- **CSV export** — all validated invoices are exported as a single CSV file; VAT columns and the debtor code column are included only when relevant
- **Dark mode** — the interface respects the system colour preference

## How to use it

1. **Upload** — drag your PDF invoices onto the drop zone, or click to browse. You can upload several files at once.
2. **Review each invoice** — the app displays the PDF on the left and the extracted fields on the right. Check that the values match what is on the document.
3. **Fix errors** — fields highlighted in red are invalid or missing. Edit them directly in the form. The invoice re-validates as you type.
4. **Set the debtor type** — if the app cannot determine whether the debtor is a company or an individual, two buttons appear (Particulier / Entreprise). Select the correct one. This is required before you can validate.
5. **Check the creditor VAT** — the creditor VAT number field is always mandatory. If Claude did not detect it, enter it manually. If the two VAT numbers appear swapped, use the ⇄ switch button to correct them.
6. **Validate** — once all fields are correct, click **Valider ✓**. The invoice moves to the validated state in the sidebar.
7. **Repeat** for each invoice in the list.
8. **Export** — when all invoices are either validated or skipped, the **Terminer et exporter** button becomes available. Click it to download the CSV file.

## PAYT logic

The `debtor_code` field is a unique identifier used to match each debtor in a payment tracking system.

- **B2B debtor (Entreprise)** — the `debtor_code` is equal to the debtor's VAT number. Since a VAT number is mandatory for a business debtor, it is always present and serves as the canonical identifier. The `debtor_vat_number` and `debtor_code` columns in the CSV will hold the same value.

- **B2C debtor (Particulier)** — the debtor has no VAT number. The `debtor_vat_number` column is empty in the CSV. Instead, a 12-character code is automatically generated from four of the debtor's address fields, taking the **first 3 alphanumeric characters** of each:

  | Source field | Example value | Contribution |
  |---|---|---|
  | Company / full name | `Jean Dupont` | `JEA` |
  | City | `Lyon` | `LYO` |
  | Street address | `12 rue des Lilas` | `12R` |
  | Postal code | `69001` | `690` |
  | **→ debtor_code** | | **`JEALYO12R690`** |

  Special characters, spaces, and accents are stripped before extraction. If a field is shorter than 3 characters, it is padded with `X`. The code updates automatically whenever any of the four source fields is edited.

## Tech stack

- Single-page HTML/CSS/JS app — no build step required
- [pdf.js](https://mozilla.github.io/pdf.js/) for in-browser PDF rendering
- [Claude API](https://www.anthropic.com/) (via a serverless proxy) for AI extraction
- Deployed on [Vercel](https://vercel.com/) — the API key is stored as a server-side environment variable and never exposed to the browser
