import { EntityPathSchema, type EntityPath } from "@/domain/schema";

/** A literal path in a test. App code gets paths from pathOf. */
export function entityPath(path: string): EntityPath {
  return EntityPathSchema.parse(path);
}
