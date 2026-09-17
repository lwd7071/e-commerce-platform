CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE app_users (
  user_id UUID CONSTRAINT pk_app_users PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_app_users__user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT uq_app_users__email UNIQUE (email),
  CONSTRAINT ck_app_users__role CHECK (role IN ('BUYER','SELLER','ADMIN')),
  CONSTRAINT ck_app_users__status CHECK (status IN ('ACTIVE','LOCKED'))
);

CREATE TABLE user_profiles (
  user_id UUID CONSTRAINT pk_user_profiles PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  avatar_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_user_profiles__user_id FOREIGN KEY (user_id) REFERENCES app_users(user_id) ON DELETE RESTRICT
);

CREATE TABLE addresses (
  address_id UUID CONSTRAINT pk_addresses PRIMARY KEY,
  user_id UUID NOT NULL,
  recipient_name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  province VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  ward VARCHAR(100) NOT NULL,
  detail_address VARCHAR(255) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_addresses__user_id FOREIGN KEY (user_id) REFERENCES app_users(user_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_addresses__one_default_per_user ON addresses(user_id) WHERE is_default = TRUE;

CREATE TABLE shops (
  shop_id UUID CONSTRAINT pk_shops PRIMARY KEY,
  owner_id UUID NOT NULL,
  shop_name VARCHAR(150) NOT NULL,
  description TEXT,
  logo_url TEXT,
  pickup_address VARCHAR(255),
  contact_phone VARCHAR(20),
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_shops__owner_id FOREIGN KEY (owner_id) REFERENCES app_users(user_id) ON DELETE RESTRICT,
  CONSTRAINT uq_shops__owner_id UNIQUE (owner_id),
  CONSTRAINT ck_shops__status CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','LOCKED'))
);

CREATE TABLE categories (
  category_id UUID CONSTRAINT pk_categories PRIMARY KEY,
  parent_category_id UUID,
  category_name VARCHAR(150) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_categories__parent_category_id FOREIGN KEY (parent_category_id) REFERENCES categories(category_id) ON DELETE RESTRICT,
  CONSTRAINT ck_categories__status CHECK (status IN ('ACTIVE','INACTIVE'))
);

CREATE TABLE products (
  product_id UUID CONSTRAINT pk_products PRIMARY KEY,
  shop_id UUID NOT NULL,
  category_id UUID NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_products__shop_id FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE RESTRICT,
  CONSTRAINT fk_products__category_id FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE RESTRICT,
  CONSTRAINT ck_products__status CHECK (status IN ('DRAFT','ACTIVE','INACTIVE','HIDDEN'))
);

CREATE TABLE product_images (
  image_id UUID CONSTRAINT pk_product_images PRIMARY KEY,
  product_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT fk_product_images__product_id FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
  CONSTRAINT ck_product_images__sort_order_nonnegative CHECK (sort_order >= 0)
);

CREATE TABLE product_variants (
  variant_id UUID CONSTRAINT pk_product_variants PRIMARY KEY,
  product_id UUID NOT NULL,
  variant_name VARCHAR(100) NOT NULL,
  variant_value VARCHAR(150),
  sku VARCHAR(100) NOT NULL,
  price NUMERIC(15,2) NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_product_variants__product_id FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
  CONSTRAINT ck_product_variants__price_positive CHECK (price > 0),
  CONSTRAINT ck_product_variants__stock_nonnegative CHECK (stock_quantity >= 0),
  CONSTRAINT ck_product_variants__status CHECK (status IN ('ACTIVE','INACTIVE'))
);

CREATE TABLE carts (
  cart_id UUID CONSTRAINT pk_carts PRIMARY KEY,
  buyer_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_carts__buyer_id FOREIGN KEY (buyer_id) REFERENCES app_users(user_id) ON DELETE RESTRICT,
  CONSTRAINT uq_carts__buyer_id UNIQUE (buyer_id)
);

CREATE TABLE cart_items (
  cart_item_id UUID CONSTRAINT pk_cart_items PRIMARY KEY,
  cart_id UUID NOT NULL,
  variant_id UUID NOT NULL,
  quantity INTEGER NOT NULL,
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_cart_items__cart_id FOREIGN KEY (cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items__variant_id FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE RESTRICT,
  CONSTRAINT uq_cart_items__cart_id__variant_id UNIQUE (cart_id, variant_id),
  CONSTRAINT ck_cart_items__quantity_positive CHECK (quantity >= 1)
);

CREATE TABLE orders (
  order_id UUID CONSTRAINT pk_orders PRIMARY KEY,
  buyer_id UUID NOT NULL,
  shop_id UUID NOT NULL,
  recipient_name VARCHAR(150) NOT NULL,
  recipient_phone VARCHAR(20) NOT NULL,
  province VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  ward VARCHAR(100) NOT NULL,
  delivery_address VARCHAR(255) NOT NULL,
  subtotal NUMERIC(15,2) NOT NULL,
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  shipping_fee NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL,
  status VARCHAR(30) NOT NULL,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_orders__buyer_id FOREIGN KEY (buyer_id) REFERENCES app_users(user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders__shop_id FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE RESTRICT,
  CONSTRAINT ck_orders__money_nonnegative CHECK (subtotal >= 0 AND discount_amount >= 0 AND shipping_fee >= 0 AND total_amount >= 0),
  CONSTRAINT ck_orders__total_formula CHECK (total_amount = subtotal + shipping_fee - discount_amount),
  CONSTRAINT ck_orders__status CHECK (status IN ('PENDING_CONFIRMATION','CONFIRMED','PREPARING','SHIPPING','COMPLETED','CANCELLED','DELIVERY_FAILED'))
);

CREATE TABLE order_items (
  order_item_id UUID CONSTRAINT pk_order_items PRIMARY KEY,
  order_id UUID NOT NULL,
  product_id UUID NOT NULL,
  variant_id UUID NOT NULL,
  product_name_snapshot VARCHAR(255) NOT NULL,
  variant_snapshot VARCHAR(255),
  unit_price NUMERIC(15,2) NOT NULL,
  quantity INTEGER NOT NULL,
  line_total NUMERIC(15,2) NOT NULL,
  CONSTRAINT fk_order_items__order_id FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_items__product_id FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_items__variant_id FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE RESTRICT,
  CONSTRAINT ck_order_items__unit_price_positive CHECK (unit_price > 0),
  CONSTRAINT ck_order_items__quantity_positive CHECK (quantity >= 1),
  CONSTRAINT ck_order_items__line_total_nonnegative CHECK (line_total >= 0),
  CONSTRAINT ck_order_items__line_total_formula CHECK (line_total = unit_price * quantity)
);

CREATE TABLE order_status_history (
  history_id UUID CONSTRAINT pk_order_status_history PRIMARY KEY,
  order_id UUID NOT NULL,
  old_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL,
  changed_by UUID,
  reason TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_order_status_history__order_id FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_status_history__changed_by FOREIGN KEY (changed_by) REFERENCES app_users(user_id) ON DELETE SET NULL
);

CREATE TABLE payments (
  payment_id UUID CONSTRAINT pk_payments PRIMARY KEY,
  order_id UUID NOT NULL,
  transaction_code VARCHAR(100),
  method VARCHAR(20) NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  note TEXT,
  CONSTRAINT fk_payments__order_id FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT,
  CONSTRAINT ck_payments__amount_positive CHECK (amount > 0),
  CONSTRAINT ck_payments__method CHECK (method IN ('COD','ONLINE')),
  CONSTRAINT ck_payments__status CHECK (status IN ('PENDING','SUCCESS','FAILED')),
  CONSTRAINT ck_payments__success_paid_at CHECK (status <> 'SUCCESS' OR paid_at IS NOT NULL)
);
CREATE UNIQUE INDEX uq_payments__one_success_per_order ON payments(order_id) WHERE status = 'SUCCESS';
CREATE UNIQUE INDEX uq_payments__transaction_code ON payments(transaction_code) WHERE transaction_code IS NOT NULL;

CREATE TABLE shipments (
  shipment_id UUID CONSTRAINT pk_shipments PRIMARY KEY,
  order_id UUID NOT NULL,
  carrier_name VARCHAR(150),
  tracking_code VARCHAR(100),
  status VARCHAR(30) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_shipments__order_id FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT,
  CONSTRAINT uq_shipments__order_id UNIQUE (order_id),
  CONSTRAINT ck_shipments__status CHECK (status IN ('PENDING','HANDED_OVER','SHIPPING','DELIVERED','FAILED'))
);
CREATE UNIQUE INDEX uq_shipments__tracking_code ON shipments(tracking_code) WHERE tracking_code IS NOT NULL;

CREATE TABLE vouchers (
  voucher_id UUID CONSTRAINT pk_vouchers PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  voucher_name VARCHAR(150) NOT NULL,
  scope VARCHAR(20) NOT NULL,
  shop_id UUID,
  discount_type VARCHAR(20) NOT NULL,
  discount_value NUMERIC(15,2) NOT NULL,
  max_discount NUMERIC(15,2),
  min_order_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_vouchers__shop_id FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE RESTRICT,
  CONSTRAINT uq_vouchers__code UNIQUE (code),
  CONSTRAINT ck_vouchers__scope CHECK ((scope = 'PLATFORM' AND shop_id IS NULL) OR (scope = 'SHOP' AND shop_id IS NOT NULL)),
  CONSTRAINT ck_vouchers__discount_type CHECK (discount_type IN ('PERCENT','FIXED')),
  CONSTRAINT ck_vouchers__discount_value CHECK (discount_value > 0 AND (discount_type <> 'PERCENT' OR discount_value <= 100)),
  CONSTRAINT ck_vouchers__amounts CHECK (max_discount IS NULL OR max_discount >= 0),
  CONSTRAINT ck_vouchers__min_order_value CHECK (min_order_value >= 0),
  CONSTRAINT ck_vouchers__quantity CHECK (quantity >= 0),
  CONSTRAINT ck_vouchers__time_range CHECK (start_at < end_at),
  CONSTRAINT ck_vouchers__status CHECK (status IN ('ACTIVE','INACTIVE'))
);

CREATE TABLE voucher_usages (
  usage_id UUID CONSTRAINT pk_voucher_usages PRIMARY KEY,
  voucher_id UUID NOT NULL,
  order_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  discount_amount NUMERIC(15,2) NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_voucher_usages__voucher_id FOREIGN KEY (voucher_id) REFERENCES vouchers(voucher_id) ON DELETE RESTRICT,
  CONSTRAINT fk_voucher_usages__order_id FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT,
  CONSTRAINT fk_voucher_usages__buyer_id FOREIGN KEY (buyer_id) REFERENCES app_users(user_id) ON DELETE RESTRICT,
  CONSTRAINT uq_voucher_usages__order_id UNIQUE (order_id),
  CONSTRAINT ck_voucher_usages__discount_nonnegative CHECK (discount_amount >= 0)
);

CREATE TABLE reviews (
  review_id UUID CONSTRAINT pk_reviews PRIMARY KEY,
  buyer_id UUID NOT NULL,
  product_id UUID NOT NULL,
  order_item_id UUID NOT NULL,
  rating SMALLINT NOT NULL,
  content TEXT,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_reviews__buyer_id FOREIGN KEY (buyer_id) REFERENCES app_users(user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_reviews__product_id FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
  CONSTRAINT fk_reviews__order_item_id FOREIGN KEY (order_item_id) REFERENCES order_items(order_item_id) ON DELETE RESTRICT,
  CONSTRAINT uq_reviews__order_item_id UNIQUE (order_item_id),
  CONSTRAINT ck_reviews__rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT ck_reviews__status CHECK (status IN ('VISIBLE','HIDDEN'))
);

CREATE TABLE review_images (
  review_image_id UUID CONSTRAINT pk_review_images PRIMARY KEY,
  review_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT fk_review_images__review_id FOREIGN KEY (review_id) REFERENCES reviews(review_id) ON DELETE CASCADE,
  CONSTRAINT ck_review_images__sort_order_nonnegative CHECK (sort_order >= 0)
);

CREATE TABLE notifications (
  notification_id UUID CONSTRAINT pk_notifications PRIMARY KEY,
  recipient_id UUID NOT NULL,
  type VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  CONSTRAINT fk_notifications__recipient_id FOREIGN KEY (recipient_id) REFERENCES app_users(user_id) ON DELETE RESTRICT,
  CONSTRAINT ck_notifications__type CHECK (type IN ('ORDER','PAYMENT','SHIPPING','VIOLATION','SYSTEM')),
  CONSTRAINT ck_notifications__read_at CHECK (NOT is_read OR read_at IS NOT NULL)
);

CREATE TABLE moderation_records (
  moderation_id UUID CONSTRAINT pk_moderation_records PRIMARY KEY,
  target_type VARCHAR(30) NOT NULL,
  target_id UUID,
  reason TEXT NOT NULL,
  action VARCHAR(50) NOT NULL,
  admin_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_moderation_records__admin_id FOREIGN KEY (admin_id) REFERENCES app_users(user_id) ON DELETE RESTRICT
);

CREATE TABLE admin_logs (
  log_id UUID CONSTRAINT pk_admin_logs PRIMARY KEY,
  admin_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(30),
  target_id UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_admin_logs__admin_id FOREIGN KEY (admin_id) REFERENCES app_users(user_id) ON DELETE RESTRICT
);

CREATE INDEX idx_app_users__email ON app_users(email);
CREATE INDEX idx_products__product_name ON products(product_name);
CREATE INDEX idx_products__shop_id ON products(shop_id);
CREATE INDEX idx_products__category_id ON products(category_id);
CREATE INDEX idx_product_variants__sku ON product_variants(sku);
CREATE INDEX idx_orders__buyer_id__created_at ON orders(buyer_id, created_at DESC);
CREATE INDEX idx_orders__shop_id__created_at ON orders(shop_id, created_at DESC);
CREATE INDEX idx_orders__status__created_at ON orders(status, created_at DESC);
CREATE INDEX idx_payments__order_id ON payments(order_id);
CREATE INDEX idx_shipments__order_id ON shipments(order_id);
CREATE INDEX idx_vouchers__code ON vouchers(code);
CREATE INDEX idx_reviews__product_id__created_at ON reviews(product_id, created_at DESC);
CREATE INDEX idx_reviews__product_id__rating ON reviews(product_id, rating);
CREATE INDEX idx_notifications__recipient_id__is_read__created_at ON notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX idx_admin_logs__admin_id__created_at ON admin_logs(admin_id, created_at DESC);

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['app_users','user_profiles','addresses','shops','categories','products','product_images','product_variants','carts','cart_items','orders','order_items','order_status_history','payments','shipments','vouchers','voucher_usages','reviews','review_images','notifications','moderation_records','admin_logs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', table_name);
  END LOOP;
END $$;
