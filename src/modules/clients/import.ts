import type { ImportDescriptor } from "@/modules/shared/import";

import { createClientSchema, type CreateClientInput } from "./schema";

// Maps spreadsheet columns onto the client create schema. Validity is the schema's
// job; this just names the columns, their aliases, and a friendly example.
export const clientImportDescriptor: ImportDescriptor<CreateClientInput> = {
  entity: "Client",
  noun: "clients",
  rowSchema: createClientSchema,
  dedupeKey: "name",
  columns: [
    {
      key: "name",
      header: "Name",
      aliases: ["Client", "Client Name", "Company"],
      required: true,
      description: "Company or client name.",
      example: "Acme Construction Corp.",
    },
    {
      key: "contactPerson",
      header: "Contact Person",
      aliases: ["Contact"],
      description: "Main point of contact.",
      example: "Maria Santos",
    },
    {
      key: "phone",
      header: "Phone",
      aliases: ["Mobile", "Contact No"],
      description: "Phone or mobile number.",
      example: "+63 917 123 4567",
    },
    {
      key: "email",
      header: "Email",
      aliases: ["Email Address"],
      description: "Email address (must be valid if provided).",
      example: "maria@acme.com",
    },
    {
      key: "address",
      header: "Address",
      description: "Office or site address.",
      example: "12 Ayala Ave, Makati City",
    },
    {
      key: "notes",
      header: "Remarks",
      aliases: ["Notes"],
      description: "Any extra remarks.",
      example: "Referred by ABC Realty",
    },
  ],
};
