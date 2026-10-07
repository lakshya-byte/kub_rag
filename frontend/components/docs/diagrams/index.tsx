"use client";

import type { DiagramName } from "@/docs/types";
import Architecture from "./Architecture";
import ChunkingLab from "./ChunkingLab";
import EvalCharts from "./EvalCharts";
import GatewayFlow from "./GatewayFlow";
import GuardrailLab from "./GuardrailLab";
import Lifecycle from "./Lifecycle";
import Memory from "./Memory";
import Retrieval from "./Retrieval";

export function Diagram({ name }: { name: DiagramName }) {
  switch (name) {
    case "tracer":
      return <Lifecycle mode="tracer" />;
    case "lifecycle":
      return <Lifecycle mode="detailed" />;
    case "architecture":
      return <Architecture />;
    case "chunking":
      return <ChunkingLab />;
    case "retrieval":
      return <Retrieval />;
    case "memory":
      return <Memory />;
    case "guardrails":
      return <GuardrailLab />;
    case "gateway":
      return <GatewayFlow />;
    case "evals":
      return <EvalCharts />;
  }
}
