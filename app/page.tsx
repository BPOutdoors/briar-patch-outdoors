import Image from 'next/image'
import Link from 'next/link'

const categories = [
  {
    name: 'Archery',
    description: 'Bows, arrows, accessories & more',
    image: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=600&q=80',
    href: '/products?category=archery',
  },
  {
    name: 'Hunting',
    description: 'Gear up for the season',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
    href: '/products?category=hunting',
  },
  {
    name: 'Camping',
    description: 'Everything for the outdoors',
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80',
    href: '/products?category=camping',
  },
  {
    name: 'Optics',
    description: 'Scopes, binoculars & rangefinders',
    image: 'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=600&q=80',
    href: '/products?category=optics',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--cream)' }}>

      {/* Navigation */}
      <nav style={{ backgroundColor: '#C4A882', color: '#2C2C2C' }} className="px-6 py-4 shadow-md">
        <div className="max-w-screen-2xl mx-auto flex justify-between items-center">
          <Link href="/">
            <Image src="/logo.png" alt="Briar Patch Outdoors" width={220} height={80} className="object-contain" />
          </Link>
          <div className="hidden md:flex gap-8 text-sm font-semibold uppercase tracking-wide">
            <Link href="/products" className="hover:text-amber-800 transition-colors">Shop</Link>
            <Link href="/products?category=archery" className="hover:text-amber-800 transition-colors">Archery</Link>
            <Link href="/products?category=hunting" className="hover:text-amber-800 transition-colors">Hunting</Link>
            <Link href="/products?category=camping" className="hover:text-amber-800 transition-colors">Camping</Link>
            <Link href="/about" className="hover:text-amber-800 transition-colors">About Us</Link>
            <Link href="/contact" className="hover:text-amber-800 transition-colors">Contact</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/cart" className="hover:text-amber-800 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Banner */}
      <div className="relative h-[580px] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=1600&q=80"
          alt="Outdoor wilderness"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 drop-shadow-lg">
            Your Local Outdoor Outfitter
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-2xl drop-shadow" style={{ color: '#F5C842' }}>
            Premium gear for hunting, archery, camping & more
          </p>
          <Link
            href="/products"
            className="px-10 py-4 text-lg font-bold rounded uppercase tracking-wide transition-colors shadow-lg text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Shop Now
          </Link>
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-screen-2xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-2" style={{ color: 'var(--primary)' }}>
          Shop by Category
        </h2>
        <p className="text-center text-gray-500 mb-10">Everything you need for your next adventure</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat) => (
            <Link key={cat.name} href={cat.href} className="group rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow">
              <div className="relative h-48 overflow-hidden">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
                <h3 className="absolute bottom-3 left-4 text-white text-xl font-bold drop-shadow">{cat.name}</h3>
              </div>
              <div className="p-4" style={{ backgroundColor: 'var(--cream-dark)' }}>
                <p className="text-sm text-gray-600">{cat.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Why Shop With Us */}
      <div style={{ backgroundColor: 'var(--secondary)' }} className="py-16 text-white">
        <div className="max-w-screen-2xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-10">Why Shop With Us</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
            <div>
              <div className="text-5xl mb-4">🦌</div>
              <h3 className="text-xl font-bold mb-2">Local Expertise</h3>
              <p className="text-green-100">We know the land and the seasons. Our staff are hunters and outdoorsmen just like you.</p>
            </div>
            <div>
              <div className="text-5xl mb-4">🏹</div>
              <h3 className="text-xl font-bold mb-2">Pro Shop Services</h3>
              <p className="text-green-100">Bow tuning, gear fitting, and expert advice — come in and let us help you get dialed in.</p>
            </div>
            <div>
              <div className="text-5xl mb-4">🛡️</div>
              <h3 className="text-xl font-bold mb-2">Top Brands</h3>
              <p className="text-green-100">We carry the brands you trust at prices that respect your hard-earned money.</p>
            </div>
          </div>
        </div>
      </div>

      {/* About Snippet */}
      <div className="max-w-screen-2xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1">
          <h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--primary)' }}>
            We&apos;re Your Neighbors
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed mb-6">
            Briar Patch Outdoors is a family-owned outdoor store dedicated to serving our local community of hunters, archers, and outdoor enthusiasts. We believe in personal service, honest advice, and gear that actually works in the field.
          </p>
          <Link
            href="/about"
            className="inline-block px-8 py-3 font-bold rounded uppercase tracking-wide text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Our Story
          </Link>
        </div>
        <div className="flex-1 rounded-lg overflow-hidden shadow-lg h-72">
          <img
            src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80"
            alt="Beautiful outdoors"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Footer */}
      <footer style={{ backgroundColor: 'var(--secondary-dark)', color: 'white' }} className="py-10 mt-8">
        <div className="max-w-screen-2xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <Image src="/logo.png" alt="Briar Patch Outdoors" width={160} height={60} className="object-contain mb-4" />
            <p className="text-sm text-stone-300 leading-relaxed">Your local outdoor outfitter — hunting, archery, camping & more.</p>
          </div>
          <div>
            <h4 className="font-bold text-lg mb-3 text-white">Quick Links</h4>
            <ul className="space-y-2 text-sm text-stone-300">
              <li><Link href="/products" className="hover:text-white transition-colors">Shop All</Link></li>
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-lg mb-3 text-white">Visit Us</h4>
            <p className="text-sm text-stone-300 leading-relaxed">
              Come see us in store for bow tuning,<br />
              gear fitting, and expert advice.<br /><br />
              <a href="mailto:services@briarpatchoutdoors.com" className="hover:text-white transition-colors">
                services@briarpatchoutdoors.com
              </a>
            </p>
          </div>
        </div>
        <div className="text-center text-green-300 text-xs mt-8">
          &copy; {new Date().getFullYear()} Briar Patch Outdoors. All rights reserved.
        </div>
      </footer>

    </div>
  )
}
