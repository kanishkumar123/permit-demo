import type { Metadata } from "next";
import { MastersView } from "@/components/views/masters";

export const metadata: Metadata = { title: "Masters" };

export default function Page() {
  return <MastersView />;
}
