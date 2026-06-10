-- ============================================================
-- CUSTOMERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'GA',
  zip TEXT,
  customer_group_id UUID REFERENCES customer_groups(id) ON DELETE SET NULL,
  notes TEXT,
  lifetime_spend NUMERIC(10,2) DEFAULT 0,
  visit_count INT DEFAULT 0,
  created_source TEXT DEFAULT 'store', -- 'store', 'pos', 'web'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_last_name ON customers(last_name);
CREATE INDEX IF NOT EXISTS idx_customers_group ON customers(customer_group_id);

-- ============================================================
-- ORDERS TABLE  (if not already created)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'pos',  -- 'pos' or 'web'
  status TEXT NOT NULL DEFAULT 'completed',
  payment_method TEXT,  -- 'cash', 'card', 'check'
  payment_status TEXT DEFAULT 'paid',
  subtotal NUMERIC(10,2),
  discount_amount NUMERIC(10,2) DEFAULT 0,
  discount_percentage NUMERIC(5,2) DEFAULT 0,
  tax NUMERIC(10,2),
  total NUMERIC(10,2),
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);

-- ============================================================
-- ORDER ITEMS TABLE  (if not already created)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  kinsey_sku TEXT,
  product_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  discount_percentage NUMERIC(5,2) DEFAULT 0,
  line_total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- ============================================================
-- ORDER NUMBER SEQUENCES  (triggers for auto order numbers)
-- ============================================================

-- Sequence for POS orders
CREATE SEQUENCE IF NOT EXISTS pos_order_seq START 1001;
-- Sequence for Web orders
CREATE SEQUENCE IF NOT EXISTS web_order_seq START 1001;

-- Trigger function
CREATE OR REPLACE FUNCTION assign_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    IF NEW.source = 'pos' THEN
      NEW.order_number := 'POS-' || nextval('pos_order_seq');
    ELSE
      NEW.order_number := 'WEB-' || nextval('web_order_seq');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_assign_order_number ON orders;
CREATE TRIGGER trg_assign_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION assign_order_number();

-- ============================================================
-- DECREMENT INVENTORY FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION decrement_inventory(p_product_id UUID, p_quantity INT)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET quantity = GREATEST(0, quantity - p_quantity)
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CUSTOMER GROUPS TABLE  (if not already created)
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  discount_percentage NUMERIC(5,2) DEFAULT 0,
  description TEXT,
  is_default_store BOOLEAN DEFAULT FALSE,
  is_default_web BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default groups (idempotent)
INSERT INTO customer_groups (name, discount_percentage, description, is_default_store, is_default_web)
VALUES
  ('Store Customer', 0, 'Regular in-store customer', TRUE, FALSE),
  ('Website Customer', 0, 'Regular online customer', FALSE, TRUE),
  ('Friends and Family', 10, 'Staff friends and family discount', FALSE, FALSE),
  ('Misfits', 15, 'VIP loyalty group', FALSE, FALSE)
ON CONFLICT DO NOTHING;
