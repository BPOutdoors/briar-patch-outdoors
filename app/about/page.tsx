import Image from 'next/image'
import Link from 'next/link'

export default function AboutPage() {
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

      {/* Hero */}
      <div className="relative h-64 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=1600&q=80"
          alt="Outdoors"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="text-5xl font-bold text-white drop-shadow-lg">Our Story</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-screen-2xl mx-auto px-6 py-16">

        {/* Owner Photo + Bio */}
        <div className="flex flex-col md:flex-row items-center gap-12 mb-16">

          {/* Photo Placeholder */}
          <div className="flex-shrink-0">
            <div
              className="w-72 h-96 rounded-lg shadow-lg flex flex-col items-center justify-center text-center p-6"
              style={{ backgroundColor: 'var(--cream-dark)', border: '2px dashed #C4A882' }}
            >
              <div className="text-6xl mb-4">📷</div>
              <p className="text-gray-500 text-sm font-medium">Photo of Blake & Ashley</p>
              <p className="text-gray-400 text-xs mt-2">Coming soon</p>
            </div>
          </div>

          {/* Bio */}
          <div className="flex-1">
            <h2 className="text-4xl font-bold mb-2" style={{ color: 'var(--primary)' }}>
              Meet Blake & Ashley
            </h2>
            <p className="text-lg mb-1" style={{ color: 'var(--accent)' }}>
              Owners — Briar Patch Outdoors, Eatonton, GA
            </p>
            <div className="w-16 h-1 rounded mb-6" style={{ backgroundColor: 'var(--secondary)' }} />

            <p className="text-gray-600 text-lg leading-relaxed mb-4">
              Briar Patch Outdoors was born out of a passion for the outdoors and a love for this community. Blake is an Eatonton native who grew up hunting these Georgia woods and knows this land like the back of his hand. A lifelong hunter with a deep passion for saddle hunting and archery, he brings real-world expertise to every product we carry and every conversation we have with our customers.
            </p>
            <p className="text-gray-600 text-lg leading-relaxed mb-4">
              Ashley originally came from Atlanta, but after moving to Eatonton she fully embraced the country lifestyle — and never looked back. Together they&apos;re raising four kids in the heart of Georgia, instilling in them the same love of the land that brought this store to life.
            </p>
            <p className="text-gray-600 text-lg leading-relaxed">
              Our goal is simple: build a strong, tight-knit hunting community right here in Putnam County — a local place where hunters, archers, and outdoor enthusiasts of all skill levels can come for gear, advice, and a friendly face who genuinely cares about your time in the field.
            </p>
          </div>
        </div>

        {/* Values */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="p-8 rounded-lg shadow text-center" style={{ backgroundColor: 'var(--cream-dark)' }}>
            <div className="text-5xl mb-4">🦌</div>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--primary)' }}>Born & Raised Here</h3>
            <p className="text-gray-600">We&apos;re not a big box store. We&apos;re your neighbors — people who hunt the same land and care about the same things you do.</p>
          </div>
          <div className="p-8 rounded-lg shadow text-center" style={{ backgroundColor: 'var(--cream-dark)' }}>
            <div className="text-5xl mb-4">🏹</div>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--primary)' }}>Real Expertise</h3>
            <p className="text-gray-600">Blake&apos;s passion for saddle hunting and archery means you get advice from someone who&apos;s actually been in the field with the gear we sell.</p>
          </div>
          <div className="p-8 rounded-lg shadow text-center" style={{ backgroundColor: 'var(--cream-dark)' }}>
            <div className="text-5xl mb-4">🤝</div>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--primary)' }}>Community First</h3>
            <p className="text-gray-600">We&apos;re building something bigger than a store — a community of outdoor enthusiasts who support each other and this way of life.</p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-12 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
          <h2 className="text-3xl font-bold text-white mb-4">Come See Us In Store</h2>
          <p className="text-green-100 text-lg mb-8 max-w-xl mx-auto">
            Stop by and say hello. Whether you need gear, advice, or just want to talk hunting — our door is always open.
          </p>
          <Link
            href="/contact"
            className="inline-block px-10 py-4 font-bold rounded uppercase tracking-wide text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Find Us
          </Link>
        </div>

      </div>

      {/* Footer */}
      <footer style={{ backgroundColor: 'var(--secondary-dark)', color: 'white' }} className="py-10 mt-8">
        <div className="max-w-screen-2xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-16">
          <div>
            <Image src="/logo.png" alt="Briar Patch Outdoors" width={160} height={60} className="object-contain mb-4" />
            <p className="text-stone-300 text-sm">Your local outdoor outfitter — hunting, archery, camping & more.</p>
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
        <div className="text-center text-stone-400 text-xs mt-8">
          &copy; {new Date().getFullYear()} Briar Patch Outdoors. All rights reserved.
        </div>
      </footer>

    </div>
  )
}
