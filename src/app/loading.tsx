import { SimplePageSkeleton } from "@/components/LoadingSkeleton";

// Root fallback — covers every route without its own loading.tsx
// (geo landing pages, legal, about, faq, contact, …). Server-rendered,
// zero client JS.
export default function Loading() {
  return <SimplePageSkeleton />;
}
