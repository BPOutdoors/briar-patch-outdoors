'use client'

import { useCart } from '@/lib/cart-context'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function CartDrawer() {
  const { items, removeItem, updateQty, subtotal, itemCount, isOpen, closeCart } = useCart()
  const router = useRouter()

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={closeCart} />
      )}

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#e5e7eb' }}>
          <h2 className="font-bold text-base" style={{ color: 'var(--primary)' }}>
            Your Cart {itemCount > 0 && <span className="text-sm font-normal text-gray-400">({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>}
          </h2>
          <button onClick={closeCart} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto py-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 px-6">
              <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="font-semibold text-sm">Your cart is empty</p>
              <button onClick={() => { closeCart(); router.push('/shop') }}
                className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--primary)' }}>
                Browse Products
              </button>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="flex gap-3 px-5 py-4 border-b" style={{ borderColor: '#f3f4f6' }}>
                {/* Image */}
                <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                  {item.image_url && item.image_url !== 'none' ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-contain p-1" />
                  ) : (
                    <span className="text-xs text-gray-300">No img</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {item.brand && <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{item.brand}</p>}
                  <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: '#1a1a1a' }}>{item.name}</p>
                  {!item.in_stock && (
                    <p className="text-xs text-amber-600 font-semibold mt-0.5">Ships when available</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    {/* Qty */}
                    <div className="flex items-center border rounded-lg overflow-hidden text-sm" style={{ borderColor: '#e5e7eb' }}>
                      <button onClick={() => updateQty(item.id, item.quantity - 1)}
                        className="px-2 py-1 hover:bg-gray-50 text-gray-500 font-bold">−</button>
                      <span className="px-2 py-1 font-semibold min-w-[1.5rem] text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, item.quantity + 1)}
                        className="px-2 py-1 hover:bg-gray-50 text-gray-500 font-bold">+</button>
                    </div>
                    <p className="font-bold text-sm" style={{ color: 'var(--primary)' }}>
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Remove */}
                <button onClick={() => removeItem(item.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors self-start mt-0.5 text-lg leading-none">×</button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t px-5 py-4" style={{ borderColor: '#e5e7eb' }}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-bold">${subtotal.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-400 mb-4">Shipping & tax calculated at checkout</p>
            <button
              onClick={() => { closeCart(); router.push('/checkout') }}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)' }}>
              Checkout — ${subtotal.toFixed(2)}
            </button>
            <button onClick={() => { closeCart(); router.push('/shop') }}
              className="w-full py-2 mt-2 text-sm font-semibold text-center transition-colors hover:underline"
              style={{ color: 'var(--primary)' }}>
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  )
}
