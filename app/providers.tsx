"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session; created in state so server renders don't share a cache between requests.
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } }));
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
