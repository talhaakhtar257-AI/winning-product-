// Competitor & ad research: deep links into the places sellers actually
// check, pre-filled with the product keyword. No scraping — links only.

export interface ResearchLink {
  group: 'Ads' | 'Marketplaces' | 'Suppliers' | 'Demand';
  label: string;
  url: string;
}

export function researchLinks(keyword: string, market: 'Global' | 'Pakistan'): ResearchLink[] {
  const k = encodeURIComponent(keyword.trim().slice(0, 80));
  const country = market === 'Pakistan' ? 'PK' : 'US';
  const links: ResearchLink[] = [
    { group: 'Ads', label: 'Facebook Ad Library', url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&q=${k}&search_type=keyword_unordered` },
    { group: 'Ads', label: 'TikTok Creative Center', url: `https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?keyword=${k}&region=${country}` },
    { group: 'Ads', label: 'TikTok videos', url: `https://www.tiktok.com/search?q=${k}` },
    { group: 'Ads', label: 'YouTube reviews', url: `https://www.youtube.com/results?search_query=${k}+review` },
    { group: 'Demand', label: 'Google Trends', url: `https://trends.google.com/trends/explore?date=today%2012-m&geo=${country}&q=${k}` },
    { group: 'Suppliers', label: 'AliExpress', url: `https://www.aliexpress.com/wholesale?SearchText=${k}` },
    { group: 'Suppliers', label: 'Alibaba / 1688 (bulk)', url: `https://www.alibaba.com/trade/search?SearchText=${k}` },
  ];
  if (market === 'Pakistan') {
    links.push(
      { group: 'Marketplaces', label: 'Daraz.pk', url: `https://www.daraz.pk/catalog/?q=${k}` },
      { group: 'Marketplaces', label: 'Facebook Marketplace', url: `https://www.facebook.com/marketplace/search/?query=${k}` },
      { group: 'Marketplaces', label: 'Google Shopping PK', url: `https://www.google.com/search?tbm=shop&gl=pk&q=${k}` },
    );
  } else {
    links.push(
      { group: 'Marketplaces', label: 'Amazon', url: `https://www.amazon.com/s?k=${k}` },
      { group: 'Marketplaces', label: 'Google Shopping', url: `https://www.google.com/search?tbm=shop&q=${k}` },
      { group: 'Marketplaces', label: 'Etsy', url: `https://www.etsy.com/search?q=${k}` },
    );
  }
  return links;
}
