import { SimplePageSkeleton } from "@/components/LoadingSkeleton";

// Covers every /legal/* page (privacy, terms, cookie, accessibility, …).
export default function Loading() {
  return <SimplePageSkeleton />;
}
