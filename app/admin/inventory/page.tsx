'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type BatchItem = {
  tempId: string
  product_id: string
  kinsey_sku: string
  upc: string
  name: string
  brand: string
  quantity: number
  cost_per_unit: number
}

type Receipt = {
  id: string
  receipt_number: string
  supplier: string
  received_date: string
  notes: string
  total_items: number
  total_cost: number
  created_at: string
}

export default function InventoryPage() {
  const [tab, setTab] = useState<'receive' | 'history' | 'stock'>('receive')

  // Receive shipment state
  const [supplier, setSupplier] = useState("Kinsey's")
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0])
  const [poNumber, setPoNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [upcInput, setUpcInput] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [itemQty, setItemQty] = useState(1)
  const [itemCost, setItemCost] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const upcRef = useRef<HTMLInputElement>(null)

  // History state
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loadingReceipts, setLoadingReceipts] = useState(false)
  const [expandedReceipt, setExpandedReceipt] = useState<string | null>(null)
  const [receiptLots, setReceiptLots] = useState<Record<string, any[]>>({})

  // Stock state
  const [stockItems, setStockItems] = useState<any[]>([])
  const [loadingStock, setLoadingStock] = useState(false)
  const [stockSearch, setStockSearch] = useState('')

  useEffect(() => {
    if (tab === 'history') loadReceipts()
    if (tab === 'stock') loadStock()
  }, [tab])

  // UPC lookup — fires on Enter or when scanner submits
  async function lookupUPC(upc: string) {
    if (!upc.trim()) return
    const { data } = await supabase
      .from('products')
      .select('id, name, brand, kinsey_sku, upc, cost')
      .eq('upc', upc.trim())
      .single()
    if (data) {
      setSelectedProduct(data)
      setItemCost(data.cost?.toFixed(2) || '')
      setUpcInput('')
      setSearchInput('')
      setSearchResults([])
    } else {
      showMsg(`No product found for UPC: ${upc}`, 'error')
      setUpcInput('')
    }
  }

  // Product name/SKU search
  async function searchProducts(q: string) {
    if (q.length < 2) { setSearchResults([]); return }
    const { data } = await supabase
      .from('products')
      .select('id, name, brand, kinsey_sku, upc, cost')
      .or(`name.ilike.%${q}%,kinsey_sku.ilike.%${q}%,brand.ilike.%${q}%`)
      .limit(8)
    setSearchResults(data || [])
  }

  function selectProduct(p: any) {
    setSelectedProduct(p)
    setItemCost(p.cost?.toFixed(2) || '')
    setSearchInput('')
    setSearchResults([])
  }

  function addToBatch() {
    if (!selectedProduct || !itemQty || !itemCost) {
      showMsg('Please select a product and enter quantity and cost', 'error')
      return
    }
    // Check if product already in batch — if so, update qty
    const existing = batchItems.find(b => b.product_id === selectedProduct.id)
    if (existing) {
      setBatchItems(batchItems.map(b =>
        b.product_id === selectedProduct.id
          ? { ...b, quantity: b.quantity + itemQty, cost_per_unit: parseFloat(itemCost) }
          : b
      ))
    } else {
      setBatchItems([...batchItems, {
        tempId: crypto.randomUUID(),
        product_id: selectedProduct.id,
        kinsey_sku: selectedProduct.kinsey_sku,
        upc: selectedProduct.upc || '',
        name: selectedProduct.name,
        brand: selectedProduct.brand,
        quantity: itemQty,
        cost_per_unit: parseFloat(itemCost),
      }])
    }
    setSelectedProduct(null)
    setItemQty(1)
    setItemCost('')
    setUpcInput('')
    upcRef.current?.focus()
  }

  function removeFromBatch(tempId: string) {
    setBatchItems(batchItems.filter(b => b.tempId !== tempId))
  }

  function updateBatchItem(tempId: string, field: 'quantity' | 'cost_per_unit', value: number) {
    setBatchItems(batchItems.map(b => b.tempId === tempId ? { ...b, [field]: value } : b))
  }

  async function commitReceipt() {
    if (batchItems.length === 0) {
      showMsg('No items in batch', 'error')
      return
    }
    setSubmitting(true)
    try {
      const totalItems = batchItems.reduce((sum, i) => sum + i.quantity, 0)
      const totalCost = batchItems.reduce((sum, i) => sum + i.quantity * i.cost_per_unit, 0)

      // Create receipt record
      const { data: receipt, error: receiptError } = await supabase
        .from('inventory_receipts')
        .insert({
          supplier,
          received_date: receivedDate,
          receipt_number: poNumber || null,
          notes: notes || null,
          total_items: totalItems,
          total_cost: totalCost,
        })
        .select('id')
        .single()

      if (receiptError) throw receiptError

      // Create inventory lots
      const lots = batchItems.map(item => ({
        receipt_id: receipt.id,
        product_id: item.product_id,
        quantity_received: item.quantity,
        quantity_remaining: item.quantity,
        cost_per_unit: item.cost_per_unit,
        received_date: receivedDate,
        po_number: poNumber || null,
      }))

      const { error: lotsError } = await supabase
        .from('inventory_lots')
        .insert(lots)

      if (lotsError) throw lotsError

      // Update product quantities (add to existing)
      for (const item of batchItems) {
        const { data: product } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', item.product_id)
          .single()

        const newQty = (product?.quantity || 0) + item.quantity
        await supabase
          .from('products')
          .update({
            quantity: newQty,
            in_stock: newQty > 0,
            cost: item.cost_per_unit, // update to latest cost
            in_store: true, // receiving inventory means it's in store
          })
          .eq('id', item.product_id)
      }

      showMsg(`✓ Shipment received! ${totalItems} items across ${batchItems.length} products. Total cost: $${totalCost.toFixed(2)}`, 'success')
      setBatchItems([])
      setPoNumber('')
      setNotes('')
      setSupplier("Kinsey's")
      setReceivedDate(new Date().toISOString().split('T')[0])

    } catch (err: any) {
      showMsg(`Error: ${err.message}`, 'error')
    }
    setSubmitting(false)
  }

  async function loadReceipts() {
    setLoadingReceipts(true)
    const { data } = await supabase
      .from('inventory_receipts')
      .select('*')
      .order('received_date', { ascending: false })
      .limit(50)
    setReceipts(data || [])
    setLoadingReceipts(false)
  }

  async function loadReceiptLots(receiptId: string) {
    if (receiptLots[receiptId]) {
      setExpandedReceipt(expandedReceipt === receiptId ? null : receiptId)
      return
    }
    const { data } = await supabase
      .from('inventory_lots')
      .select('*, products(name, brand, kinsey_sku)')
      .eq('receipt_id', receiptId)
      .order('created_at')
    setReceiptLots({ ...receiptLots, [receiptId]: data || [] })
    setExpandedReceipt(receiptId)
  }

  async function loadStock() {
    setLoadingStock(true)
    const { data } = await supabase
      .from('inventory_lots')
      .select('product_id, cost_per_unit, quantity_remaining, quantity_received, received_date, products(id, name, brand, kinsey_sku, quantity, in_stock)')
      .gt('quantity_remaining', 0)
      .order('received_date', { ascending: true })
    if (data) {
      // Group by product, FIFO order
      const grouped: Record<string, any> = {}
      data.forEach((lot: any) => {
        const pid = lot.product_id
        if (!grouped[pid]) {
          grouped[pid] = {
            product: lot.products,
            lots: [],
            totalRemaining: 0,
            fifoValue: 0,
            oldestDate: lot.received_date,
          }
        }
        grouped[pid].lots.push(lot)
        grouped[pid].totalRemaining += lot.quantity_remaining
        grouped[pid].fifoValue += lot.quantity_remaining * lot.cost_per_unit
      })
      setStockItems(Object.values(grouped))
    }
    setLoadingStock(false)
  }

  function showMsg(msg: string, type: 'success' | 'error') {
    setMessage(msg); setMessageType(type)
    setTimeout(() => setMessage(''), 6000)
  }

  const batchTotal = batchItems.reduce((sum, i) => sum + i.quantity * i.cost_per_unit, 0)
  const batchQty = batchItems.reduce((sum, i) => sum + i.quantity, 0)

  const filteredStock = stockItems.filter(s =>
    !stockSearch || s.product?.name?.toLowerCase().includes(stockSearch.toLowerCase()) ||
    s.product?.brand?.toLowerCase().includes(stockSearch.toLowerCase()) ||
    s.product?.kinsey_sku?.toLowerCase().includes(stockSearch.toLowerCase())
  )

  return (
    <div className="max-w-6xl">

      {message && (
        <div className="mb-4 p-3 rounded text-sm font-semibold text-white"
          style={{ backgroundColor: messageType === 'success' ? 'var(--secondary)' : '#dc2626' }}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {[
          { key: 'receive', label: 'Receive Inventory' },
          { key: 'stock', label: 'FIFO Stock Ledger' },
          { key: 'history', label: 'Receipt History' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className="px-5 py-3 text-sm font-semibold border-b-2 transition-colors"
            style={{
              borderColor: tab === t.key ? 'var(--primary)' : 'transparent',
              color: tab === t.key ? 'var(--primary)' : '#666',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RECEIVE INVENTORY ── */}
      {tab === 'receive' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT — Scan / Search */}
          <div className="space-y-4">

            {/* Shipment Info */}
            <div className="bg-white rounded-lg shadow p-5">
              <h2 className="font-bold text-sm uppercase tracking-wide mb-4" style={{ color: 'var(--primary)' }}>
                Shipment Details
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Supplier</label>
                  <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Date Received</label>
                  <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">PO / Invoice # (optional)</label>
                  <input type="text" value={poNumber} onChange={e => setPoNumber(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. INV-12345" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Notes (optional)</label>
                  <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm" placeholder="Any notes..." />
                </div>
              </div>
            </div>

            {/* UPC Scanner */}
            <div className="bg-white rounded-lg shadow p-5">
              <h2 className="font-bold text-sm uppercase tracking-wide mb-4" style={{ color: 'var(--primary)' }}>
                Scan or Search Product
              </h2>

              {/* UPC Input */}
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Scan Barcode / Enter UPC
                </label>
                <input
                  ref={upcRef}
                  type="text"
                  value={upcInput}
                  onChange={e => setUpcInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') lookupUPC(upcInput) }}
                  className="w-full border-2 rounded-lg px-4 py-3 text-sm font-mono"
                  style={{ borderColor: 'var(--primary)' }}
                  placeholder="Scan barcode or type UPC and press Enter"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-xs text-gray-400 font-semibold">OR SEARCH BY NAME / SKU</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              {/* Name/SKU Search */}
              <div className="relative">
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => { setSearchInput(e.target.value); searchProducts(e.target.value) }}
                  className="w-full border rounded-lg px-4 py-2.5 text-sm"
                  placeholder="Search by product name, brand, or SKU..."
                />
                {searchResults.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 max-h-64 overflow-y-auto">
                    {searchResults.map(p => (
                      <button key={p.id} onClick={() => selectProduct(p)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-0">
                        <p className="text-sm font-semibold">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.brand} · SKU: {p.kinsey_sku} · UPC: {p.upc || '—'}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Product + Add to Batch */}
            {selectedProduct && (
              <div className="bg-white rounded-lg shadow p-5 border-2" style={{ borderColor: 'var(--secondary)' }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase">{selectedProduct.brand}</p>
                    <p className="font-bold" style={{ color: 'var(--primary)' }}>{selectedProduct.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      SKU: {selectedProduct.kinsey_sku} · UPC: {selectedProduct.upc || '—'}
                    </p>
                  </div>
                  <button onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Quantity Received</label>
                    <input
                      type="number"
                      min="1"
                      value={itemQty}
                      onChange={e => setItemQty(parseInt(e.target.value) || 1)}
                      className="w-full border rounded-lg px-3 py-2.5 text-sm font-bold text-center text-lg"
                      style={{ borderColor: 'var(--primary)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Your Cost Each
                      {selectedProduct.cost && (
                        <span className="text-gray-400 font-normal ml-1">(last: ${selectedProduct.cost.toFixed(2)})</span>
                      )}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={itemCost}
                        onChange={e => setItemCost(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addToBatch() }}
                        className="w-full border rounded-lg pl-7 pr-3 py-2.5 text-sm"
                        style={{ borderColor: 'var(--primary)' }}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
                {itemQty > 0 && itemCost && (
                  <p className="text-xs text-gray-500 mb-3">
                    Line total: <span className="font-bold">${(itemQty * parseFloat(itemCost)).toFixed(2)}</span>
                  </p>
                )}
                <button onClick={addToBatch}
                  className="w-full py-2.5 rounded-lg font-bold text-white text-sm"
                  style={{ backgroundColor: 'var(--secondary)' }}>
                  + Add to Batch
                </button>
              </div>
            )}
          </div>

          {/* RIGHT — Batch List */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: 'var(--primary)' }}>
                  Current Batch
                </h2>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{batchQty} items · {batchItems.length} products</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--primary)' }}>Total: ${batchTotal.toFixed(2)}</p>
                </div>
              </div>

              {batchItems.length === 0 ? (
                <div className="text-center py-12 text-gray-300">
                  <div className="text-4xl mb-2">📦</div>
                  <p className="text-sm">Scan or search products to add them to this shipment</p>
                </div>
              ) : (
                <div className="space-y-2 mb-5 max-h-96 overflow-y-auto">
                  {batchItems.map(item => (
                    <div key={item.tempId} className="flex items-center gap-3 p-3 rounded-lg"
                      style={{ backgroundColor: 'var(--cream-dark)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.brand} · {item.kinsey_sku}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div>
                          <p className="text-xs text-gray-400 text-center">Qty</p>
                          <input type="number" min="1" value={item.quantity}
                            onChange={e => updateBatchItem(item.tempId, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-16 border rounded px-2 py-1 text-sm text-center" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 text-center">Cost</p>
                          <input type="number" step="0.01" value={item.cost_per_unit}
                            onChange={e => updateBatchItem(item.tempId, 'cost_per_unit', parseFloat(e.target.value) || 0)}
                            className="w-20 border rounded px-2 py-1 text-sm text-center" />
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Total</p>
                          <p className="text-sm font-bold" style={{ color: 'var(--primary)' }}>
                            ${(item.quantity * item.cost_per_unit).toFixed(2)}
                          </p>
                        </div>
                        <button onClick={() => removeFromBatch(item.tempId)}
                          className="text-gray-300 hover:text-red-500 text-lg ml-1">×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {batchItems.length > 0 && (
                <>
                  <div className="border-t pt-4 mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Total Items</span>
                      <span className="font-bold">{batchQty}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Total Products</span>
                      <span className="font-bold">{batchItems.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total Cost</span>
                      <span className="font-bold text-base" style={{ color: 'var(--primary)' }}>
                        ${batchTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={commitReceipt}
                    disabled={submitting}
                    className="w-full py-3 rounded-lg font-bold text-white text-sm"
                    style={{ backgroundColor: submitting ? '#9ca3af' : 'var(--primary)' }}
                  >
                    {submitting ? 'Saving...' : `✓ Receive Shipment (${batchQty} items)`}
                  </button>
                  <button
                    onClick={() => { if (confirm('Clear all items from this batch?')) setBatchItems([]) }}
                    className="w-full mt-2 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-red-500"
                  >
                    Clear Batch
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── FIFO STOCK LEDGER ── */}
      {tab === 'stock' && (
        <div>
          <div className="flex items-center gap-4 mb-5">
            <input type="text" placeholder="Search products..." value={stockSearch}
              onChange={e => setStockSearch(e.target.value)}
              className="border rounded-lg px-4 py-2.5 text-sm w-80" />
            <p className="text-sm text-gray-500">{filteredStock.length} products with stock on hand</p>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loadingStock ? (
              <div className="p-8 text-center text-gray-400">Loading stock ledger...</div>
            ) : filteredStock.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No inventory lots found. Receive a shipment to get started.</div>
            ) : (
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: 'var(--cream-dark)' }}>
                  <tr className="text-left">
                    <th className="px-4 py-3 font-semibold text-gray-600">Product</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">On Hand</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">FIFO Cost/Unit</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Stock Value</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Oldest Lot</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Lots</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.map((s, idx) => {
                    const fifoCostPerUnit = s.totalRemaining > 0 ? s.fifoValue / s.totalRemaining : 0
                    return (
                      <tr key={s.product?.id || idx} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-semibold">{s.product?.name}</p>
                          <p className="text-xs text-gray-400">{s.product?.brand} · {s.product?.kinsey_sku}</p>
                        </td>
                        <td className="px-4 py-3 font-bold">{s.totalRemaining}</td>
                        <td className="px-4 py-3">${fifoCostPerUnit.toFixed(2)}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: 'var(--secondary)' }}>
                          ${s.fifoValue.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(s.oldestDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{s.lots.length}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot style={{ backgroundColor: 'var(--cream-dark)' }}>
                  <tr>
                    <td className="px-4 py-3 font-bold">Total</td>
                    <td className="px-4 py-3 font-bold">{filteredStock.reduce((s, i) => s + i.totalRemaining, 0)}</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 font-bold" style={{ color: 'var(--secondary)' }}>
                      ${filteredStock.reduce((s, i) => s + i.fifoValue, 0).toFixed(2)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── RECEIPT HISTORY ── */}
      {tab === 'history' && (
        <div className="space-y-3">
          {loadingReceipts ? (
            <div className="p-8 text-center text-gray-400">Loading receipts...</div>
          ) : receipts.length === 0 ? (
            <div className="p-8 text-center text-gray-400 bg-white rounded-lg shadow">
              No receipts yet. Receive your first shipment to get started.
            </div>
          ) : receipts.map(receipt => (
            <div key={receipt.id} className="bg-white rounded-lg shadow overflow-hidden">
              <button
                onClick={() => loadReceiptLots(receipt.id)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-6 text-left">
                  <div>
                    <p className="font-bold" style={{ color: 'var(--primary)' }}>
                      {receipt.supplier}
                      {receipt.receipt_number && <span className="text-gray-400 font-normal ml-2">· {receipt.receipt_number}</span>}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(receipt.received_date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                  <div className="hidden sm:block text-sm text-gray-500">
                    {receipt.total_items} items received
                  </div>
                  <div className="hidden sm:block font-bold text-sm" style={{ color: 'var(--secondary)' }}>
                    ${receipt.total_cost?.toFixed(2)}
                  </div>
                  {receipt.notes && (
                    <div className="hidden sm:block text-xs text-gray-400 italic">{receipt.notes}</div>
                  )}
                </div>
                <span className="text-gray-400 ml-4">{expandedReceipt === receipt.id ? '▲' : '▼'}</span>
              </button>

              {expandedReceipt === receipt.id && receiptLots[receipt.id] && (
                <div className="border-t">
                  <table className="w-full text-sm">
                    <thead style={{ backgroundColor: 'var(--cream-dark)' }}>
                      <tr className="text-left">
                        <th className="px-5 py-2 font-semibold text-gray-500">Product</th>
                        <th className="px-5 py-2 font-semibold text-gray-500">Qty Received</th>
                        <th className="px-5 py-2 font-semibold text-gray-500">Qty Remaining</th>
                        <th className="px-5 py-2 font-semibold text-gray-500">Cost/Unit</th>
                        <th className="px-5 py-2 font-semibold text-gray-500">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receiptLots[receipt.id].map(lot => (
                        <tr key={lot.id} className="border-t">
                          <td className="px-5 py-2.5">
                            <p className="font-semibold">{lot.products?.name}</p>
                            <p className="text-xs text-gray-400">{lot.products?.brand} · {lot.products?.kinsey_sku}</p>
                          </td>
                          <td className="px-5 py-2.5">{lot.quantity_received}</td>
                          <td className="px-5 py-2.5">
                            <span className={lot.quantity_remaining === 0 ? 'text-gray-400' : 'font-semibold'}>
                              {lot.quantity_remaining}
                            </span>
                          </td>
                          <td className="px-5 py-2.5">${lot.cost_per_unit.toFixed(2)}</td>
                          <td className="px-5 py-2.5 font-semibold">
                            ${(lot.quantity_received * lot.cost_per_unit).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
