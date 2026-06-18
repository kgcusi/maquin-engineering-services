import { EMPLOYMENT_TYPES, RATE_UNITS } from "@/lib/lookups";
import {
  codeResolver,
  normalizeAmount,
  normalizeDate,
  type ImportDescriptor,
} from "@/modules/shared/import";

import { createEmployeeSchema, type CreateEmployeeInput } from "./schema";

const employmentTypeCode = codeResolver(EMPLOYMENT_TYPES);
const rateUnitCode = codeResolver(RATE_UNITS);

export const employeeImportDescriptor: ImportDescriptor<CreateEmployeeInput> = {
  entity: "Employee",
  noun: "employees",
  rowSchema: createEmployeeSchema,
  dedupeKey: "fullName",
  columns: [
    {
      key: "fullName",
      header: "Full Name",
      aliases: ["Name", "Employee Name"],
      required: true,
      description: "The person's full name.",
      example: "Pedro Reyes",
    },
    {
      key: "position",
      header: "Position",
      aliases: ["Role", "Title"],
      description: "Job title or role.",
      example: "Site Engineer",
    },
    {
      key: "employmentType",
      header: "Employment Type",
      aliases: ["Type"],
      description: "One of: Regular, Probationary, Project-based, Contractual.",
      example: "Regular",
      normalize: employmentTypeCode,
    },
    {
      key: "dateHired",
      header: "Date Hired",
      aliases: ["Hire Date", "Date Started"],
      description: "Date hired, formatted YYYY-MM-DD.",
      example: "2026-01-15",
      normalize: normalizeDate,
    },
    {
      key: "phone",
      header: "Phone",
      aliases: ["Mobile", "Contact No"],
      description: "Phone or mobile number.",
      example: "+63 917 765 4321",
    },
    {
      key: "email",
      header: "Email",
      aliases: ["Email Address"],
      description: "Email address (must be valid if provided).",
      example: "pedro.reyes@example.com",
    },
    {
      key: "address",
      header: "Address",
      description: "Home address.",
      example: "5 Mabini St, Pasig City",
    },
    {
      key: "rate",
      header: "Pay Rate",
      aliases: ["Rate", "Salary"],
      description: "Pay rate amount, numbers only.",
      example: "850.00",
      normalize: normalizeAmount,
    },
    {
      key: "rateUnit",
      header: "Rate Basis",
      aliases: ["Rate Unit", "Pay Basis"],
      description: "One of: Daily, Monthly, Hourly. Defaults to Daily if blank.",
      example: "Daily",
      normalize: (cell) => (cell.trim() ? rateUnitCode(cell) : "DAILY"),
    },
    {
      key: "notes",
      header: "Remarks",
      aliases: ["Notes"],
      description: "Any extra remarks.",
      example: "Assigned to Bridge Project",
    },
  ],
};
