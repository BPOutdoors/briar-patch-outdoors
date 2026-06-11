'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const GA_TAX_RATE = 0.08

const BILL_DENOMS = [
  { value: 100, label: '$100' }, { value: 50, label: '$50' }, { value: 20, label: '$20' },
  { value: 10, label: '$10' }, { value: 5, label: '$5' }, { value: 1, label: '$1' },
]
const COIN_DENOMS = [
  { cents: 50, label: '50¢' }, { cents: 25, label: '25¢' }, { cents: 10, label: '10¢' },
  { cents: 5, label: '5¢' }, { cents: 1, label: '1¢' },
]

type CartItem = {
  product_id: string
  kinsey_sku: string
  name: string
  brand: string
  price: number
  quantity: number
  discount_pct: number
  image_url: string | null
  local_qty: number  // in-store stock at time of adding
  product_type: string
  fulfillment: 'in_store' | 'store_order' | 'dropship'
}

type Customer = {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  customer_group_id: string | null
  customer_groups?: { name: string; discount_percentage: number } | null
  lifetime_spend: number
  visit_count: number
}

type SuspendedTx = {
  id: string
  label: string
  cart: CartItem[]
  customer: Customer | null
  orderDiscount: number
  createdAt: string
}

type PaymentMethod = 'cash' | 'card' | 'check' | null

const BROAD_CATS = [
  { slug: 'all', name: 'All' },
  { slug: 'archery', name: 'Archery' },
  { slug: 'hunting', name: 'Hunting' },
  { slug: 'fishing', name: 'Fishing' },
  { slug: 'camping', name: 'Camping & Outdoors' },
  { slug: 'clothing', name: 'Clothing & Footwear' },
  { slug: 'optics', name: 'Optics' },
  { slug: 'firearms-ammo', name: 'Firearms & Ammo' },
  { slug: 'wildlife-feeders', name: 'Wildlife & Feeders' },
  { slug: 'accessories', name: 'Other' },
  { slug: 'services', name: '🔧 Services' },
]

export default function POSPage() {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // Products
  const [products, setProducts] = useState<any[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [broadCat, setBroadCat] = useState('all')
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productPage, setProductPage] = useState(0)
  const [productTotal, setProductTotal] = useState(0)
  const PRODUCT_PAGE_SIZE = 60

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderDiscount, setOrderDiscount] = useState(0)

  // Customer
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({ first_name: '', last_name: '', email: '', phone: '' })

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null)
  const [cashTendered, setCashTendered] = useState('')
  const [checkNumber, setCheckNumber] = useState('')
  const [processingPayment, setProcessingPayment] = useState(false)
  const [terminalStatus, setTerminalStatus] = useState<'idle' | 'connecting' | 'waiting' | 'processing' | 'approved' | 'error'>('idle')
  const [terminalMessage, setTerminalMessage] = useState('')

  // Receipt
  const [completedOrder, setCompletedOrder] = useState<any>(null)
  const [emailAddress, setEmailAddress] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [showReceiptOptions, setShowReceiptOptions] = useState(false)

  // ── DRAWER ──────────────────────────────────────────────────────────────────
  const [drawerStatus, setDrawerStatus] = useState<'open' | 'closed'>('closed')
  const [drawerSession, setDrawerSession] = useState<any>(null)
  const [lastCloseAmount, setLastCloseAmount] = useState<number | null>(null)
  const [showDrawerModal, setShowDrawerModal] = useState<'open' | 'close' | null>(null)
  const [drawerOpeningCash, setDrawerOpeningCash] = useState('')
  const [openBillCounts, setOpenBillCounts] = useState<Record<number, number>>({})
  const [openCoinCounts, setOpenCoinCounts] = useState<Record<number, number>>({})
  const [billCounts, setBillCounts] = useState<Record<number, number>>({})
  const [coinCounts, setCoinCounts] = useState<Record<number, number>>({})
  const [drawerClosing, setDrawerClosing] = useState(false)
  const [closeSummary, setCloseSummary] = useState<{ cashSales: number; expected: number; variance: number } | null>(null)

  // ── SUSPEND / RECALL ─────────────────────────────────────────────────────────
  const [suspended, setSuspended] = useState<SuspendedTx[]>([])
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [showRecallModal, setShowRecallModal] = useState(false)
  const [suspendLabel, setSuspendLabel] = useState('')

  // ── ORDER / DROPSHIP (post-payment fulfillment) ───────────────────────────
  const [dropshipAddress, setDropshipAddress] = useState({ name: '', street: '', city: '', state: 'GA', zip: '' })

  // Load drawer + suspended from localStorage on mount
  useEffect(() => {
    const savedDrawer = localStorage.getItem('pos_drawer')
    if (savedDrawer) {
      try { const s = JSON.parse(savedDrawer); setDrawerSession(s); setDrawerStatus('open') } catch (_) {}
    }
    const savedLastClose = localStorage.getItem('pos_last_close')
    if (savedLastClose) {
      try { setLastCloseAmount(parseFloat(savedLastClose)) } catch (_) {}
    }
    const savedSuspended = localStorage.getItem('pos_suspended')
    if (savedSuspended) {
      try { setSuspended(JSON.parse(savedSuspended)) } catch (_) {}
    }
    searchInputRef.current?.focus()
  }, [])

  useEffect(() => {
    setProductPage(0)
    fetchProducts(productSearch, 0, broadCat)
  }, [broadCat])

  // ── Products ─────────────────────────────────────────────────────────────────
  async function fetchProducts(q = productSearch, page = productPage, cat = broadCat) {
    setLoadingProducts(true)
    const from = page * PRODUCT_PAGE_SIZE
    const to = from + PRODUCT_PAGE_SIZE - 1
    let query = supabase
      .from('products')
      .select('id, kinsey_sku, name, brand, display_price, image_url, broad_category, product_type, in_store, quantity, category_name, in_stock', { count: 'exact' })
      .eq('visible', true)
      .gt('display_price', 0)
      .order('name')
      .range(from, to)

    if (cat === 'services') {
      query = query.eq('product_type', 'labor')
    } else {
      query = query.neq('product_type', 'labor')
      if (cat !== 'all') query = query.eq('broad_category', cat)
    }
    if (q) query = query.or(`name.ilike.%${q}%,brand.ilike.%${q}%,kinsey_sku.ilike.%${q}%,category_name.ilike.%${q}%`)

    const { data, count } = await query
    setProducts((data || []).map((p: any) => ({ ...p, price: p.display_price })))
    setProductTotal(count || 0)
    setLoadingProducts(false)
  }

  async function lookupByUpc(upc: string) {
    if (!upc.trim()) return
    const { data } = await supabase
      .from('products')
      .select('id, kinsey_sku, name, brand, display_price, image_url, product_type, quantity, in_stock')
      .or(`upc.eq.${upc},kinsey_sku.eq.${upc}`)
      .eq('visible', true)
      .single()
    if (data) addToCart({ ...data, price: data.display_price })
    else alert(`No product found for: ${upc}`)
  }

  function addToCart(product: any, qty = 1) {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) {
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + qty } : i)
      }
      const groupDiscount = customer?.customer_groups?.discount_percentage || 0
      const localQty = product.quantity ?? 0
      const isDistributor = product.product_type === 'distributor' || !product.product_type
      const inStoreStock = isDistributor ? 0 : localQty
      const needsFulfillment = inStoreStock <= 0 && product.product_type !== 'labor'
      return [...prev, {
        product_id: product.id,
        kinsey_sku: product.kinsey_sku,
        name: product.name,
        brand: product.brand || '',
        price: product.price,
        quantity: qty,
        discount_pct: groupDiscount,
        image_url: product.image_url || null,
        local_qty: inStoreStock,
        product_type: product.product_type || 'distributor',
        fulfillment: needsFulfillment ? 'store_order' : 'in_store',
      }]
    })
  }

  function updateCartQty(productId: string, qty: number) {
    if (qty <= 0) setCart(prev => prev.filter(i => i.product_id !== productId))
    else setCart(prev => prev.map(i => i.product_id === productId ? { ...i, quantity: qty } : i))
  }

  function updateLineDiscount(productId: string, pct: number) {
    setCart(prev => prev.map(i => i.product_id === productId ? { ...i, discount_pct: Math.min(100, Math.max(0, pct)) } : i))
  }

  function updateFulfillment(productId: string, fulfillment: CartItem['fulfillment']) {
    setCart(prev => prev.map(i => i.product_id === productId ? { ...i, fulfillment } : i))
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(i => i.product_id !== productId))
  }

  // Totals
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity * (1 - item.discount_pct / 100), 0)
  const orderDiscountAmount = subtotal * (orderDiscount / 100)
  const subtotalAfterDiscount = subtotal - orderDiscountAmount
  const taxAmount = subtotalAfterDiscount * GA_TAX_RATE
  const total = subtotalAfterDiscount + taxAmount
  const changeDue = paymentMethod === 'cash' && cashTendered ? Math.max(0, parseFloat(cashTendered) - total) : 0

  const oosCartItems = cart.filter(i => i.fulfillment !== 'in_store')
  const hasDropship = oosCartItems.some(i => i.fulfillment === 'dropship')

  // ── DRAWER ─────────────────────────────────────────────────────────────────
  const countedOpenBills = BILL_DENOMS.reduce((sum, d) => sum + d.value * (openBillCounts[d.value] || 0), 0)
  const countedOpenCents = COIN_DENOMS.reduce((sum, d) => sum + d.cents * (openCoinCounts[d.cents] || 0), 0)
  const countedOpenCash = countedOpenBills + countedOpenCents / 100

  const countedBills = BILL_DENOMS.reduce((sum, d) => sum + d.value * (billCounts[d.value] || 0), 0)
  const countedCents = COIN_DENOMS.reduce((sum, d) => sum + d.cents * (coinCounts[d.cents] || 0), 0)
  const countedCash = countedBills + countedCents / 100

  async function openDrawer() {
    const opening = countedOpenCash
    const session = { openedAt: new Date().toISOString(), openingCash: opening }
    localStorage.setItem('pos_drawer', JSON.stringify(session))
    setDrawerSession(session)
    setDrawerStatus('open')
    setShowDrawerModal(null)
    setOpenBillCounts({})
    setOpenCoinCounts({})
    await supabase.from('drawer_sessions').insert({ opening_cash: opening, opened_at: session.openedAt })
  }

  async function prepareCloseDrawer() {
    if (!drawerSession) return
    setDrawerClosing(true)
    const { data: cashOrders } = await supabase
      .from('orders')
      .select('total')
      .eq('payment_method', 'cash')
      .eq('source', 'pos')
      .gte('created_at', drawerSession.openedAt)
    const cashSales = (cashOrders || []).reduce((sum: number, o: any) => sum + (o.total || 0), 0)
    const expected = (drawerSession.openingCash || 0) + cashSales
    setCloseSummary({ cashSales, expected, variance: countedCash - expected })
    setDrawerClosing(false)
  }

  async function closeDrawer() {
    if (!drawerSession || !closeSummary) return
    await supabase.from('drawer_sessions').update({
      closed_at: new Date().toISOString(),
      closing_cash: countedCash,
      expected_cash: closeSummary.expected,
      variance: closeSummary.variance,
      denomination_counts: { bills: billCounts, coins: coinCounts },
    }).eq('opened_at', drawerSession.openedAt)
    localStorage.removeItem('pos_drawer')
    localStorage.setItem('pos_last_close', countedCash.toFixed(2))
    setLastCloseAmount(countedCash)
    setDrawerSession(null)
    setDrawerStatus('closed')
    setShowDrawerModal(null)
    setBillCounts({})
    setCoinCounts({})
    setCloseSummary(null)
  }

  // ── SUSPEND / RECALL ─────────────────────────────────────────────────────
  function suspendTransaction() {
    if (cart.length === 0) return
    const tx: SuspendedTx = {
      id: Date.now().toString(),
      label: suspendLabel.trim() || `Transaction ${suspended.length + 1}`,
      cart: [...cart],
      customer,
      orderDiscount,
      createdAt: new Date().toISOString(),
    }
    const updated = [...suspended, tx]
    setSuspended(updated)
    localStorage.setItem('pos_suspended', JSON.stringify(updated))
    setShowSuspendModal(false)
    setSuspendLabel('')
    resetTransaction()
  }

  function recallTransaction(tx: SuspendedTx) {
    setCart(tx.cart)
    setCustomer(tx.customer)
    setOrderDiscount(tx.orderDiscount)
    const updated = suspended.filter(t => t.id !== tx.id)
    setSuspended(updated)
    localStorage.setItem('pos_suspended', JSON.stringify(updated))
    setShowRecallModal(false)
  }

  // ── Customer ──────────────────────────────────────────────────────────────
  async function searchCustomers(q: string) {
    setCustomerSearch(q)
    if (!q || q.length < 2) { setCustomerResults([]); return }
    setLoadingCustomers(true)
    const { data } = await supabase
      .from('customers')
      .select('*, customer_groups(name, discount_percentage)')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(8)
    setCustomerResults(data || [])
    setLoadingCustomers(false)
  }

  function selectCustomer(c: Customer) {
    setCustomer(c)
    setCustomerResults([])
    setCustomerSearch('')
    if (c.customer_groups?.discount_percentage) {
      const pct = c.customer_groups.discount_percentage
      setCart(prev => prev.map(item => ({ ...item, discount_pct: Math.max(item.discount_pct, pct) })))
    }
  }

  async function createCustomer() {
    if (!newCustomerForm.first_name || !newCustomerForm.last_name) return
    const { data, error } = await supabase
      .from('customers')
      .insert({ ...newCustomerForm, created_source: 'pos' })
      .select('*, customer_groups(name, discount_percentage)')
      .single()
    if (!error && data) {
      selectCustomer(data)
      setShowNewCustomerForm(false)
      setNewCustomerForm({ first_name: '', last_name: '', email: '', phone: '' })
    }
  }

  // ── Payment ───────────────────────────────────────────────────────────────
  async function processCardPayment() {
    setTerminalStatus('connecting')
    setTerminalMessage('Connecting to terminal...')
    setProcessingPayment(true)
    try {
      const tokenRes = await fetch('/api/stripe/terminal-token', { method: 'POST' })
      const { secret, error: tokenError } = await tokenRes.json()
      if (tokenError) throw new Error(tokenError)
      setTerminalStatus('waiting')
      setTerminalMessage('Waiting for card... (Simulator Mode)')
      await new Promise(r => setTimeout(r, 2000))
      setTerminalStatus('processing')
      setTerminalMessage('Processing payment...')
      await new Promise(r => setTimeout(r, 1500))
      setTerminalStatus('approved')
      setTerminalMessage('Payment approved!')
      await completeOrder('card', { stripe_connection_token: secret })
    } catch (err: any) {
      setTerminalStatus('error')
      setTerminalMessage(err.message || 'Terminal error')
      setProcessingPayment(false)
    }
  }

  async function completeCashPayment() {
    const tendered = parseFloat(cashTendered)
    if (isNaN(tendered) || tendered < total) { alert('Cash tendered must be at least $' + total.toFixed(2)); return }
    setProcessingPayment(true)
    await completeOrder('cash', { cash_tendered: tendered, change_due: changeDue })
  }

  async function completeCheckPayment() {
    setProcessingPayment(true)
    await completeOrder('check', { check_number: checkNumber })
  }

  async function completeOrder(method: string, paymentMeta: any) {
    const orderPayload = {
      customer_id: customer?.id || null,
      source: 'pos',
      status: 'completed',
      payment_method: method,
      payment_status: 'paid',
      subtotal: subtotalAfterDiscount,
      tax: taxAmount,
      total,
      discount_amount: orderDiscountAmount,
      discount_percentage: orderDiscount,
      notes: paymentMeta.check_number ? `Check #${paymentMeta.check_number}` : null,
      metadata: paymentMeta,
    }

    const { data: order, error: orderError } = await supabase
      .from('orders').insert(orderPayload).select().single()

    if (orderError) {
      alert('Error saving order: ' + orderError.message)
      setProcessingPayment(false)
      setTerminalStatus('idle')
      return
    }

    // Insert order items
    const items = cart.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      kinsey_sku: item.kinsey_sku,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      discount_percentage: item.discount_pct,
      line_total: item.price * item.quantity * (1 - item.discount_pct / 100),
      fulfillment_type: item.fulfillment,
    }))
    await supabase.from('order_items').insert(items)

    // Decrement in-store inventory for in_store items only
    for (const item of cart.filter(i => i.fulfillment === 'in_store')) {
      const { error: rpcError } = await supabase.rpc('decrement_inventory', {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      })
      if (rpcError) {
        const { data: pData } = await supabase.from('products').select('quantity').eq('id', item.product_id).single()
        if (pData) {
          await supabase.from('products').update({ quantity: Math.max(0, (pData.quantity || 0) - item.quantity) }).eq('id', item.product_id)
        }
      }
    }

    // Add OOS items to restock list
    const oosItems = cart.filter(i => i.fulfillment !== 'in_store')
    if (oosItems.length > 0) {
      const restockEntries = oosItems.map(item => ({
        product_id: item.product_id,
        product_name: item.name,
        brand: item.brand,
        kinsey_sku: item.kinsey_sku,
        quantity_needed: item.quantity,
        status: 'pending',
        fulfillment_type: item.fulfillment,
        order_id: order.id,
        customer_name: customer ? `${customer.first_name} ${customer.last_name}` : null,
        customer_phone: customer?.phone || null,
        notes: item.fulfillment === 'dropship'
          ? `Dropship to: ${dropshipAddress.name}, ${dropshipAddress.street}, ${dropshipAddress.city}, ${dropshipAddress.state} ${dropshipAddress.zip}`
          : null,
        added_by: 'pos',
      }))
      await supabase.from('restock_list').insert(restockEntries)
    }

    // Update customer stats
    if (customer) {
      await supabase.from('customers').update({
        lifetime_spend: (customer.lifetime_spend || 0) + total,
        visit_count: (customer.visit_count || 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', customer.id)
    }

    setCompletedOrder({ ...order, items, customer, hasRestockItems: oosItems.length > 0 })
    setShowReceiptOptions(true)
    setProcessingPayment(false)
  }

  function printReceipt(order: any) {
    const win = window.open('', '_blank', 'width=400,height=700')
    if (!win) return
    const lines = order.items.map((item: any) =>
      `<tr><td>${item.quantity}x ${item.product_name}${item.fulfillment_type !== 'in_store' ? ' <span style="color:#c4842a;font-size:10px">[' + (item.fulfillment_type === 'dropship' ? 'SHIP' : 'ORDER') + ']</span>' : ''}</td><td style="text-align:right">$${item.line_total.toFixed(2)}</td></tr>`
    ).join('')
    win.document.write(`
      <html><head><title>Receipt</title>
      <style>
        body { font-family: monospace; font-size: 12px; width: 280px; margin: 0 auto; }
        h2 { text-align: center; font-size: 14px; margin: 4px 0; }
        p { text-align: center; margin: 2px 0; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .total-row td { font-weight: bold; }
        .total-row.grand td { font-size: 14px; }
      </style></head>
      <body>
        <h2>BRIAR PATCH OUTDOORS</h2>
        <p>Eatonton, GA · (706) 749-6994</p>
        <p>briarpatchoutdoors.com</p>
        <div class="divider"></div>
        <p>${new Date(order.created_at).toLocaleString()}</p>
        <p>Order: ${order.order_number}</p>
        ${order.customer ? `<p>Customer: ${order.customer.first_name} ${order.customer.last_name}</p>` : ''}
        <div class="divider"></div>
        <table>${lines}</table>
        <div class="divider"></div>
        <table>
          <tr><td>Subtotal</td><td style="text-align:right">$${order.subtotal?.toFixed(2)}</td></tr>
          ${order.discount_amount > 0 ? `<tr><td>Discount (${order.discount_percentage}%)</td><td style="text-align:right">-$${order.discount_amount?.toFixed(2)}</td></tr>` : ''}
          <tr><td>Tax (8%)</td><td style="text-align:right">$${order.tax?.toFixed(2)}</td></tr>
          <tr class="total-row grand"><td>TOTAL</td><td style="text-align:right">$${order.total?.toFixed(2)}</td></tr>
          ${order.metadata?.cash_tendered ? `<tr><td>Cash</td><td style="text-align:right">$${parseFloat(order.metadata.cash_tendered).toFixed(2)}</td></tr>` : ''}
          ${order.metadata?.change_due > 0 ? `<tr><td>Change</td><td style="text-align:right">$${order.metadata.change_due.toFixed(2)}</td></tr>` : ''}
        </table>
        ${order.hasRestockItems ? `<div class="divider"></div><p style="font-size:10px">* Items marked [ORDER] or [SHIP] are on order — you will be notified when ready.</p>` : ''}
        <div class="divider"></div>
        <p>Thank you for shopping with us!</p>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  async function emailReceipt(order: any) {
    if (!emailAddress) { alert('Enter an email address'); return }
    setSendingEmail(true)
    const res = await fetch('/api/receipt-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: order.id, email: emailAddress }),
    })
    const result = await res.json()
    setSendingEmail(false)
    if (result.success) alert(`Receipt sent to ${emailAddress}`)
    else alert('Failed to send: ' + result.error)
  }

  function resetTransaction() {
    setCart([])
    setCustomer(null)
    setPaymentMethod(null)
    setCashTendered('')
    setCheckNumber('')
    setOrderDiscount(0)
    setTerminalStatus('idle')
    setTerminalMessage('')
    setCompletedOrder(null)
    setShowReceiptOptions(false)
    setEmailAddress('')
    setDropshipAddress({ name: '', street: '', city: '', state: 'GA', zip: '' })
    searchInputRef.current?.focus()
  }

  function startNewTransaction() { resetTransaction() }

  const canCharge = cart.length > 0 && paymentMethod !== null
  const canCompletePayment = canCharge && !processingPayment && (
    paymentMethod === 'card' ||
    (paymentMethod === 'cash' && parseFloat(cashTendered || '0') >= total) ||
    paymentMethod === 'check'
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // RECEIPT SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (showReceiptOptions && completedOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#d4edda' }}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#2e7d32" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--primary)' }}>Payment Complete</h2>
          <p className="text-3xl font-bold mb-1">${completedOrder.total?.toFixed(2)}</p>
          <p className="text-gray-400 text-sm mb-2">{completedOrder.order_number}</p>
          {completedOrder.metadata?.cash_tendered && (
            <p className="text-gray-500 text-sm mb-2">
              Cash: ${parseFloat(completedOrder.metadata.cash_tendered).toFixed(2)} · Change: ${completedOrder.metadata.change_due?.toFixed(2) || '0.00'}
            </p>
          )}
          {completedOrder.hasRestockItems && (
            <div className="rounded-lg p-3 mb-4 text-left" style={{ backgroundColor: '#fffbeb', border: '1px solid #f59e0b' }}>
              <p className="text-xs font-bold text-amber-700 mb-1">📦 Items on Order</p>
              <p className="text-xs text-amber-600">Some items have been added to the restock list. Check <a href="/admin/restock" className="underline font-semibold">Admin → Restock</a> to manage fulfillment.</p>
            </div>
          )}
          <div className="space-y-3 mt-4">
            <button onClick={() => printReceipt(completedOrder)}
              className="w-full py-3 rounded-xl font-bold text-sm border-2 transition-colors hover:bg-gray-50"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
              🖨 Print Receipt (80mm)
            </button>
            <div className="flex gap-2">
              <input type="email" placeholder="customer@email.com"
                value={emailAddress || completedOrder.customer?.email || ''}
                onChange={e => setEmailAddress(e.target.value)}
                className="flex-1 border rounded-xl px-3 py-3 text-sm" />
              <button onClick={() => emailReceipt(completedOrder)} disabled={sendingEmail}
                className="px-4 py-3 rounded-xl font-bold text-sm text-white"
                style={{ backgroundColor: sendingEmail ? '#9ca3af' : 'var(--secondary)' }}>
                {sendingEmail ? '...' : 'Email'}
              </button>
            </div>
            <button onClick={startNewTransaction}
              className="w-full py-3 rounded-xl font-bold text-white text-sm mt-2"
              style={{ backgroundColor: 'var(--primary)' }}>
              New Transaction
            </button>
            <Link href="/admin" className="block text-xs text-gray-400 mt-2 hover:underline">← Back to Admin</Link>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN POS LAYOUT
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#f0f0f0', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}

      {/* Open Drawer Modal */}
      {showDrawerModal === 'open' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-auto py-6">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--primary)' }}>Open Cash Drawer — Count Starting Cash</h2>
            {lastCloseAmount !== null && (
              <div className="rounded-lg px-4 py-2 mb-4 text-sm font-semibold flex items-center justify-between"
                style={{ backgroundColor: '#fffbeb', border: '1px solid #f59e0b' }}>
                <span className="text-amber-700">Previous close amount</span>
                <span className="text-amber-800 font-bold">${lastCloseAmount.toFixed(2)}</span>
              </div>
            )}

            {/* Bills */}
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Bills</p>
              <div className="grid grid-cols-3 gap-2">
                {BILL_DENOMS.map(d => (
                  <div key={d.value} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm font-bold text-gray-600 w-10">{d.label}</span>
                    <input type="number" min="0" step="1" placeholder="0"
                      value={openBillCounts[d.value] || ''}
                      onChange={e => setOpenBillCounts(prev => ({ ...prev, [d.value]: parseInt(e.target.value) || 0 }))}
                      className="w-14 border rounded px-2 py-1 text-sm text-center font-semibold"
                      style={{ borderColor: '#ddd' }} />
                    <span className="text-xs text-gray-400">${((openBillCounts[d.value] || 0) * d.value).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coins */}
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Coins</p>
              <div className="grid grid-cols-3 gap-2">
                {COIN_DENOMS.map(d => (
                  <div key={d.cents} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm font-bold text-gray-600 w-10">{d.label}</span>
                    <input type="number" min="0" step="1" placeholder="0"
                      value={openCoinCounts[d.cents] || ''}
                      onChange={e => setOpenCoinCounts(prev => ({ ...prev, [d.cents]: parseInt(e.target.value) || 0 }))}
                      className="w-14 border rounded px-2 py-1 text-sm text-center font-semibold"
                      style={{ borderColor: '#ddd' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="rounded-xl p-4 mb-5 space-y-2" style={{ backgroundColor: '#f8f8f8' }}>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-gray-600">Counted Cash</span>
                <span style={{ color: 'var(--primary)' }}>${countedOpenCash.toFixed(2)}</span>
              </div>
              {lastCloseAmount !== null && (
                <div className="flex justify-between text-base font-bold border-t pt-2" style={{ borderColor: '#e5e7eb' }}>
                  <span>vs. Previous Close</span>
                  <span style={{ color: Math.abs(countedOpenCash - lastCloseAmount) < 0.01 ? '#16a34a' : '#dc2626' }}>
                    {countedOpenCash - lastCloseAmount >= 0 ? '+' : ''}{(countedOpenCash - lastCloseAmount).toFixed(2)}
                    {Math.abs(countedOpenCash - lastCloseAmount) < 0.01 ? ' ✓' : ' ⚠'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={openDrawer}
                className="flex-1 py-3 rounded-xl font-bold text-white text-sm"
                style={{ backgroundColor: 'var(--primary)' }}>Open Drawer (${countedOpenCash.toFixed(2)})</button>
              <button onClick={() => { setShowDrawerModal(null); setOpenBillCounts({}); setOpenCoinCounts({}) }}
                className="px-5 py-3 rounded-xl font-semibold text-sm border" style={{ borderColor: '#ddd', color: '#666' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Close Drawer Modal */}
      {showDrawerModal === 'close' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-auto py-6">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--primary)' }}>Close Drawer — Count Cash</h2>
            <p className="text-xs text-gray-400 mb-5">
              Opened {drawerSession ? new Date(drawerSession.openedAt).toLocaleString() : ''} · Starting: ${drawerSession?.openingCash?.toFixed(2) || '0.00'}
            </p>

            {/* Bills */}
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Bills</p>
              <div className="grid grid-cols-3 gap-2">
                {BILL_DENOMS.map(d => (
                  <div key={d.value} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm font-bold text-gray-600 w-10">{d.label}</span>
                    <input type="number" min="0" step="1" placeholder="0"
                      value={billCounts[d.value] || ''}
                      onChange={e => setBillCounts(prev => ({ ...prev, [d.value]: parseInt(e.target.value) || 0 }))}
                      className="w-14 border rounded px-2 py-1 text-sm text-center font-semibold"
                      style={{ borderColor: '#ddd' }} />
                    <span className="text-xs text-gray-400">${((billCounts[d.value] || 0) * d.value).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coins */}
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Coins</p>
              <div className="grid grid-cols-3 gap-2">
                {COIN_DENOMS.map(d => (
                  <div key={d.cents} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm font-bold text-gray-600 w-10">{d.label}</span>
                    <input type="number" min="0" step="1" placeholder="0"
                      value={coinCounts[d.cents] || ''}
                      onChange={e => setCoinCounts(prev => ({ ...prev, [d.cents]: parseInt(e.target.value) || 0 }))}
                      className="w-14 border rounded px-2 py-1 text-sm text-center font-semibold"
                      style={{ borderColor: '#ddd' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Totals / Variance */}
            <div className="rounded-xl p-4 mb-5 space-y-2" style={{ backgroundColor: '#f8f8f8' }}>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Counted Cash</span>
                <span className="font-bold">${countedCash.toFixed(2)}</span>
              </div>
              {closeSummary && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Opening Cash</span>
                    <span>${(drawerSession?.openingCash || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Cash Sales Today</span>
                    <span>+${closeSummary.cashSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-2" style={{ borderColor: '#e5e7eb' }}>
                    <span className="text-gray-600">Expected</span>
                    <span>${closeSummary.expected.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold">
                    <span>Variance</span>
                    <span style={{ color: Math.abs(closeSummary.variance) < 0.01 ? '#16a34a' : closeSummary.variance < 0 ? '#dc2626' : '#c4842a' }}>
                      {closeSummary.variance >= 0 ? '+' : ''}{closeSummary.variance.toFixed(2)}
                      {Math.abs(closeSummary.variance) < 0.01 ? ' ✓' : ''}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              {!closeSummary ? (
                <button onClick={prepareCloseDrawer} disabled={drawerClosing}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm"
                  style={{ backgroundColor: drawerClosing ? '#9ca3af' : '#C4842A' }}>
                  {drawerClosing ? 'Calculating...' : 'Calculate Variance'}
                </button>
              ) : (
                <button onClick={closeDrawer}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm"
                  style={{ backgroundColor: '#dc2626' }}>
                  Close Drawer & Save
                </button>
              )}
              <button onClick={() => { setShowDrawerModal(null); setCloseSummary(null); setBillCounts({}); setCoinCounts({}) }}
                className="px-5 py-3 rounded-xl font-semibold text-sm border" style={{ borderColor: '#ddd', color: '#666' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--primary)' }}>Suspend Transaction</h2>
            <p className="text-sm text-gray-500 mb-5">Optionally label this transaction so you can find it easily.</p>
            <input type="text" placeholder={`Transaction ${suspended.length + 1}`} value={suspendLabel}
              onChange={e => setSuspendLabel(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm mb-5"
              autoFocus onKeyDown={e => e.key === 'Enter' && suspendTransaction()} />
            <div className="flex gap-3">
              <button onClick={suspendTransaction}
                className="flex-1 py-3 rounded-xl font-bold text-white text-sm"
                style={{ backgroundColor: '#C4842A' }}>
                Suspend Transaction
              </button>
              <button onClick={() => { setShowSuspendModal(false); setSuspendLabel('') }}
                className="px-5 py-3 rounded-xl font-semibold text-sm border" style={{ borderColor: '#ddd', color: '#666' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recall Modal */}
      {showRecallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--primary)' }}>Recall Transaction</h2>
              <button onClick={() => setShowRecallModal(false)} className="text-gray-300 hover:text-gray-500 text-2xl">×</button>
            </div>
            {suspended.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No suspended transactions</p>
            ) : (
              <div className="space-y-2">
                {suspended.map(tx => (
                  <button key={tx.id} onClick={() => recallTransaction(tx)}
                    className="w-full text-left p-4 rounded-xl border hover:border-amber-400 hover:bg-amber-50 transition-colors"
                    style={{ borderColor: '#e5e7eb' }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm">{tx.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {tx.cart.length} item{tx.cart.length !== 1 ? 's' : ''}
                          {tx.customer ? ` · ${tx.customer.first_name} ${tx.customer.last_name}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: 'var(--primary)' }}>
                          ${tx.cart.reduce((s, i) => s + i.price * i.quantity * (1 - i.discount_pct / 100), 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TOP BAR ────────────────────────────────────────────────────────── */}
      <div className="flex items-center px-4 py-2 bg-white border-b shadow-sm flex-shrink-0 gap-3" style={{ borderColor: '#e0e0e0' }}>
        <span className="font-bold text-sm flex-shrink-0" style={{ color: 'var(--primary)' }}>Briar Patch POS</span>
        <span className="text-xs text-gray-400 flex-shrink-0">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>

        {/* Drawer status */}
        <button
          onClick={() => setShowDrawerModal(drawerStatus === 'closed' ? 'open' : 'close')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex-shrink-0"
          style={{
            borderColor: drawerStatus === 'open' ? '#16a34a' : '#9ca3af',
            color: drawerStatus === 'open' ? '#16a34a' : '#9ca3af',
            backgroundColor: drawerStatus === 'open' ? '#f0fdf4' : '#f9fafb',
          }}>
          <span className={`w-2 h-2 rounded-full ${drawerStatus === 'open' ? 'bg-green-500' : 'bg-gray-400'}`} />
          Drawer: {drawerStatus === 'open' ? 'OPEN' : 'CLOSED'}
        </button>

        {/* Suspended transactions */}
        {suspended.length > 0 && (
          <button onClick={() => setShowRecallModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border flex-shrink-0"
            style={{ borderColor: '#f59e0b', color: '#92400e', backgroundColor: '#fffbeb' }}>
            ⏸ Suspended ({suspended.length})
          </button>
        )}

        {/* UPC scan bar */}
        <div className="flex-1 max-w-xs">
          <input ref={barcodeInputRef} type="text" placeholder="Scan barcode or UPC..."
            className="w-full border rounded-lg px-3 py-1.5 text-sm" style={{ borderColor: '#ddd' }}
            onKeyDown={e => {
              if (e.key === 'Enter') { lookupByUpc((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = '' }
            }} />
        </div>
        <div className="flex-1" />
        <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded border flex-shrink-0" style={{ borderColor: '#ddd' }}>
          ← Admin
        </Link>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Products ─────────────────────────────────────────────── */}
        <div className="flex flex-col" style={{ width: '60%', borderRight: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}>

          {/* Category tabs */}
          <div className="flex gap-1 px-3 pt-3 pb-0 flex-wrap">
            {BROAD_CATS.map(cat => (
              <button key={cat.slug} onClick={() => setBroadCat(cat.slug)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap mb-1"
                style={{ backgroundColor: broadCat === cat.slug ? 'var(--primary)' : '#e8e8e8', color: broadCat === cat.slug ? 'white' : '#555' }}>
                {cat.name}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-3 py-2">
            <input ref={searchInputRef} type="text" placeholder="Search products..."
              value={productSearch}
              onChange={e => { setProductSearch(e.target.value); setProductPage(0); fetchProducts(e.target.value, 0) }}
              onKeyDown={e => { if (e.key === 'Enter') fetchProducts(productSearch, 0) }}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white" style={{ borderColor: '#ddd' }} />
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {!loadingProducts && productTotal > 0 && (
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs text-gray-400">
                  {productTotal.toLocaleString()} products
                  {productTotal > PRODUCT_PAGE_SIZE && ` · showing ${productPage * PRODUCT_PAGE_SIZE + 1}–${Math.min((productPage + 1) * PRODUCT_PAGE_SIZE, productTotal)}`}
                </p>
                {productTotal > PRODUCT_PAGE_SIZE && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => { const p = Math.max(0, productPage - 1); setProductPage(p); fetchProducts(productSearch, p) }}
                      disabled={productPage === 0}
                      className="px-2 py-1 rounded text-xs font-bold border disabled:opacity-30"
                      style={{ borderColor: '#ddd', color: 'var(--primary)' }}>←</button>
                    <span className="text-xs text-gray-400 px-1">{productPage + 1} / {Math.ceil(productTotal / PRODUCT_PAGE_SIZE)}</span>
                    <button onClick={() => { const p = Math.min(Math.ceil(productTotal / PRODUCT_PAGE_SIZE) - 1, productPage + 1); setProductPage(p); fetchProducts(productSearch, p) }}
                      disabled={productPage >= Math.ceil(productTotal / PRODUCT_PAGE_SIZE) - 1}
                      className="px-2 py-1 rounded text-xs font-bold border disabled:opacity-30"
                      style={{ borderColor: '#ddd', color: 'var(--primary)' }}>→</button>
                  </div>
                )}
              </div>
            )}
            {loadingProducts ? (
              <div className="text-center text-gray-400 py-8">Loading...</div>
            ) : products.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No products found</div>
            ) : (
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                {products.map(p => (
                  <button key={p.id} onClick={() => addToCart(p)}
                    className="bg-white rounded-xl p-3 text-left border transition-all hover:shadow-md hover:border-gray-300 active:scale-95"
                    style={{ borderColor: '#e8e8e8' }}>
                    {p.image_url && p.image_url !== 'none' ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-20 object-contain rounded mb-2" />
                    ) : (
                      <div className="w-full h-20 rounded mb-2 flex items-center justify-center text-xs text-gray-300" style={{ backgroundColor: '#f5f5f5' }}>No Image</div>
                    )}
                    <p className="text-xs font-bold leading-tight line-clamp-2 mb-1" style={{ color: '#1a1a1a' }}>{p.name}</p>
                    {p.brand && <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{p.brand}</p>}
                    <p className="text-sm font-bold" style={{ color: 'var(--primary)' }}>${p.price?.toFixed(2)}</p>
                    {(p.product_type === 'distributor' || !p.product_type) && p.in_stock ? (
                      <p className="text-xs text-blue-500">Distributor stock</p>
                    ) : (p.quantity || 0) <= 0 && p.product_type !== 'labor' ? (
                      <p className="text-xs text-red-500">Not in store</p>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
            {!loadingProducts && productTotal > PRODUCT_PAGE_SIZE && (
              <div className="flex items-center justify-center gap-2 pt-3 pb-1 border-t mt-2" style={{ borderColor: '#e8e8e8' }}>
                <button onClick={() => { const p = Math.max(0, productPage - 1); setProductPage(p); fetchProducts(productSearch, p) }}
                  disabled={productPage === 0}
                  className="px-3 py-1.5 rounded text-xs font-bold border disabled:opacity-30"
                  style={{ borderColor: '#ddd', color: 'var(--primary)' }}>← Prev</button>
                <span className="text-xs text-gray-500">Page {productPage + 1} of {Math.ceil(productTotal / PRODUCT_PAGE_SIZE)}</span>
                <button onClick={() => { const p = Math.min(Math.ceil(productTotal / PRODUCT_PAGE_SIZE) - 1, productPage + 1); setProductPage(p); fetchProducts(productSearch, p) }}
                  disabled={productPage >= Math.ceil(productTotal / PRODUCT_PAGE_SIZE) - 1}
                  className="px-3 py-1.5 rounded text-xs font-bold border disabled:opacity-30"
                  style={{ borderColor: '#ddd', color: 'var(--primary)' }}>Next →</button>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Cart + Checkout ─────────────────────────────────────── */}
        <div className="flex flex-col" style={{ width: '40%', backgroundColor: 'white' }}>

          {/* Customer bar */}
          <div className="px-4 py-3 border-b" style={{ borderColor: '#f0f0f0', backgroundColor: '#fafafa' }}>
            {customer ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--primary)' }}>{customer.first_name} {customer.last_name}</p>
                  <p className="text-xs text-gray-400">
                    {customer.customer_groups?.name || 'No group'}
                    {customer.customer_groups?.discount_percentage ? ` · ${customer.customer_groups.discount_percentage}% discount` : ''}
                  </p>
                </div>
                <button onClick={() => setCustomer(null)} className="text-gray-300 hover:text-gray-500 text-xl">×</button>
              </div>
            ) : (
              <div className="relative">
                <input type="text" placeholder="Search customer by name, email, phone..."
                  value={customerSearch} onChange={e => searchCustomers(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: '#ddd' }} />
                {customerResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-xl z-20 mt-1 max-h-48 overflow-y-auto">
                    {customerResults.map(c => (
                      <button key={c.id} onClick={() => selectCustomer(c)}
                        className="w-full px-3 py-2.5 text-left hover:bg-gray-50 border-b last:border-b-0 text-sm">
                        <span className="font-semibold">{c.first_name} {c.last_name}</span>
                        <span className="text-gray-400 ml-2">{c.email || c.phone}</span>
                        {c.customer_groups?.discount_percentage ? (
                          <span className="ml-2 text-xs text-green-600">{c.customer_groups.discount_percentage}% off</span>
                        ) : null}
                      </button>
                    ))}
                    <button onClick={() => setShowNewCustomerForm(true)}
                      className="w-full px-3 py-2.5 text-left hover:bg-blue-50 text-sm text-blue-600 font-semibold">
                      + Add new customer
                    </button>
                  </div>
                )}
                {customerSearch.length >= 2 && customerResults.length === 0 && !loadingCustomers && (
                  <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-xl z-20 mt-1">
                    <button onClick={() => setShowNewCustomerForm(true)}
                      className="w-full px-3 py-2.5 text-left hover:bg-blue-50 text-sm text-blue-600 font-semibold">
                      + Add new customer
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* New customer form */}
          {showNewCustomerForm && (
            <div className="px-4 py-3 border-b" style={{ backgroundColor: '#eff6ff', borderColor: '#dbeafe' }}>
              <p className="text-xs font-bold text-blue-700 mb-2">New Customer</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input type="text" placeholder="First name" value={newCustomerForm.first_name}
                  onChange={e => setNewCustomerForm({ ...newCustomerForm, first_name: e.target.value })}
                  className="border rounded px-2 py-1.5 text-sm" />
                <input type="text" placeholder="Last name" value={newCustomerForm.last_name}
                  onChange={e => setNewCustomerForm({ ...newCustomerForm, last_name: e.target.value })}
                  className="border rounded px-2 py-1.5 text-sm" />
                <input type="email" placeholder="Email" value={newCustomerForm.email}
                  onChange={e => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                  className="border rounded px-2 py-1.5 text-sm" />
                <input type="tel" placeholder="Phone" value={newCustomerForm.phone}
                  onChange={e => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  className="border rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={createCustomer}
                  className="px-3 py-1.5 rounded text-xs font-bold text-white" style={{ backgroundColor: 'var(--primary)' }}>
                  Add & Select
                </button>
                <button onClick={() => setShowNewCustomerForm(false)}
                  className="px-3 py-1.5 rounded text-xs font-semibold text-gray-500 border" style={{ borderColor: '#ddd' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300">
                <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-sm font-semibold">Cart is empty</p>
                <p className="text-xs mt-1">Search or scan to add items</p>
              </div>
            ) : (
              <div>
                {cart.map(item => {
                  const lineTotal = item.price * item.quantity * (1 - item.discount_pct / 100)
                  const needsFulfillment = item.fulfillment !== 'in_store'
                  return (
                    <div key={item.product_id} className="px-4 py-3 border-b" style={{ borderColor: needsFulfillment ? '#fef3c7' : '#f0f0f0', backgroundColor: needsFulfillment ? '#fffbeb' : 'white' }}>
                      <div className="flex items-start gap-3">
                        {item.image_url && item.image_url !== 'none' ? (
                          <img src={item.image_url} alt={item.name} className="w-10 h-10 object-contain rounded flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded flex-shrink-0" style={{ backgroundColor: '#f0f0f0' }} />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold leading-tight truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">${item.price.toFixed(2)} each</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <button onClick={() => updateCartQty(item.product_id, item.quantity - 1)}
                              className="w-6 h-6 rounded-full border flex items-center justify-center text-sm font-bold text-gray-500 hover:bg-gray-100">-</button>
                            <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                            <button onClick={() => updateCartQty(item.product_id, item.quantity + 1)}
                              className="w-6 h-6 rounded-full border flex items-center justify-center text-sm font-bold text-gray-500 hover:bg-gray-100">+</button>
                            <div className="flex items-center gap-1 ml-2">
                              <input type="number" min="0" max="100" step="5" value={item.discount_pct || ''}
                                onChange={e => updateLineDiscount(item.product_id, parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-12 border rounded px-1 py-0.5 text-xs text-center"
                                style={{ borderColor: item.discount_pct > 0 ? 'var(--secondary)' : '#ddd' }} />
                              <span className="text-xs text-gray-400">%</span>
                            </div>
                          </div>

                          {/* Fulfillment selector for OOS items */}
                          {needsFulfillment && (
                            <div className="mt-2 flex gap-1">
                              <button onClick={() => updateFulfillment(item.product_id, 'store_order')}
                                className="px-2 py-1 rounded text-xs font-semibold border transition-colors"
                                style={{
                                  backgroundColor: item.fulfillment === 'store_order' ? '#92400e' : 'white',
                                  color: item.fulfillment === 'store_order' ? 'white' : '#92400e',
                                  borderColor: '#92400e',
                                }}>
                                📋 Order/Pickup
                              </button>
                              <button onClick={() => updateFulfillment(item.product_id, 'dropship')}
                                className="px-2 py-1 rounded text-xs font-semibold border transition-colors"
                                style={{
                                  backgroundColor: item.fulfillment === 'dropship' ? '#1d4ed8' : 'white',
                                  color: item.fulfillment === 'dropship' ? 'white' : '#1d4ed8',
                                  borderColor: '#1d4ed8',
                                }}>
                                🚚 Dropship
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold" style={{ color: 'var(--primary)' }}>${lineTotal.toFixed(2)}</p>
                          {item.discount_pct > 0 && <p className="text-xs text-green-600">-{item.discount_pct}%</p>}
                          <button onClick={() => removeFromCart(item.product_id)}
                            className="text-xs text-gray-300 hover:text-red-400 mt-1">remove</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Dropship address (shown if any dropship items) */}
          {hasDropship && (
            <div className="px-4 py-3 border-t" style={{ borderColor: '#dbeafe', backgroundColor: '#eff6ff' }}>
              <p className="text-xs font-bold text-blue-700 mb-2">🚚 Dropship Address</p>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Recipient name" value={dropshipAddress.name}
                  onChange={e => setDropshipAddress({ ...dropshipAddress, name: e.target.value })}
                  className="col-span-2 border rounded px-2 py-1.5 text-xs" />
                <input type="text" placeholder="Street address" value={dropshipAddress.street}
                  onChange={e => setDropshipAddress({ ...dropshipAddress, street: e.target.value })}
                  className="col-span-2 border rounded px-2 py-1.5 text-xs" />
                <input type="text" placeholder="City" value={dropshipAddress.city}
                  onChange={e => setDropshipAddress({ ...dropshipAddress, city: e.target.value })}
                  className="border rounded px-2 py-1.5 text-xs" />
                <div className="flex gap-2">
                  <input type="text" placeholder="State" value={dropshipAddress.state} maxLength={2}
                    onChange={e => setDropshipAddress({ ...dropshipAddress, state: e.target.value.toUpperCase() })}
                    className="border rounded px-2 py-1.5 text-xs w-14" />
                  <input type="text" placeholder="ZIP" value={dropshipAddress.zip}
                    onChange={e => setDropshipAddress({ ...dropshipAddress, zip: e.target.value })}
                    className="border rounded px-2 py-1.5 text-xs flex-1" />
                </div>
              </div>
            </div>
          )}

          {/* Totals + Payment */}
          {cart.length > 0 && (
            <div className="border-t flex-shrink-0" style={{ borderColor: '#e0e0e0' }}>

              {/* Suspend button */}
              <div className="px-4 py-2 flex justify-end border-b" style={{ borderColor: '#f0f0f0' }}>
                <button onClick={() => setShowSuspendModal(true)}
                  className="text-xs font-semibold px-3 py-1.5 rounded border transition-colors hover:bg-amber-50"
                  style={{ borderColor: '#f59e0b', color: '#92400e' }}>
                  ⏸ Suspend
                </button>
              </div>

              {/* Order discount */}
              <div className="px-4 py-2 flex items-center gap-2 border-b" style={{ borderColor: '#f0f0f0' }}>
                <span className="text-xs text-gray-500 font-semibold">Order Discount:</span>
                <input type="number" min="0" max="100" step="5" value={orderDiscount || ''}
                  onChange={e => setOrderDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-16 border rounded px-2 py-1 text-xs text-center"
                  style={{ borderColor: orderDiscount > 0 ? 'var(--secondary)' : '#ddd' }} />
                <span className="text-xs text-gray-400">%</span>
                {orderDiscount > 0 && <span className="text-xs text-green-600 ml-auto">-${orderDiscountAmount.toFixed(2)}</span>}
              </div>

              {/* Totals */}
              <div className="px-4 py-2 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
                </div>
                {orderDiscount > 0 && (
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Order Discount ({orderDiscount}%)</span><span>-${orderDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Tax (8% GA)</span><span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold" style={{ color: 'var(--primary)' }}>
                  <span>Total</span><span>${total.toFixed(2)}</span>
                </div>
                {oosCartItems.length > 0 && (
                  <p className="text-xs text-amber-600">⚠ {oosCartItems.length} item{oosCartItems.length !== 1 ? 's' : ''} on order/dropship</p>
                )}
              </div>

              {/* Payment method */}
              <div className="px-4 pb-3">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(['cash', 'card', 'check'] as PaymentMethod[]).map(method => (
                    <button key={method!} onClick={() => setPaymentMethod(method)}
                      className="py-2 rounded-lg text-sm font-bold capitalize transition-all"
                      style={{
                        backgroundColor: paymentMethod === method ? 'var(--primary)' : '#f0f0f0',
                        color: paymentMethod === method ? 'white' : '#555',
                        border: paymentMethod === method ? '2px solid var(--primary)' : '2px solid transparent',
                      }}>
                      {method === 'card' ? 'Card' : method === 'cash' ? 'Cash' : 'Check'}
                    </button>
                  ))}
                </div>

                {paymentMethod === 'cash' && (
                  <div className="mb-3">
                    <div className="flex gap-2 mb-1">
                      <input type="number" min="0" step="0.01" placeholder="Cash tendered"
                        value={cashTendered} onChange={e => setCashTendered(e.target.value)}
                        className="flex-1 border rounded-lg px-3 py-2 text-sm font-semibold"
                        style={{ borderColor: '#ddd' }} autoFocus />
                    </div>
                    <div className="grid grid-cols-4 gap-1 mb-2">
                      {[Math.ceil(total), Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, Math.ceil(total / 20) * 20]
                        .filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 4)
                        .map(amt => (
                          <button key={amt} onClick={() => setCashTendered(String(amt))}
                            className="py-1.5 rounded text-xs font-bold border transition-colors hover:bg-gray-50"
                            style={{ borderColor: '#ddd' }}>${amt}</button>
                        ))}
                    </div>
                    {cashTendered && parseFloat(cashTendered) >= total && (
                      <div className="text-center p-2 rounded-lg" style={{ backgroundColor: '#d4edda' }}>
                        <span className="text-green-700 font-bold">Change Due: ${changeDue.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'card' && terminalStatus !== 'idle' && (
                  <div className="mb-3 p-3 rounded-lg text-center text-sm font-semibold"
                    style={{
                      backgroundColor: terminalStatus === 'approved' ? '#d4edda' : terminalStatus === 'error' ? '#f8d7da' : '#e3f2fd',
                      color: terminalStatus === 'approved' ? '#2e7d32' : terminalStatus === 'error' ? '#c62828' : '#1565c0',
                    }}>
                    {terminalStatus === 'connecting' && '⟳ '}{terminalStatus === 'waiting' && '⌛ '}
                    {terminalStatus === 'processing' && '⟳ '}{terminalStatus === 'approved' && '✓ '}{terminalStatus === 'error' && '✕ '}
                    {terminalMessage}
                  </div>
                )}

                {paymentMethod === 'check' && (
                  <div className="mb-3">
                    <input type="text" placeholder="Check number (optional)"
                      value={checkNumber} onChange={e => setCheckNumber(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: '#ddd' }} />
                  </div>
                )}

                <button
                  onClick={paymentMethod === 'card' ? processCardPayment : paymentMethod === 'cash' ? completeCashPayment : completeCheckPayment}
                  disabled={!canCompletePayment || processingPayment}
                  className="w-full py-3 rounded-xl font-bold text-base text-white transition-all"
                  style={{ backgroundColor: !canCompletePayment ? '#9ca3af' : processingPayment ? '#9ca3af' : 'var(--primary)' }}>
                  {processingPayment ? 'Processing...'
                    : paymentMethod === 'card' ? `Charge $${total.toFixed(2)}`
                    : paymentMethod === 'cash' ? `Collect $${total.toFixed(2)}`
                    : paymentMethod === 'check' ? `Accept Check $${total.toFixed(2)}`
                    : 'Select Payment Method'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
