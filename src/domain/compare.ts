/**
 * Which entities the radar compares. The URL's `compare` paths are a request; this decides
 * what is shown, so the radar, the checkboxes and the next toggle all agree.
 */
import type { Dataset, EntityRef } from "./schema";
import { childrenOf, pathOf } from "./selectors";

/** The most entities the radar compares at once. */
export const MAX_COMPARE = 4;

/**
 * The compared entities: the selection's children that `paths` names, once each and in URL
 * order, else the first children. Paths that aren't children (stale, or from before a drill)
 * are ignored, so the radar never mixes levels.
 */
export function comparedRefs(
  dataset: Dataset,
  selected: EntityRef,
  paths: string[],
): EntityRef[] {
  const children = childrenOf(dataset, selected);
  const byPath = new Map(
    children.map((ref) => [pathOf(dataset, ref), ref] as const),
  );
  const named = [...new Set(paths)].flatMap((path) => {
    const ref = byPath.get(path);
    return ref === undefined ? [] : [ref];
  });
  return (named.length > 0 ? named : children).slice(0, MAX_COMPARE);
}

/**
 * The paths to write after ticking or unticking `ref`. They start from what is shown, so the
 * first tick keeps the default comparison instead of replacing it. Additions past
 * MAX_COMPARE are ignored.
 */
export function toggleCompared(
  dataset: Dataset,
  compared: EntityRef[],
  ref: EntityRef,
): string[] {
  const paths = compared.flatMap((r) => pathOf(dataset, r) ?? []);
  const path = pathOf(dataset, ref);
  if (path === undefined) return paths;
  if (paths.includes(path)) return paths.filter((p) => p !== path);
  return paths.length < MAX_COMPARE ? [...paths, path] : paths;
}
