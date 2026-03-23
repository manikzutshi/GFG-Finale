import React from "react";
import type { TraceStep } from "@veritas/shared";
import clsx from "clsx";

const STAGES = [
  { key: "extracting", label: "Extracting factual claims" },
  { key: "searching", label: "Searching live evidence" },
  { key: "verifying", label: "Verifying against sources" }
] as const;

export function PipelineStatus({
  loading,
  activeStage,
  trace
}: {
  loading: boolean;
  activeStage: number;
  trace?: TraceStep[];
}) {
  const traceMap = new Map(trace?.map((step) => [step.stage, step]) ?? []);

  return (
    <div className="panel pipeline-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h3>Verification stages</h3>
        </div>
      </div>

      <div className="pipeline-list">
        {STAGES.map((stage, index) => {
          const completed = Boolean(traceMap.get(stage.key));
          const isActive = loading ? index === activeStage : false;
          const duration = traceMap.get(stage.key)?.duration_ms;

          return (
            <div
              key={stage.key}
              className={clsx("pipeline-item", {
                "pipeline-item-active": isActive,
                "pipeline-item-complete": completed
              })}
            >
              <div className="pipeline-dot" aria-hidden="true" />
              <div>
                <p>{stage.label}</p>
                <span>
                  {completed ? `${duration} ms` : isActive ? "In progress" : loading ? "Queued" : "Idle"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
