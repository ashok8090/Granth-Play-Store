import { createFileRoute } from "@tanstack/react-router";
import { handleCatalog } from "@/lib/granth/proxy.server";

export const Route = createFileRoute("/api/granth")({
  server: {
    handlers: {
      GET: ({ request }) => handleCatalog(request),
    },
  },
});
