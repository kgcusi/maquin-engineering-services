import type { ImportDescriptor } from "@/modules/shared/import";

import { createSupplierSchema, type CreateSupplierInput } from "./schema";

export const supplierImportDescriptor: ImportDescriptor<CreateSupplierInput> = {
  entity: "Supplier",
  noun: "suppliers",
  rowSchema: createSupplierSchema,
  dedupeKey: "name",
  columns: [
    {
      key: "name",
      header: "Name",
      aliases: ["Supplier", "Supplier Name", "Vendor"],
      required: true,
      description: "Supplier or vendor name.",
      example: "Pacific Hardware Supply",
    },
    {
      key: "contactPerson",
      header: "Contact Person",
      aliases: ["Contact"],
      description: "Main point of contact.",
      example: "Jose Cruz",
    },
    {
      key: "phone",
      header: "Phone",
      aliases: ["Mobile", "Contact No"],
      description: "Phone or mobile number.",
      example: "+63 2 8123 4567",
    },
    {
      key: "email",
      header: "Email",
      aliases: ["Email Address"],
      description: "Email address (must be valid if provided).",
      example: "sales@pacifichardware.com",
    },
    {
      key: "address",
      header: "Address",
      description: "Business address.",
      example: "88 Quezon Ave, Quezon City",
    },
    {
      key: "tin",
      header: "TIN",
      aliases: ["Tax ID", "Tax Identification Number"],
      description: "Taxpayer identification number.",
      example: "123-456-789-000",
    },
    {
      key: "paymentTerms",
      header: "Payment Terms",
      aliases: ["Terms"],
      description: "Agreed payment terms.",
      example: "30 days",
    },
    {
      key: "notes",
      header: "Remarks",
      aliases: ["Notes"],
      description: "Any extra remarks.",
      example: "Preferred for cement",
    },
  ],
};
