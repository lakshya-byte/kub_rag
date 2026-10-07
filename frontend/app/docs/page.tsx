import type { Metadata } from "next";
import DocsApp from "@/components/docs/DocsApp";

export const metadata: Metadata = {
  title: "Documentation · Enterprise Assistant",
  description: "How the assistant works, from the basic idea to the internals, with interactive demos.",
};

export default function Page() {
  return <DocsApp />;
}
