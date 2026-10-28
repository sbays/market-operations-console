/**
 * The one seam between the data pack and the app. Everything reads the dataset and fixtures
 * through here, already validated, so swapping in a different pack touches only this module.
 */
import rawDataset from "@/pack/data.json";
import rawFixtures from "@/pack/fixtures.json";
import {
  DatasetSchema,
  FixturesSchema,
  type Dataset,
  type Fixture,
} from "@/domain/schema";

let dataset: Dataset | undefined;
let fixtures: Fixture[] | undefined;

export function loadDataset(): Dataset {
  dataset ??= DatasetSchema.parse(rawDataset);
  return dataset;
}

export function loadFixtures(): Fixture[] {
  fixtures ??= FixturesSchema.parse(rawFixtures);
  return fixtures;
}
