export const MOCK_DISTRIBUTIONS = [
  { id: 'E1C5YSQD0KFMCM', label: 'advicegenie.com.au',      domainName: 'd22k1fffwiz9a9.cloudfront.net', status: 'Deployed', enabled: true },
  { id: 'E1NBX4FPI2AYJ5', label: 'cognifylabs.ai',          domainName: 'd3uffchzceyso9.cloudfront.net', status: 'Deployed', enabled: true },
  { id: 'E2R300A901V4FK', label: 'cognifylabs.com.au',      domainName: 'd13lyp2o5kgtsk.cloudfront.net', status: 'Deployed', enabled: true },
  { id: 'E1S56TQFE5QGW0', label: 'advicelab.com.au',        domainName: 'dslg1e0z2y9yh.cloudfront.net',  status: 'Deployed', enabled: true },
  { id: 'E29KA1PXOT2G91', label: 'ats-dev.advicelab.com.au',domainName: 'd3ofehpqyo939c.cloudfront.net', status: 'Deployed', enabled: true },
]

export const MOCK_METRICS = {
  totalRequests:         14872,
  uniqueIps:             3241,
  cacheHits:             11230,
  cacheMisses:           3642,
  cacheHitRatio:         75.5,
  bandwidth:             8472836204,
  avgResponseTimeMs:     48.3,
  previousPeriodRequests:13200,

  statusGroups:   { '2xx': 13100, '3xx': 920, '4xx': 720, '5xx': 132 },

  requestsOverTime: Array.from({ length: 24 }, (_, i) => ({
    timestamp: `2024-01-15T${String(i).padStart(2, '0')}:00:00Z`,
    count: Math.floor(300 + Math.random() * 900),
  })),

  topUserAgents: [
    { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120', count: 4210 },
    { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Version/17.0',    count: 3180 },
    { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',       count: 2890 },
    { userAgent: 'Googlebot/2.1 (+http://www.google.com/bot.html)',                                count: 1240 },
    { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120',                 count: 980  },
    { userAgent: 'python-requests/2.31.0',                                                         count: 540  },
    { userAgent: 'curl/7.88.1',                                                                    count: 210  },
    { userAgent: 'AHC/2.1',                                                                        count: 180  },
    { userAgent: 'Go-http-client/2.0',                                                             count: 140  },
    { userAgent: 'Bingbot/2.0',                                                                    count: 102  },
  ],

  topUrls: [
    { url: '/',                          count: 4820 },
    { url: '/api/rates',                 count: 2310 },
    { url: '/about',                     count: 1240 },
    { url: '/careers',                   count: 980  },
    { url: '/assets/main.js',            count: 870  },
    { url: '/api/health',                count: 760  },
    { url: '/favicon.ico',               count: 640  },
    { url: '/robots.txt',                count: 590  },
    { url: '/sitemap.xml',               count: 430  },
    { url: '/api/subscribe',             count: 310  },
  ],

  topIps: [
    { ip: '203.0.113.42',  count: 1842 },
    { ip: '198.51.100.77', count: 920  },
    { ip: '192.0.2.15',    count: 640  },
    { ip: '203.0.113.8',   count: 530  },
    { ip: '198.51.100.3',  count: 480  },
    { ip: '192.0.2.201',   count: 310  },
    { ip: '203.0.113.99',  count: 270  },
    { ip: '198.51.100.55', count: 240  },
    { ip: '192.0.2.88',    count: 190  },
    { ip: '203.0.113.11',  count: 150  },
  ],

  topReferrers: [
    { referrer: 'direct',           count: 6420 },
    { referrer: 'google.com',       count: 3810 },
    { referrer: 'facebook.com',     count: 1240 },
    { referrer: 'linkedin.com',     count: 870  },
    { referrer: 'bing.com',         count: 640  },
    { referrer: 'twitter.com',      count: 430  },
    { referrer: 'reddit.com',       count: 380  },
    { referrer: 'github.com',       count: 290  },
    { referrer: 'duckduckgo.com',   count: 210  },
    { referrer: 'yahoo.com',        count: 180  },
  ],

  topEdgeLocations: [
    { location: 'SYD', count: 7420 },
    { location: 'MEL', count: 2810 },
    { location: 'SIN', count: 1240 },
    { location: 'LAX', count: 870  },
    { location: 'NRT', count: 640  },
    { location: 'LHR', count: 530  },
    { location: 'IAD', count: 480  },
    { location: 'FRA', count: 310  },
  ],

  protocolSplit: { 'HTTPS': 14320, 'HTTP': 552 },

  httpVersions: { 'HTTP/2.0': 10840, 'HTTP/1.1': 3120, 'HTTP/3.0': 912 },

  botVsHuman: { bot: 2482, human: 12390 },

  peakHour: { hour: '2024-01-15T14:00:00Z', count: 1240 },
}

export const MOCK_GEO = {
  countries: [
    { country: 'AU', countryName: 'Australia',      lat: -25.3, lon: 133.8, count: 7420 },
    { country: 'US', countryName: 'United States',  lat: 38.9,  lon: -77.0, count: 2810 },
    { country: 'GB', countryName: 'United Kingdom', lat: 51.5,  lon: -0.1,  count: 980  },
    { country: 'SG', countryName: 'Singapore',      lat: 1.3,   lon: 103.8, count: 760  },
    { country: 'IN', countryName: 'India',          lat: 20.6,  lon: 78.9,  count: 640  },
    { country: 'NZ', countryName: 'New Zealand',    lat: -40.9, lon: 174.9, count: 530  },
    { country: 'DE', countryName: 'Germany',        lat: 51.2,  lon: 10.5,  count: 410  },
    { country: 'CA', countryName: 'Canada',         lat: 56.1,  lon: -106.3,count: 380  },
    { country: 'JP', countryName: 'Japan',          lat: 36.2,  lon: 138.3, count: 290  },
    { country: 'FR', countryName: 'France',         lat: 46.2,  lon: 2.2,   count: 240  },
    { country: 'NL', countryName: 'Netherlands',    lat: 52.1,  lon: 5.3,   count: 180  },
    { country: 'ZA', countryName: 'South Africa',   lat: -30.6, lon: 22.9,  count: 120  },
  ],
}
