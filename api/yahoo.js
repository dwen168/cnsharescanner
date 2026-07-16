export default async function handler(req, res) {
  // Add CORS headers manually to enable flexibility
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { symbol, period = '3mo', interval = '1d' } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  const targets = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${period}&interval=${interval}`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${period}&interval=${interval}`
  ];

  let success = false;
  let lastError = '';

  for (const target of targets) {
    try {
      const response = await fetch(target, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://finance.yahoo.com/',
          'Accept': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
        return res.status(200).json(data);
      } else {
        lastError = `Status ${response.status} ${response.statusText}`;
      }
    } catch (error) {
      lastError = error.message;
    }
  }

  return res.status(502).json({ error: `Failed to connect to Yahoo Finance servers. Error: ${lastError}` });
}
