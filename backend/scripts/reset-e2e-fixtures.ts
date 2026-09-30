import '../src/platform/config/load-root-env.ts';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { loadDatabaseConfig } from '../db/config.ts';
import { assertE2ESeedAllowed } from '../db/seed/e2e-seed-safety.ts';
import { assertE2EFixtureAccountsSafe, type ExistingE2EAuthAccount } from '../db/seed/e2e-fixture-account-guard.ts';
import { resetE2EBuyerAddress, resetE2EBuyerCart } from '../db/seed/e2e-fixture-reset.ts';
import { buildProductImagePath } from '../db/storage.ts';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the E2E fixture reset`);
  return value;
};

const config = loadDatabaseConfig(process.env);
const projectRef = config.supabaseUrl.hostname.split('.')[0];
const databaseHost = config.directUrl.hostname;
assertE2ESeedAllowed({
  nodeEnv: process.env.NODE_ENV,
  databaseEnvironment: process.env.DATABASE_ENVIRONMENT,
  expectedProjectRef: process.env.EXPECTED_SUPABASE_PROJECT_REF,
  allowedProjectRefs: process.env.E2E_ALLOWED_SUPABASE_PROJECT_REFS,
  expectedDatabaseHost: process.env.EXPECTED_DATABASE_HOST,
  allowedDatabaseHosts: process.env.E2E_ALLOWED_DATABASE_HOSTS,
  allowE2ESeed: process.env.ALLOW_E2E_SEED,
}, { projectRef, databaseHost });

const password = required('E2E_SEED_PASSWORD');
const supabase = createClient(config.supabaseUrl.toString(), required('SUPABASE_TEST_SECRET_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 2 });

const users = [
  { key: 'buyer', email: 'buyer@dino-e2e.test', name: 'E2E Buyer', role: 'BUYER' as const },
  { key: 'sellerPending', email: 'seller-pending@dino-e2e.test', name: 'E2E Seller Pending', role: 'SELLER' as const },
  { key: 'sellerActive', email: 'seller-active@dino-e2e.test', name: 'E2E Seller Active', role: 'SELLER' as const },
  { key: 'admin', email: 'admin@dino-e2e.test', name: 'E2E Admin', role: 'ADMIN' as const },
];
type UserKey = (typeof users)[number]['key'];
const userIds = new Map<UserKey, string>();

async function findAuthUser(email: string): Promise<ExistingE2EAuthAccount | null> {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return { id: match.id, email: match.email ?? email, userMetadata: match.user_metadata };
    if (data.users.length < 1000) return null;
  }
}

async function ensureAuthUser(
  account: (typeof users)[number],
  existing: ExistingE2EAuthAccount | null,
): Promise<string> {
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: account.name, e2e_fixture: true },
    });
    if (error || !data.user) throw error ?? new Error(`Unable to refresh E2E account ${account.email}`);
    return data.user.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: account.name, e2e_fixture: true },
  });
  if (error || !data.user) throw error ?? new Error(`Unable to create E2E account ${account.email}`);
  return data.user.id;
}

const ids = {
  category: 'e2000000-0000-4000-8000-000000000001',
  pendingShop: 'e2000000-0000-4000-8000-000000000002',
  activeShop: 'e2000000-0000-4000-8000-000000000003',
  product: 'e2000000-0000-4000-8000-000000000004',
  productImage: 'e2000000-0000-4000-8000-000000000013',
  regularVariant: 'e2000000-0000-4000-8000-000000000005',
  lastItemVariant: 'e2000000-0000-4000-8000-000000000006',
  address: 'e2000000-0000-4000-8000-000000000007',
  cart: 'e2000000-0000-4000-8000-000000000008',
  voucher: 'e2000000-0000-4000-8000-000000000009',
  notification: 'e2000000-0000-4000-8000-000000000010',
} as const;

const fixtureImagePath = buildProductImagePath(ids.activeShop, ids.product, ids.productImage, 'png');
const fixtureImageBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/k1sAAAAASUVORK5CYII=',
  'base64',
);

const fixtureUuid = (sequence: number): string =>
  `e2000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;

const orderFixtures = [
  { suffix: '01', status: 'PENDING_CONFIRMATION', shipment: null },
  { suffix: '02', status: 'CONFIRMED', shipment: 'PENDING' },
  { suffix: '03', status: 'PREPARING', shipment: 'PENDING' },
  { suffix: '04', status: 'SHIPPING', shipment: 'HANDED_OVER' },
  { suffix: '05', status: 'COMPLETED', shipment: 'DELIVERED' },
  { suffix: '06', status: 'COMPLETED', shipment: 'DELIVERED' },
  { suffix: '07', status: 'CANCELLED', shipment: null },
  { suffix: '08', status: 'DELIVERY_FAILED', shipment: 'FAILED' },
] as const;

async function resetDatabaseFixtures(): Promise<void> {
  const client = await pool.connect();
  let removeUploadedImageOnFailure = false;
  try {
    await client.query('BEGIN');

    const buyerId = userIds.get('buyer')!;
    const activeSellerId = userIds.get('sellerActive')!;
    const pendingSellerId = userIds.get('sellerPending')!;
    const adminId = userIds.get('admin')!;

    // Tests may create orders, reviews, vouchers usages, notifications and products.
    // This scope is safe because these four accounts and the two shops are E2E-only fixtures.
    await client.query(`
      DELETE FROM voucher_usages vu USING orders o
      WHERE vu.order_id=o.order_id AND o.buyer_id=$1`, [buyerId]);
    await client.query(`
      DELETE FROM reviews r USING order_items oi, orders o
      WHERE r.order_item_id=oi.order_item_id AND oi.order_id=o.order_id AND o.buyer_id=$1`, [buyerId]);
    await client.query(`DELETE FROM order_items oi USING orders o WHERE oi.order_id=o.order_id AND o.buyer_id=$1`, [buyerId]);
    await client.query(`DELETE FROM payments p USING orders o WHERE p.order_id=o.order_id AND o.buyer_id=$1`, [buyerId]);
    await client.query(`DELETE FROM shipments s USING orders o WHERE s.order_id=o.order_id AND o.buyer_id=$1`, [buyerId]);
    await client.query(`DELETE FROM order_status_history h USING orders o WHERE h.order_id=o.order_id AND o.buyer_id=$1`, [buyerId]);
    await client.query('DELETE FROM orders WHERE buyer_id=$1', [buyerId]);
    await client.query('DELETE FROM notifications WHERE recipient_id=$1', [buyerId]);

    await client.query(`
      DELETE FROM product_variants v USING products p
      WHERE v.product_id=p.product_id AND p.shop_id=$1 AND p.product_id<>$2`, [ids.activeShop, ids.product]);
    await client.query('DELETE FROM products WHERE shop_id=$1 AND product_id<>$2', [ids.activeShop, ids.product]);

    const accountRows = [
      { id: buyerId, email: 'buyer@dino-e2e.test', role: 'BUYER', name: 'E2E Buyer' },
      { id: pendingSellerId, email: 'seller-pending@dino-e2e.test', role: 'SELLER', name: 'E2E Seller Pending' },
      { id: activeSellerId, email: 'seller-active@dino-e2e.test', role: 'SELLER', name: 'E2E Seller Active' },
      { id: adminId, email: 'admin@dino-e2e.test', role: 'ADMIN', name: 'E2E Admin' },
    ];
    for (const account of accountRows) {
      await client.query(`
        INSERT INTO app_users(user_id,email,role,status) VALUES($1,$2,$3,'ACTIVE')
        ON CONFLICT(user_id) DO UPDATE SET email=EXCLUDED.email,role=EXCLUDED.role,status='ACTIVE',updated_at=now()`,
      [account.id, account.email, account.role]);
      await client.query(`
        INSERT INTO user_profiles(user_id,full_name,phone,avatar_url) VALUES($1,$2,NULL,NULL)
        ON CONFLICT(user_id) DO UPDATE SET full_name=EXCLUDED.full_name,phone=NULL,avatar_url=NULL,updated_at=now()`,
      [account.id, account.name]);
    }

    await client.query(`
      INSERT INTO shops(shop_id,owner_id,shop_name,status)
      VALUES($1,$2,'Dino E2E Pending Shop','PENDING'),($3,$4,'Dino E2E Active Shop','ACTIVE')
      ON CONFLICT(shop_id) DO UPDATE SET owner_id=EXCLUDED.owner_id,shop_name=EXCLUDED.shop_name,status=EXCLUDED.status,updated_at=now()`,
    [ids.pendingShop, pendingSellerId, ids.activeShop, activeSellerId]);
    await client.query(`
      INSERT INTO categories(category_id,parent_category_id,category_name,description,status)
      VALUES($1,NULL,'E2E Category','Deterministic test fixture','ACTIVE')
      ON CONFLICT(category_id) DO UPDATE SET category_name=EXCLUDED.category_name,description=EXCLUDED.description,status='ACTIVE',updated_at=now()`,
    [ids.category]);
    await client.query(`
      INSERT INTO products(product_id,shop_id,category_id,product_name,description,status)
      VALUES($1,$2,$3,'E2E Product','Stable product fixture','ACTIVE')
      ON CONFLICT(product_id) DO UPDATE SET shop_id=EXCLUDED.shop_id,category_id=EXCLUDED.category_id,product_name=EXCLUDED.product_name,description=EXCLUDED.description,status='ACTIVE',updated_at=now()`,
    [ids.product, ids.activeShop, ids.category]);
    await client.query('DELETE FROM product_images WHERE product_id=$1', [ids.product]);
    await client.query(`
      DELETE FROM media_uploads
      WHERE bucket_id='product-media' AND object_path LIKE $1 AND object_path<>$2
    `, [`shops/${ids.activeShop}/products/${ids.product}/%`, fixtureImagePath]);

    const productStorage = supabase.storage.from('product-media');
    const { data: existingObjects, error: listError } = await productStorage.list(
      `shops/${ids.activeShop}/products/${ids.product}`,
      { limit: 1000, offset: 0 },
    );
    if (listError) throw listError;
    const fixtureImageAlreadyExists = existingObjects?.some(({ name }) => name === `${ids.productImage}.png`) ?? false;
    if (existingObjects?.length) {
      const stalePaths = existingObjects
        .map(({ name }) => `shops/${ids.activeShop}/products/${ids.product}/${name}`)
        .filter((path) => path !== fixtureImagePath);
      if (stalePaths.length) {
        const { error } = await productStorage.remove(stalePaths);
        if (error) throw error;
      }
    }
    const { error: uploadError } = await productStorage.upload(fixtureImagePath, fixtureImageBytes, {
      contentType: 'image/png', upsert: true,
    });
    if (uploadError) throw uploadError;
    removeUploadedImageOnFailure = !fixtureImageAlreadyExists;
    const { data: publicImage } = productStorage.getPublicUrl(fixtureImagePath);
    await client.query(`
      INSERT INTO product_images(image_id,product_id,image_url,sort_order)
      VALUES($1,$2,$3,0)
      ON CONFLICT(image_id) DO UPDATE SET product_id=EXCLUDED.product_id,image_url=EXCLUDED.image_url,sort_order=0
    `, [ids.productImage, ids.product, publicImage.publicUrl]);
    await client.query(`
      INSERT INTO media_uploads(media_id,owner_id,purpose,bucket_id,object_path,status,expires_at,finalized_at,attached_at)
      VALUES($1,$2,'PRODUCT','product-media',$3,'ATTACHED',now()+interval '1 day',now(),now())
      ON CONFLICT(media_id) DO UPDATE SET owner_id=EXCLUDED.owner_id,purpose='PRODUCT',bucket_id='product-media',
        object_path=EXCLUDED.object_path,status='ATTACHED',expires_at=EXCLUDED.expires_at,
        finalized_at=EXCLUDED.finalized_at,attached_at=EXCLUDED.attached_at,deleted_at=NULL,cleanup_error=NULL,updated_at=now()
    `, [ids.productImage, activeSellerId, fixtureImagePath]);
    await client.query(`
      INSERT INTO product_variants(variant_id,product_id,variant_name,variant_value,sku,price,stock_quantity,status)
      VALUES($1,$2,'Size','Regular','E2E-REGULAR','100000.00',25,'ACTIVE'),
            ($3,$2,'Size','Last item','E2E-LAST-ITEM','100000.00',1,'ACTIVE')
      ON CONFLICT(variant_id) DO UPDATE SET product_id=EXCLUDED.product_id,variant_name=EXCLUDED.variant_name,variant_value=EXCLUDED.variant_value,sku=EXCLUDED.sku,price=EXCLUDED.price,stock_quantity=EXCLUDED.stock_quantity,status='ACTIVE',updated_at=now()`,
    [ids.regularVariant, ids.product, ids.lastItemVariant]);
    await resetE2EBuyerAddress(client, {
      buyerId, addressId: ids.address, recipientName: 'E2E Buyer', phone: '0900000000',
      province: 'TP Hồ Chí Minh', district: 'Quận 1', ward: 'Bến Nghé', detailAddress: '1 Dino E2E Street',
    });
    await resetE2EBuyerCart(client, { buyerId, cartId: ids.cart });
    await client.query(`
      INSERT INTO cart_items(cart_item_id,cart_id,variant_id,quantity,is_selected)
      VALUES($1,$2,$3,1,true),($4,$2,$5,1,false)
      ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=1,is_selected=EXCLUDED.is_selected,updated_at=now()`,
    ['e2000000-0000-4000-8000-000000000011', ids.cart, ids.regularVariant,
      'e2000000-0000-4000-8000-000000000012', ids.lastItemVariant]);
    await client.query(`
      INSERT INTO vouchers(voucher_id,code,voucher_name,scope,shop_id,discount_type,discount_value,max_discount,min_order_value,quantity,start_at,end_at,status)
      VALUES($1,'E2E-SAVE','E2E Checkout Voucher','PLATFORM',NULL,'FIXED','10000.00',NULL,'50000.00',100,now()-interval '1 day',now()+interval '30 days','ACTIVE')
      ON CONFLICT(voucher_id) DO UPDATE SET code=EXCLUDED.code,voucher_name=EXCLUDED.voucher_name,scope='PLATFORM',shop_id=NULL,discount_type='FIXED',discount_value='10000.00',max_discount=NULL,min_order_value='50000.00',quantity=100,start_at=now()-interval '1 day',end_at=now()+interval '30 days',status='ACTIVE',updated_at=now()`,
    [ids.voucher]);

    for (const fixture of orderFixtures) {
      const numericSuffix = Number(fixture.suffix);
      const orderId = fixtureUuid(1000 + numericSuffix);
      const paymentId = fixtureUuid(2000 + numericSuffix);
      const itemId = fixtureUuid(3000 + numericSuffix);
      await client.query(`
        INSERT INTO orders(order_id,buyer_id,shop_id,recipient_name,recipient_phone,province,district,ward,delivery_address,subtotal,discount_amount,shipping_fee,total_amount,status)
        VALUES($1,$2,$3,'E2E Buyer','0900000000','TP Hồ Chí Minh','Quận 1','Bến Nghé','1 Dino E2E Street',100000,0,0,100000,$4)
        ON CONFLICT(order_id) DO UPDATE SET buyer_id=EXCLUDED.buyer_id,shop_id=EXCLUDED.shop_id,status=EXCLUDED.status,subtotal=100000,discount_amount=0,shipping_fee=0,total_amount=100000,updated_at=now()`,
      [orderId, buyerId, ids.activeShop, fixture.status]);
      await client.query(`
        INSERT INTO order_items(order_item_id,order_id,product_id,variant_id,product_name_snapshot,variant_snapshot,unit_price,quantity,line_total)
        VALUES($1,$2,$3,$4,'E2E Product','Regular',100000,1,100000)
        ON CONFLICT(order_item_id) DO UPDATE SET order_id=EXCLUDED.order_id,product_id=EXCLUDED.product_id,variant_id=EXCLUDED.variant_id,quantity=1,unit_price=100000,line_total=100000`,
      [itemId, orderId, ids.product, ids.regularVariant]);
      await client.query('DELETE FROM order_status_history WHERE order_id=$1', [orderId]);
      await client.query(`
        INSERT INTO order_status_history(history_id,order_id,old_status,new_status,changed_by,reason)
        VALUES($1,$2,NULL,$3,$4,'E2E baseline')`,
      [fixtureUuid(4000 + numericSuffix), orderId, fixture.status, adminId]);
      await client.query(`
        INSERT INTO payments(payment_id,order_id,method,amount,status)
        VALUES($1,$2,'COD',100000,'PENDING')
        ON CONFLICT(payment_id) DO UPDATE SET order_id=EXCLUDED.order_id,method='COD',amount=100000,status='PENDING',paid_at=NULL`,
      [paymentId, orderId]);
      if (fixture.shipment) {
        await client.query(`
          INSERT INTO shipments(shipment_id,order_id,status)
          VALUES($1,$2,$3)
          ON CONFLICT(order_id) DO UPDATE SET status=EXCLUDED.status,carrier_name=NULL,tracking_code=NULL,updated_at=now()`,
        [fixtureUuid(5000 + numericSuffix), orderId, fixture.shipment]);
      }
      if (fixture.suffix === '06') {
        await client.query(`
          INSERT INTO reviews(review_id,buyer_id,product_id,order_item_id,rating,content,status)
          VALUES($1,$2,$3,$4,5,'E2E review fixture','VISIBLE')
          ON CONFLICT(order_item_id) DO UPDATE SET buyer_id=EXCLUDED.buyer_id,product_id=EXCLUDED.product_id,rating=5,content=EXCLUDED.content,status='VISIBLE',updated_at=now()`,
        [fixtureUuid(6000 + numericSuffix), buyerId, ids.product, itemId]);
      }
    }

    await client.query(`
      INSERT INTO notifications(notification_id,recipient_id,type,title,content,is_read,created_at,read_at,event_id)
      VALUES($1,$2,'ORDER','Đơn hàng đang được chuẩn bị','Cửa hàng đã xác nhận đơn hàng E2E.',false,now(),NULL,'e2e-seed-notification')
      ON CONFLICT(notification_id) DO UPDATE SET recipient_id=EXCLUDED.recipient_id,type='ORDER',title=EXCLUDED.title,content=EXCLUDED.content,is_read=false,read_at=NULL,created_at=now()`,
    [ids.notification, buyerId]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (removeUploadedImageOnFailure) {
      await supabase.storage.from('product-media').remove([fixtureImagePath]).catch(() => undefined);
    }
    throw error;
  } finally {
    client.release();
  }
}

try {
  // Preflight every fixture email before changing any Auth account.
  const existingAccounts = await Promise.all(users.map(({ email }) => findAuthUser(email)));
  assertE2EFixtureAccountsSafe(
    users.map(({ email }) => email),
    existingAccounts.filter((account): account is ExistingE2EAuthAccount => account !== null),
  );
  for (const [index, account] of users.entries()) {
    userIds.set(account.key, await ensureAuthUser(account, existingAccounts[index]));
  }
  await resetDatabaseFixtures();
  process.stdout.write(JSON.stringify({
    project_ref: projectRef,
    database_host: databaseHost,
    reset: true,
    accounts: Object.fromEntries([...userIds].map(([key, id]) => [key, id])),
    fixtures: { product_stock: 25, last_item_stock: 1, order_statuses: [...new Set(orderFixtures.map(({ status }) => status))] },
  }, null, 2) + '\n');
} finally {
  await pool.end();
}
