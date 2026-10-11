const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const n = await p.communityListing.count()
  if (n > 0) {
    console.log('community listings already', n)
    return
  }
  await p.communityListing.createMany({
    data: [
      {
        accountId: 'DEMO-1001',
        title: '12x iPhone 12 64GB Grade B - mixed colors',
        description: 'Unlocked units, light wear. Happy to work with Equarios on buyer match.',
        category: 'Phones',
        manufacturer: 'Apple',
        model: 'iPhone 12',
        capacity: '64GB',
        grade: 'B',
        qty: 12,
        price: 145,
        currency: 'USD',
        imageUrl:
          'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=800&q=70',
        status: 'live',
        featured: true,
        publishedAt: new Date(),
      },
      {
        accountId: 'RETAIL-1001',
        title: '8x Galaxy Tab A8 - ask for best offer',
        description: 'Retail overstock. Prefer bulk pickup Hong Kong.',
        category: 'Tablets',
        manufacturer: 'Samsung',
        model: 'Tab A8',
        capacity: '64GB',
        grade: 'A',
        qty: 8,
        price: null,
        currency: 'USD',
        status: 'live',
        featured: false,
        publishedAt: new Date(),
      },
      {
        accountId: 'DEMO-1001',
        title: '5x Pixel 7 128GB pending review',
        description: 'Sample pending listing for staff queue.',
        category: 'Phones',
        manufacturer: 'Google',
        model: 'Pixel 7',
        capacity: '128GB',
        grade: 'A',
        qty: 5,
        price: 210,
        status: 'pending',
      },
    ],
  })
  console.log('seeded 3 community listings')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => p.$disconnect())
