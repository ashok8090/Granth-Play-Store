import { createFileRoute } from "@tanstack/react-router";
import { handleMedia } from "@/lib/granth/proxy.server";

export const Route = createFileRoute("/api/media")({
  server: {
    handlers: {
      GET: ({ request }) => handleMedia(request),
    },
  },
});
