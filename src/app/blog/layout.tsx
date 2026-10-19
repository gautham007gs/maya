import type { ReactNode } from "react";
import DirectLinkPlacement from "@/components/ads/DirectLinkPlacement";
import SocialBarAdDisplay from "@/components/chat/SocialBarAdDisplay";

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <DirectLinkPlacement placement="blog" />
      <SocialBarAdDisplay page="blog" />
    </>
  );
}
