import { Suspense } from "react";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { getCurrentUser } from "@/lib/data/dashboard";
import { getPipelineCards } from "@/lib/data/pipeline";

async function PipelineBoardData() {
  const user = await getCurrentUser();
  const tenantId = (user?.user_metadata?.tenant_id as string) ?? "anonymous";

  const cards = await getPipelineCards(tenantId);

  return <PipelineBoard initialCards={cards} />;
}

function PipelineSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="min-w-[260px] h-[400px] rounded-xl bg-white/5 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-4">Pipeline</h1>
      <Suspense fallback={<PipelineSkeleton />}>
        <PipelineBoardData />
      </Suspense>
    </div>
  );
}
