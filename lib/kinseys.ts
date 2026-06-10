const KINSEYS_BASE_URL = process.env.KINSEYS_API_BASE_URL || 'https://api.kinseysinc.com/v2'
const KINSEYS_DEALER_API_KEY = process.env.KINSEYS_DEALER_API_KEY || ''
const KINSEYS_DROPSHIP_API_KEY = process.env.KINSEYS_DROPSHIP_API_KEY || ''

// Base fetch function with auth headers
async function kinseysFetch(endpoint: string, options: RequestInit = {}, useDropship = false) {
  const apiKey = useDropship ? KINSEYS_DROPSHIP_API_KEY : KINSEYS_DEALER_API_KEY
  const response = await fetch(`${KINSEYS_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
      'Kinsey-Source': 'BriarPatchOutdoors-Custom',
      ...options.headers,
    },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(`Kinsey's API error ${response.status}: ${error.message || response.statusText}`)
  }
  return response.json()
}

// Get full product catalog
export async function getProducts() {
  return kinseysFetch('/Products')
}

// Get specific products by ID
export async function getProductsById(productIds: string[]) {
  const ids = productIds.join(',')
  return kinseysFetch(`/Products/GetById?products=${ids}`)
}

// Get list of products allowed for purchase
export async function getAllowedProducts() {
  return kinseysFetch('/Products/Allowed')
}

// Get inventory + pricing for all or specific products
export async function getInventory(productIds?: string[]) {
  const query = productIds && productIds.length > 0
    ? `?products=${productIds.join(',')}`
    : ''
  return kinseysFetch(`/Inventory${query}`)
}

// Create a dropship sales order
export async function createDropshipOrder(order: {
  purchaseOrderNo: string
  customerName: string
  address: string
  address2?: string
  city: string
  state: string
  zipCode: string
  country: string
  phone?: string
  shippingCarrier?: string
  shippingService?: string
  items: Array<{
    productId: string
    quantity: number
    customerPrice: number
  }>
  backOrdersAllowed?: boolean
}) {
  const body = {
    purchaseOrderNo: order.purchaseOrderNo.substring(0, 20),
    shippingCarrier: order.shippingCarrier || 'UPS',
    shippingService: order.shippingService || 'GROUND',
    options: {
      backOrdersAllowed: order.backOrdersAllowed || false,
      splitOrdersAllowed: true,
    },
    shipTo: {
      name: order.customerName,
      address: order.address,
      address2: order.address2 || null,
      city: order.city,
      state: order.state,
      zipCode: order.zipCode,
      country: order.country,
      phone: order.phone || null,
    },
    salesLines: order.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      customPrice: item.customerPrice,
    })),
  }
  return kinseysFetch('/SalesOrder', {
    method: 'POST',
    body: JSON.stringify(body),
  }, true) // use dropship API key
}

// Get order status from Kinsey's
export async function getOrderStatus(salesOrderNo: string) {
  return kinseysFetch(`/SalesOrder/${salesOrderNo}`)
}

// Cancel a pending order
export async function cancelOrder(salesOrderNo: string) {
  return kinseysFetch(`/SalesOrder/${salesOrderNo}`, { method: 'DELETE' })
}

// Get shipment/tracking info by purchase order number
export async function getShipmentInfo(purchaseOrderNo: string) {
  return kinseysFetch(`/Shipments/${encodeURIComponent(purchaseOrderNo)}`)
}