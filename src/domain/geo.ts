/**
 * Geography for the market map: which country each market is, and where it sits on a
 * projected world. Pure, so the map component only draws what these functions return.
 */
import { geoCentroid, geoEqualEarth, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import { z } from "zod";
import worldTopology from "world-atlas/countries-110m.json";
import { ancestorsOf } from "./selectors";
import type { Dataset, EntityRef } from "./schema";

/**
 * Dataset market id (ISO alpha-2) to the numeric id world-atlas writes on each country,
 * zero-padded as the topology has it ("036" is Australia).
 */
export const MARKET_GEO_IDS: Record<string, string> = {
  US: "840",
  CA: "124",
  DE: "276",
  FR: "250",
  GB: "826",
  IT: "380",
  ES: "724",
  JP: "392",
  AU: "036",
  IN: "356",
  BR: "076",
  MX: "484",
};

// Only the parts of TopoJSON the map reads. Zod strips everything else.
const CountryIdSchema = z.union([z.string(), z.number()]);
const PolygonSchema = z.object({
  type: z.literal("Polygon"),
  arcs: z.array(z.array(z.number())),
  id: CountryIdSchema.optional(),
});
const MultiPolygonSchema = z.object({
  type: z.literal("MultiPolygon"),
  arcs: z.array(z.array(z.array(z.number()))),
  id: CountryIdSchema.optional(),
});

export const WorldTopologySchema = z.object({
  type: z.literal("Topology"),
  objects: z.object({
    countries: z.object({
      type: z.literal("GeometryCollection"),
      geometries: z.array(z.union([PolygonSchema, MultiPolygonSchema])),
    }),
  }),
  arcs: z.array(z.array(z.tuple([z.number(), z.number()]))),
  transform: z
    .object({
      scale: z.tuple([z.number(), z.number()]),
      translate: z.tuple([z.number(), z.number()]),
    })
    .optional(),
});

const topology = WorldTopologySchema.parse(worldTopology);

/**
 * Every country as one feature collection. The collection object itself is passed to
 * feature(): a string name would match the Point overload instead.
 */
const countries = feature(topology, topology.objects.countries);

/** Every country in the topology, drawn as the muted base map. */
export const countryFeatures = countries.features;

/** The country a dataset market is drawn as, or undefined if the market has no mapping. */
export function countryOf(marketId: string) {
  const geoId = MARKET_GEO_IDS[marketId];
  if (geoId === undefined) return undefined;
  return countries.features.find((f) => f.id === geoId);
}

/**
 * The market ids under a selection: the selected market (or a product's market), else the
 * markets of the selected region, else every market. The map draws the rest muted.
 */
export function marketsInSelection(
  dataset: Dataset,
  selected: EntityRef,
): Set<string> {
  const chain = ancestorsOf(dataset, selected);
  const marketIds = chain.flatMap((ref) =>
    ref.level === "market" ? [ref.id] : [],
  );
  if (marketIds.length > 0) return new Set(marketIds);

  const regionIds = chain.flatMap((ref) =>
    ref.level === "region" ? [ref.id] : [],
  );
  return new Set(
    dataset.markets
      .filter((m) => regionIds.length === 0 || regionIds.includes(m.regionId))
      .map((m) => m.id),
  );
}

/** An equal-earth world fitted inside a box of the given size. */
export function worldProjection({
  width,
  height,
}: {
  width: number;
  height: number;
}): GeoProjection {
  return geoEqualEarth().fitSize([width, height], countries);
}

/** Where a market's marker sits: the projected centroid of its country. */
export function marketAnchor(
  marketId: string,
  project: GeoProjection,
): [number, number] | undefined {
  const country = countryOf(marketId);
  if (country === undefined) return undefined;
  return project(geoCentroid(country)) ?? undefined;
}
