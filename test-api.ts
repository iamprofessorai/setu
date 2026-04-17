
async function test() {
  const baseUrl = 'https://stock.indianapi.in';
  const endpoints = [
    '/stock?name=Nifty 50',
    '/stock?name=Reliance',
    '/commodities',
    '/news',
    '/ipo',
    '/trending',
    '/indices'
  ];
  for (const path of endpoints) {
    const url = `${baseUrl}${path}`;
    try {
      const res = await fetch(url, { 
        method: 'GET',
        headers: {
          'x-api-key': process.env.INDIAN_API_KEY || ''
        }
      });
      console.log(`${url}: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`Data from ${path}:`, JSON.stringify(data).substring(0, 200));
      }
    } catch (e) {
      console.log(`${url}: Error ${e.message}`);
    }
  }
}
test();
