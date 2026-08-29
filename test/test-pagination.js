/**
 * Test pagination limits and total products traversal
 */
async function testPagination() {
  const perPage = 100;
  const storeUrl = `https://79b5e8ea-9db5-4e7f-bbf4-ba7bbf739236.onlinestore.godaddy.com/api/v2/products?page=1&per_page=${perPage}`;
  const res = await fetch(storeUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
  });

  const data = await res.json();
  console.log(`With per_page=${perPage}: count=${data.count}, total_count=${data.total_count}, pages=${data.pages}, products returned=${data.products?.length}`);

  let totalInStock = 0;
  let totalOutOfStock = 0;
  data.products.forEach(p => {
    if (p.in_stock) totalInStock++;
    else totalOutOfStock++;
  });
  console.log(`Page 1 (100 items): In Stock = ${totalInStock}, Out of Stock = ${totalOutOfStock}`);
}

testPagination().catch(console.error);
