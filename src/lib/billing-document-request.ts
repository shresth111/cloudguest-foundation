/**
 * The JSON body for POST/PUT /billing-documents and POST
 * /billing-documents/preview, kept apart from the service so
 * scripts/test-billing-documents.mjs can pin its exact shape without
 * bundling the API client. The backend schemas are `extra="forbid"`: a
 * renamed or flattened key here is a 422, never a silently-dropped value.
 */
import type { BillingDocumentInput } from "@/types/billing-document";

export const orNull = (value: string) => (value.trim() ? value.trim() : null);

/** The request body, shared by create / update / preview. `includeType` is
 * false for update: the type is fixed at creation and the update schema
 * rejects the field. */
export function toRequestBody(input: BillingDocumentInput, includeType = true) {
  const isQuotation = input.documentType === "quotation";
  return {
    ...(includeType ? { document_type: input.documentType } : {}),
    document_number: orNull(input.documentNumber),
    issue_date: input.issueDate,
    valid_until: isQuotation ? orNull(input.validUntil) : null,
    due_date: isQuotation ? null : orNull(input.dueDate),
    organization_id: input.organizationId,
    bill_to: {
      name: input.billTo.name.trim(),
      address: orNull(input.billTo.address),
      gstin: orNull(input.billTo.gstin),
      email: orNull(input.billTo.email),
      phone: orNull(input.billTo.phone),
    },
    place_of_supply: orNull(input.placeOfSupply),
    tax_mode: input.taxMode,
    round_total: input.roundTotal,
    currency: input.currency,
    lines: input.lines.map((line) => ({
      description: line.description.trim(),
      hsn_sac: orNull(line.hsnSac),
      unit: orNull(line.unit),
      quantity: line.quantity,
      rate: line.rate,
      discount_percent: line.discountPercent,
      tax_rate: line.taxRate,
    })),
    notes: orNull(input.notes),
    terms: orNull(input.terms),
  };
}
