import { Suspense } from "react";
import { DatasetHydration, dehydrateDataset } from "@/data/DatasetHydration";
import { loadFixtures } from "@/data/pack";
import { AssistantPanel } from "@/features/assistant/AssistantPanel";

export default async function ConsolePage() {
  const suggestedQuestions = loadFixtures()
    .filter((fixture) => fixture.suggested)
    .map((fixture) => fixture.question);

  return (
    <DatasetHydration state={await dehydrateDataset()}>
      <a href="#main" className="sr-only focus:not-sr-only">
        Skip to main content
      </a>
      <div className="flex min-h-full flex-1 flex-col lg:flex-row">
        <main id="main" className="flex-1 p-6">
          <h1 className="text-xl font-semibold">Market Operations</h1>
        </main>
        <div className="border-t lg:w-96 lg:shrink-0 lg:border-t-0 lg:border-l">
          {/* The panel reads URL state, which is only known at request time. */}
          <Suspense>
            <AssistantPanel suggestedQuestions={suggestedQuestions} />
          </Suspense>
        </div>
      </div>
    </DatasetHydration>
  );
}
