import type { Metadata } from 'next';
import GeoPageTemplate from '@/components/geo/GeoPageTemplate';
import { buildGeoPageMetadata, PAGE_CONFIGS } from '@/lib/geo-page-configs';

export const metadata: Metadata = buildGeoPageMetadata('es');

export default function SpainGeoPage() {
  return <GeoPageTemplate config={PAGE_CONFIGS.es} />;
}
