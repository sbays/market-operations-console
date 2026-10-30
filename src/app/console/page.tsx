import { Suspense, use } from "react";
import { DatasetProvider } from "@/data/DatasetProvider";
import { loadDataset, loadFixtures } from "@/data/pack";
import { AlertDialog } from "@/features/alerts/AlertDialog";
import { AlertList } from "@/features/alerts/AlertList";
import { AssistantPanel } from "@/features/assistant/AssistantPanel";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { LiveRegions } from "@/ui/LiveRegions";
import { Toaster } from "@/ui/Toaster";

export default function ConsolePage({ searchParams }: PageProps<"/console">) {
  const suggestedQuestions = loadFixtures()
    .filter((fixture) => fixture.suggested)
    .map((fixture) => fixture.question);

  return (
    <DatasetProvider dataset={loadDataset()}>
      <a href="#main" className="sr-only focus:not-sr-only">
        Skip to main content
      </a>
      <div className="flex min-h-full flex-1 flex-col lg:flex-row">
        <main id="main" className="flex min-w-0 flex-1 flex-col gap-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">Market Operations</h1>
            {/* The form prefills its scope from the URL selection, known only at request time. */}
            <Suspense>
              <AlertDialog />
            </Suspense>
          </div>
          <Suspense fallback={<DashboardSkeleton />}>
            <RequestDashboard searchParams={searchParams} />
          </Suspense>
          <Suspense>
            <AlertList />
          </Suspense>
        </main>
        <div className="border-t lg:w-96 lg:shrink-0 lg:border-t-0 lg:border-l">
          {/* Citation chips read URL state (useDrill), which is only known at request time. */}
          <Suspense>
            <AssistantPanel suggestedQuestions={suggestedQuestions} />
          </Suspense>
        </div>
      </div>
      <Toaster />
      <LiveRegions />
    </DatasetProvider>
  );
}

/**
 * The dashboard depends on the URL, so it can't be in the static shell. Reading the request's
 * search params makes this Suspense hole dynamic: the shell (and the assistant) is served
 * prerendered, and the dashboard is server-rendered for this exact URL and streamed into the
 * same response, instead of waiting for client JavaScript.
 */
function RequestDashboard({
  searchParams,
}: {
  searchParams: PageProps<"/console">["searchParams"];
}) {
  use(searchParams);
  return <Dashboard />;
}

function DashboardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="h-4 w-48 rounded-sm bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((tile) => (
          <div key={tile} className="h-20 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-60 rounded-lg bg-muted" />
    </div>
  );
}
