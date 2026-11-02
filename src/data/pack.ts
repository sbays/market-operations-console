/**
 * The one seam between the starter pack and the app. Everything reads the dataset and fixtures
 * through here, already validated, so swapping in a different pack touches only this module
 * and the translation it calls (domain/starterPack.ts).
 *
 * Server only: the dataset reaches the client through DatasetProvider, and the fixtures (the
 * mock's canned answers) never leave the server. Importing this from a client component fails
 * the build.
 */
import "server-only";
import rawDataset from "@/pack/data.json";
import rawFixtures from "@/pack/fixtures.json";
import { FixturesSchema, type Dataset, type Fixtures } from "@/domain/schema";
import { datasetFromPack } from "@/domain/starterPack";

let dataset: Dataset | undefined;
let fixtures: Fixtures | undefined;

export function loadDataset(): Dataset {
  dataset ??= datasetFromPack(rawDataset);
  return dataset;
}

export function loadFixtures(): Fixtures {
  fixtures ??= FixturesSchema.parse(rawFixtures);
  return fixtures;
}
