import { Suspense } from "react";
import Timeline from "@/components/Timeline";

export default function TimelinePage() {
  return (
    <Suspense>
      <Timeline />
    </Suspense>
  );
}
