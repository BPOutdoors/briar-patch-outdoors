import Link from 'next/link'
import Nav from './components/Nav'
import Footer from './components/Footer'

const categories = [
  {
    name: 'Archery',
    description: 'Bows, arrows, accessories & more',
    image:'https://images.unsplash.com/photo-1511884642898-4c92249e20b6?w=600&q=80',
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

      <Nav />

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
            href="/shop"
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

      <Footer />

    </div>
  )
}
