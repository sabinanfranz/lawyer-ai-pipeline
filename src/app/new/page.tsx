import { Suspense } from "react";
import NewPageClient from "./NewPageClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewPageClient />
    </Suspense>
  );
}
