import { z } from "zod";

export const publicationStatusSchema = z.enum([
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);

export type PublicationStatus = z.infer<typeof publicationStatusSchema>;
