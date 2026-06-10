import Image from 'next/image'
import Link from 'next/link'

export default function Nav() {
  return (
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
  )
}
