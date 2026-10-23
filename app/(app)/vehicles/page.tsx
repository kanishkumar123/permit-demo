import type { Metadata } from "next";
import { VehiclesView } from "@/components/views/vehicles";

export const metadata: Metadata = { title: "Vehicles" };

export default function Page() {
  return <VehiclesView />;
}
