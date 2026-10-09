import { createFileRoute } from "@tanstack/react-router";
import { GranthApp } from "@/components/granth/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <GranthApp />;
}
