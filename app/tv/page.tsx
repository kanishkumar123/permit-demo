import type { Metadata, Viewport } from "next";
import { TvBoard } from "@/components/views/tv-board";

export const metadata: Metadata = { title: "TV board" };

export const viewport: Viewport = { themeColor: "#080b12" };

export default function Page() {
  return <TvBoard />;
}
