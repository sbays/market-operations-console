import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DatasetProvider } from "./DatasetProvider";
import { loadDataset } from "./pack";
import { useDataset } from "./useDataset";

function RegionCount() {
  return <p>{useDataset().regions.length} regions</p>;
}

describe("useDataset", () => {
  it("reads the dataset the provider holds", () => {
    render(
      <DatasetProvider dataset={loadDataset()}>
        <RegionCount />
      </DatasetProvider>,
    );

    expect(
      screen.getByText(`${loadDataset().regions.length} regions`),
    ).toBeInTheDocument();
  });

  it("says what is wrong when there is no provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useDataset())).toThrow(
      "useDataset needs a DatasetProvider",
    );
  });
});
