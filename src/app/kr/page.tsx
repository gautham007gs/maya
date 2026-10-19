import type { Metadata } from 'next';
import GeoPageTemplate from '@/components/geo/GeoPageTemplate';
import { buildGeoPageMetadata, PAGE_CONFIGS } from '@/lib/geo-page-configs';

export const metadata: Metadata = buildGeoPageMetadata('kr');

export default function KoreaGeoPage() {
  return <GeoPageTemplate config={PAGE_CONFIGS.kr} />;
}
