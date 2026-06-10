import Image from 'next/image'
import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{ backgroundColor: 'var(--secondary-dark)', color: 'white' }} className="py-10 mt-8">
      <div className="max-w-screen-2xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
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
            104 Dennis Station Rd, Unit B<br />
            Eatonton, GA 31024<br /><br />
            <a href="tel:+17067496994" className="hover:text-white transition-colors">(706) 749-6994</a><br />
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
  )
}
