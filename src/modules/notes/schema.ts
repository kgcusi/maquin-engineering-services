import { z } from "zod";

// Reusable note-body validator — composed into each consumer's add-note schema
// (e.g. clients) alongside the parent entity id.
export const noteBodyField = z
  .string()
  .trim()
  .min(1, "Write a note first.")
  .max(2000, "Note is too long.");
