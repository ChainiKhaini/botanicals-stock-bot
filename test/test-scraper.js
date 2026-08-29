/**
 * Test script to inspect product keys, URL formats, and pagination
 */
async function testScraperFull() {
  const storeUrl = 'https://79b5e8ea-9db5-4e7f-bbf4-ba7bbf739236.onlinestore.godaddy.com/api/v2/products?page=1&per_page=5';
  const res = await fetch(storeUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*'
    }
  });

  const data = await res.json();
  console.log('Sample Product Full Keys & Values:');
  console.log(JSON.stringify(data.products[0], null, 2));

  console.log('\n--- First 5 products stock status ---');
  data.products.forEach(p => {
    console.log(`[${p.in_stock ? 'IN STOCK' : 'OUT OF STOCK'}] ID: ${p.id} | Name: ${p.name.slice(0, 60)}... | Price: ${p.price?.display} | Slug: ${p.slug}`);
  });
}

testScraperFull().catch(console.error);
