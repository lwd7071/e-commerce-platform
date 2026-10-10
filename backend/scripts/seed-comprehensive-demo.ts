import '../src/platform/config/load-root-env.ts';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// 1. Cấu hình kết nối & kiểm tra môi trường
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
const directUrl = process.env.DIRECT_URL;

if (!supabaseUrl || !supabaseSecret || !directUrl) {
  throw new Error('Thiếu cấu hình SUPABASE_URL, SUPABASE_SECRET_KEY hoặc DIRECT_URL trong file .env');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseSecret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const pool = new pg.Pool({
  connectionString: directUrl,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

const SHARED_PASSWORD = 'DinoDemo!2026#Mvp';
const BASE_DATE = new Date('2026-10-10T12:00:00.000Z'); // 10/10/2026 UTC

function daysAgo(days: number, hour = 10, minute = 0): string {
  const d = new Date(BASE_DATE);
  d.setDate(d.getDate() - days);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

console.log('================================================================');
console.log('BẮT ĐẦU QUY TRÌNH SEED DỮ LIỆU TOÀN DIỆN CHO DỰ ÁN DINO SHOPPING');
console.log(`Quy ước ngày hiện tại: 10/10/2026 | Mật khẩu chung: ${SHARED_PASSWORD}`);
console.log('================================================================\n');

async function runSeed() {
  const client = await pool.connect();
  try {
    // -------------------------------------------------------------------------
    // BƯỚC 1: ĐỒNG BỘ 26 TÀI KHOẢN TRONG SUPABASE AUTH
    // -------------------------------------------------------------------------
    console.log('>>> [Bước 1/11] Đồng bộ 26 tài khoản trong Supabase Auth...');

    const sellerAccounts = Array.from({ length: 20 }, (_, i) => ({
      email: `seller${String(i + 1).padStart(2, '0')}@dino-demo.test`,
      fullName: `Chủ Shop Demo ${String(i + 1).padStart(2, '0')}`,
      role: 'SELLER' as const,
    }));

    const buyerAccounts = Array.from({ length: 5 }, (_, i) => ({
      email: `buyer${String(i + 1).padStart(2, '0')}@dino-demo.test`,
      fullName: [
        'Nguyễn Đức Thắng',
        'Trần Mỹ Linh',
        'Lê Đình Phong',
        'Phạm Quỳnh Anh',
        'Hoàng Minh Triết',
      ][i],
      role: 'BUYER' as const,
    }));

    const adminAccount = {
      email: 'admin@dino-demo.test',
      fullName: 'Võ Văn Quản Trị',
      role: 'ADMIN' as const,
    };

    const targetAccounts = [...sellerAccounts, ...buyerAccounts, adminAccount];

    // Lấy danh sách users hiện có trong Supabase Auth
    const existingAuthMap = new Map<string, string>(); // email -> id
    for (let page = 1; ; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      for (const u of data.users) {
        if (u.email) existingAuthMap.set(u.email.toLowerCase(), u.id);
      }
      if (data.users.length < 1000) break;
    }

    const userUuidMap = new Map<string, string>(); // email -> id

    for (const target of targetAccounts) {
      const existingId = existingAuthMap.get(target.email.toLowerCase());
      if (existingId) {
        // Cập nhật lại mật khẩu và metadata
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existingId, {
          password: SHARED_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: target.fullName, demo_seed: 'dino-2026' },
        });
        if (error) throw new Error(`Lỗi cập nhật mật khẩu cho ${target.email}: ${error.message}`);
        userUuidMap.set(target.email, existingId);
      } else {
        // Tạo mới tài khoản auth
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: target.email,
          password: SHARED_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: target.fullName, demo_seed: 'dino-2026' },
        });
        if (error || !data.user) throw new Error(`Lỗi tạo tài khoản auth cho ${target.email}: ${error?.message}`);
        userUuidMap.set(target.email, data.user.id);
      }
    }
    console.log(`✓ Đã đồng bộ thành công ${userUuidMap.size} tài khoản Auth với mật khẩu '${SHARED_PASSWORD}'.\n`);

    // -------------------------------------------------------------------------
    // BƯỚC 2: DỌN DẸP SẠCH CÁC BẢNG DỮ LIỆU NGHIỆP VỤ (TRUNCATE CASCADE)
    // -------------------------------------------------------------------------
    console.log('>>> [Bước 2/11] Làm sạch dữ liệu nghiệp vụ cũ (TRUNCATE CASCADE)...');
    await client.query('BEGIN');

    await client.query(`
      TRUNCATE TABLE 
        admin_notification_campaign_recipients,
        admin_notification_campaigns,
        admin_logs,
        moderation_records,
        loyalty_point_transactions,
        flash_sale_compensation_logs,
        flash_sale_items,
        flash_sale_sessions,
        chat_messages,
        chat_conversations,
        notifications,
        review_images,
        reviews,
        voucher_usages,
        vouchers,
        shipments,
        payments,
        order_status_history,
        order_items,
        orders,
        escrow_records,
        wallet_transactions,
        withdrawal_requests,
        shop_wallets,
        cart_items,
        carts,
        product_images,
        product_variants,
        products,
        categories,
        addresses,
        user_profiles,
        shops,
        media_uploads,
        api_idempotency_records
      CASCADE;
    `);

    // Xóa các user test/mồ côi khỏi app_users (chỉ giữ lại 26 tài khoản demo và tài khoản admin chính chủ nếu có)
    const preserveUserIds = Array.from(userUuidMap.values());
    await client.query(
      `DELETE FROM app_users 
       WHERE email LIKE '%test.com' 
          OR email LIKE '%flashsale.test' 
          OR (email NOT IN ($1, $2, $3, $4) AND email NOT LIKE '%@dino-demo.test')`,
      [
        'luongvietvidong@gmail.com',
        'nhatnguyen10a1thd@gmail.com',
        'nthai212006@gmail.com',
        'thangtramlk123@gmail.com',
      ]
    );

    console.log('✓ Đã dọn dẹp sạch sẽ toàn bộ bảng nghiệp vụ cũ.\n');

    // -------------------------------------------------------------------------
    // BƯỚC 3: TẠO APP_USERS, USER_PROFILES & ADDRESSES
    // -------------------------------------------------------------------------
    console.log('>>> [Bước 3/11] Tạo app_users, user_profiles và địa chỉ giao hàng...');

    for (const target of targetAccounts) {
      const uid = userUuidMap.get(target.email)!;
      await client.query(
        `INSERT INTO app_users (user_id, email, role, status, buyer_tier, total_spent, loyalty_points, created_at, updated_at)
         VALUES ($1, $2, $3, 'ACTIVE', $4, 0, 0, $5, $5)
         ON CONFLICT (user_id) DO UPDATE 
         SET email = EXCLUDED.email, role = EXCLUDED.role, status = 'ACTIVE', updated_at = now()`,
        [uid, target.email, target.role, target.role === 'BUYER' ? 'STANDARD' : 'STANDARD', daysAgo(35)]
      );

      // User profile
      const phone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;
      const avatarUrl = target.role === 'SELLER'
        ? `https://images.unsplash.com/photo-${1534528741775 + targetAccounts.indexOf(target)}?auto=format&fit=crop&w=200&q=80`
        : `https://images.unsplash.com/photo-${1535713875002 + targetAccounts.indexOf(target)}?auto=format&fit=crop&w=200&q=80`;

      await client.query(
        `INSERT INTO user_profiles (user_id, full_name, phone, avatar_url, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (user_id) DO UPDATE 
         SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, avatar_url = EXCLUDED.avatar_url`,
        [uid, target.fullName, phone, avatarUrl]
      );
    }

    // Địa chỉ giao hàng cho 5 buyers
    const buyerAddressesData = [
      {
        email: 'buyer01@dino-demo.test',
        recipient: 'Nguyễn Đức Thắng',
        phone: '0912345678',
        province: 'Thành phố Hà Nội',
        province_code: '01',
        district: 'Quận Cầu Giấy',
        ward: 'Phường Dịch Vọng Hậu',
        ward_code: '00157',
        detail: 'Số 18, Ngõ 86 Duy Tân',
      },
      {
        email: 'buyer01@dino-demo.test',
        recipient: 'Nguyễn Đức Thắng (Văn phòng)',
        phone: '0912345678',
        province: 'Thành phố Hà Nội',
        province_code: '01',
        district: 'Quận Ba Đình',
        ward: 'Phường Liễu Giai',
        ward_code: '00085',
        detail: 'Tòa nhà Lotte Center, 54 Liễu Giai',
        isDefault: false,
      },
      {
        email: 'buyer02@dino-demo.test',
        recipient: 'Trần Mỹ Linh',
        phone: '0923456789',
        province: 'Thành phố Hồ Chí Minh',
        province_code: '79',
        district: 'Quận 1',
        ward: 'Phường Bến Nghé',
        ward_code: '26734',
        detail: 'Căn hộ 12B, Chung cư Saigon Sky, 45 Lê Duẩn',
      },
      {
        email: 'buyer03@dino-demo.test',
        recipient: 'Lê Đình Phong',
        phone: '0934567890',
        province: 'Thành phố Đà Nẵng',
        province_code: '48',
        district: 'Quận Hải Châu',
        ward: 'Phường Thạch Thang',
        ward_code: '20197',
        detail: '102 Bạch Đằng',
      },
      {
        email: 'buyer04@dino-demo.test',
        recipient: 'Phạm Quỳnh Anh',
        phone: '0945678901',
        province: 'Thành phố Hồ Chí Minh',
        province_code: '79',
        district: 'Quận Bình Thạnh',
        ward: 'Phường 25',
        ward_code: '26887',
        detail: 'Landmark 4, Vinhomes Central Park, 208 Nguyễn Hữu Cảnh',
      },
      {
        email: 'buyer05@dino-demo.test',
        recipient: 'Hoàng Minh Triết',
        phone: '0956789012',
        province: 'Thành phố Cần Thơ',
        province_code: '92',
        district: 'Quận Ninh Kiều',
        ward: 'Phường An Khánh',
        ward_code: '31168',
        detail: 'Số 45, Đường 3/2',
      },
    ];

    const buyerDefaultAddressMap = new Map<string, string>(); // email -> address_id

    for (const addr of buyerAddressesData) {
      const buyerId = userUuidMap.get(addr.email)!;
      const addrId = randomUUID();
      const isDef = addr.isDefault !== false;
      if (isDef && !buyerDefaultAddressMap.has(addr.email)) {
        buyerDefaultAddressMap.set(addr.email, addrId);
      }
      await client.query(
        `INSERT INTO addresses (address_id, user_id, recipient_name, phone, province, province_code, district, ward, ward_code, detail_address, is_default, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
        [
          addrId,
          buyerId,
          addr.recipient,
          addr.phone,
          addr.province,
          addr.province_code,
          addr.district,
          addr.ward,
          addr.ward_code,
          addr.detail,
          isDef,
          daysAgo(30),
        ]
      );
    }
    console.log('✓ Đã tạo app_users, profiles và các địa chỉ nhận hàng.\n');

    // -------------------------------------------------------------------------
    // BƯỚC 4: TẠO 10 DANH MỤC SẢN PHẨM CHUẨN
    // -------------------------------------------------------------------------
    console.log('>>> [Bước 4/11] Tạo 10 danh mục sản phẩm thương mại điện tử...');

    const categoryList = [
      {
        id: '00000000-0000-0000-0000-000000000010',
        name: 'Mỹ phẩm & Chăm sóc sắc đẹp',
        desc: 'Mỹ phẩm trang điểm, dưỡng da, chăm sóc tóc chính hãng',
      },
      {
        id: '00000000-0000-0000-0000-000000000011',
        name: 'Thời trang & Phụ kiện',
        desc: 'Quần áo thời trang nam nữ, túi xách, giày dép và phụ kiện',
      },
      {
        id: '00000000-0000-0000-0000-000000000012',
        name: 'Thiết bị điện tử',
        desc: 'Điện thoại, máy tính, phụ kiện công nghệ và linh kiện âm thanh',
      },
      {
        id: 'c1000000-0000-4000-8000-000000000004',
        name: 'Nhà cửa & Đời sống',
        desc: 'Đồ trang trí, decor phòng, chăn ga gối đệm và nội thất tiện ích',
      },
      {
        id: 'c1000000-0000-4000-8000-000000000005',
        name: 'Đồ gia dụng & Nhà bếp',
        desc: 'Nồi chiên không dầu, máy xay sinh tố, bộ dao thớt và đồ dùng bếp',
      },
      {
        id: 'c1000000-0000-4000-8000-000000000006',
        name: 'Mẹ & Bé',
        desc: 'Sữa dinh dưỡng, tã bỉm, xe đẩy và đồ chơi phát triển trí tuệ cho trẻ',
      },
      {
        id: 'c1000000-0000-4000-8000-000000000007',
        name: 'Thể thao & Dã ngoại',
        desc: 'Trang phục tập gym, dụng cụ yoga, lều trại và phụ kiện trekking',
      },
      {
        id: 'c1000000-0000-4000-8000-000000000008',
        name: 'Sách & Văn phòng phẩm',
        desc: 'Sách kỹ năng, tiểu thuyết, bút viết, sổ tay và họa cụ mỹ thuật',
      },
      {
        id: 'c1000000-0000-4000-8000-000000000009',
        name: 'Thực phẩm & Đặc sản OCOP',
        desc: 'Cà phê nguyên chất, trà hữu cơ, mật ong rừng và đặc sản vùng miền',
      },
      {
        id: 'c1000000-0000-4000-8000-000000000010',
        name: 'Chăm sóc thú cưng',
        desc: 'Thức ăn hạt, pate, chuồng nệm và đồ chơi chăm sóc chó mèo',
      },
    ];

    const categoryMap = new Map<string, string>(); // name -> id
    for (const cat of categoryList) {
      categoryMap.set(cat.name, cat.id);
      await client.query(
        `INSERT INTO categories (category_id, parent_category_id, category_name, description, status, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, 'ACTIVE', $4, $4)`,
        [cat.id, cat.name, cat.desc, daysAgo(40)]
      );
    }
    console.log(`✓ Đã tạo thành công ${categoryList.length} danh mục.\n`);

    // -------------------------------------------------------------------------
    // BƯỚC 5: TẠO 20 SHOPS THỰC TẾ, VÍ TIỀN & SHOP CHAT PRESENCE
    // -------------------------------------------------------------------------
    console.log('>>> [Bước 5/11] Tạo 20 cửa hàng thực tế, ví tiền shop và trạng thái chat...');

    const shopProfiles = [
      {
        idx: 1,
        name: 'Dino Tech Official Store',
        tier: 'MALL' as const,
        status: 'ACTIVE' as const,
        category: 'Thiết bị điện tử',
        desc: 'Gian hàng chính hãng thiết bị âm thanh, tai nghe không dây, chuột công thái học và phụ kiện laptop cao cấp.',
        logo: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80',
        pickup_address: 'Tầng 3, Tòa Handico, Đường Phạm Hùng, Phường Mễ Trì, Quận Nam Từ Liêm, Hà Nội',
        pickup_province: 'Thành phố Hà Nội',
        pickup_province_code: '01',
        pickup_ward: 'Phường Mễ Trì',
        pickup_ward_code: '00490',
        phone: '0981110001',
        bank: { name: 'Vietcombank', acc: '1018999888', holder: 'CONG TY TNHH CONG NGHE DINO' },
        initialBalance: 18500000,
        initialHold: 3200000,
      },
      {
        idx: 2,
        name: 'An An Cosmetics & Beauty',
        tier: 'MALL' as const,
        status: 'ACTIVE' as const,
        category: 'Mỹ phẩm & Chăm sóc sắc đẹp',
        desc: 'Phân phối mỹ phẩm Skincare Hàn Quốc & Nhật Bản chính ngạch. Cam kết 100% chuẩn xuất xứ, hoàn tiền 200% nếu phát hiện hàng giả.',
        logo: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=400&q=80',
        pickup_address: '158 Nguyễn Đình Chiểu, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh',
        pickup_province: 'Thành phố Hồ Chí Minh',
        pickup_province_code: '79',
        pickup_ward: 'Phường Võ Thị Sáu',
        pickup_ward_code: '26788',
        phone: '0981110002',
        bank: { name: 'MB Bank', acc: '0981110002888', holder: 'NGUYEN THI AN AN' },
        initialBalance: 12400000,
        initialHold: 1800000,
      },
      {
        idx: 3,
        name: 'Urban Chic Fashion',
        tier: 'PREFERRED' as const,
        status: 'ACTIVE' as const,
        category: 'Thời trang & Phụ kiện',
        desc: 'Thương hiệu thời trang may mặc hiện đại, phom dáng thoải mái dành cho giới trẻ năng động. Phong cách tối giản Minimalism.',
        logo: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=400&q=80',
        pickup_address: '42 Tôn Đức Thắng, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
        pickup_province: 'Thành phố Hồ Chí Minh',
        pickup_province_code: '79',
        pickup_ward: 'Phường Bến Nghé',
        pickup_ward_code: '26734',
        phone: '0981110003',
        bank: { name: 'Techcombank', acc: '190333444555', holder: 'HO CONG CHIC' },
        initialBalance: 9800000,
        initialHold: 2100000,
      },
      {
        idx: 4,
        name: 'Gia Dụng Thông Minh ZenLife',
        tier: 'PREFERRED' as const,
        status: 'ACTIVE' as const,
        category: 'Đồ gia dụng & Nhà bếp',
        desc: 'Thiết bị gia dụng tiện ích chuẩn đời sống Nhật: nồi chiên không dầu, ấm đun giữ nhiệt, hộp cơm cắm điện văn phòng.',
        logo: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=400&q=80',
        pickup_address: '28 Liễu Giai, Phường Cống Vị, Quận Ba Đình, Hà Nội',
        pickup_province: 'Thành phố Hà Nội',
        pickup_province_code: '01',
        pickup_ward: 'Phường Cống Vị',
        pickup_ward_code: '00079',
        phone: '0981110004',
        bank: { name: 'ACB', acc: '888222333', holder: 'LE HOANG LONG' },
        initialBalance: 8200000,
        initialHold: 1500000,
      },
      {
        idx: 5,
        name: 'Nông Sản & Đặc Sản Vùng Cao',
        tier: 'PREFERRED' as const,
        status: 'ACTIVE' as const,
        category: 'Thực phẩm & Đặc sản OCOP',
        desc: 'Hạt điều rang củi Bình Phước, Mật ong hoa cà phê Đắk Lắk, Trà Shan Tuyết cổ thụ Hà Giang. Đạt chứng nhận OCOP 4 sao.',
        logo: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=400&q=80',
        pickup_address: 'Thôn 4, Xã Ea Kao, Thành phố Buôn Ma Thuột, Đắk Lắk',
        pickup_province: 'Tỉnh Đắk Lắk',
        pickup_province_code: '66',
        pickup_ward: 'Xã Ea Kao',
        pickup_ward_code: '24337',
        phone: '0981110005',
        bank: { name: 'Agribank', acc: '5600205888999', holder: 'Y KRON NIE' },
        initialBalance: 6400000,
        initialHold: 900000,
      },
      {
        idx: 6,
        name: 'BabyCare Mẹ & Bé Yêu',
        tier: 'PREFERRED' as const,
        status: 'ACTIVE' as const,
        category: 'Mẹ & Bé',
        desc: 'Tất cả vì sự phát triển toàn diện của bé yêu: bình sữa PPSU, tã dán hữu cơ, khăn ướt không cồn, đồ chơi kích thích thị giác.',
        logo: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=400&q=80',
        pickup_address: '120 Võ Văn Ngân, Phường Bình Thọ, Thành phố Thủ Đức, TP. Hồ Chí Minh',
        pickup_province: 'Thành phố Hồ Chí Minh',
        pickup_province_code: '79',
        pickup_ward: 'Phường Bình Thọ',
        pickup_ward_code: '26845',
        phone: '0981110006',
        bank: { name: 'VietinBank', acc: '108877665544', holder: 'DO THU TRANG' },
        initialBalance: 5900000,
        initialHold: 1200000,
      },
      {
        idx: 7,
        name: 'SportLife Phụ Kiện Thể Thao',
        tier: 'STANDARD' as const,
        status: 'ACTIVE' as const,
        category: 'Thể thao & Dã ngoại',
        desc: 'Trang thiết bị thể thao, thảm tập Yoga TPE cao cấp, bình nước thể thao có vạch chia, bộ dây kháng lực tập gym tại nhà.',
        logo: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=400&q=80',
        pickup_address: '78 Nguyễn Trãi, Phường Thượng Đình, Quận Thanh Xuân, Hà Nội',
        pickup_province: 'Thành phố Hà Nội',
        pickup_province_code: '01',
        pickup_ward: 'Phường Thượng Đình',
        pickup_ward_code: '00394',
        phone: '0981110007',
        bank: { name: 'VPBank', acc: '123999444', holder: 'BUI QUANG HUY' },
        initialBalance: 4100000,
        initialHold: 800000,
      },
      {
        idx: 8,
        name: 'Hiệu Sách & Văn Phòng Phẩm Tuổi Trẻ',
        tier: 'STANDARD' as const,
        status: 'ACTIVE' as const,
        category: 'Sách & Văn phòng phẩm',
        desc: 'Sách hay nuôi dưỡng tâm hồn, sổ tay bìa da, bút ký cao cấp, bộ họa cụ màu nước chính hãng cho học sinh, sinh viên.',
        logo: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=400&q=80',
        pickup_address: '55 Tràng Tiền, Phường Tràng Tiền, Quận Hoàn Kiếm, Hà Nội',
        pickup_province: 'Thành phố Hà Nội',
        pickup_province_code: '01',
        pickup_ward: 'Phường Tràng Tiền',
        pickup_ward_code: '00202',
        phone: '0981110008',
        bank: { name: 'Vietcombank', acc: '0011004567890', holder: 'HOANG YEN NHI' },
        initialBalance: 3600000,
        initialHold: 500000,
      },
      {
        idx: 9,
        name: 'Cà Phê Mộc & Trà Thảo Mộc',
        tier: 'STANDARD' as const,
        status: 'ACTIVE' as const,
        category: 'Thực phẩm & Đặc sản OCOP',
        desc: 'Cà phê Robusta mộc Cầu Đất rang mộc vừa, Trà hoa cúc sấy lạnh thanh nhiệt, Trà gạo lứt đậu đen giải độc cơ thể.',
        logo: 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=400&q=80',
        pickup_address: '12 Hoàng Diệu, Phường 5, Thành phố Đà Lạt, Lâm Đồng',
        pickup_province: 'Tỉnh Lâm Đồng',
        pickup_province_code: '68',
        pickup_ward: 'Phường 5',
        pickup_ward_code: '24808',
        phone: '0981110009',
        bank: { name: 'MB Bank', acc: '0981110009666', holder: 'DANG GIA BAO' },
        initialBalance: 3200000,
        initialHold: 450000,
      },
      {
        idx: 10,
        name: 'Phụ Kiện Điện Thoại ProMax',
        tier: 'STANDARD' as const,
        status: 'ACTIVE' as const,
        category: 'Thiết bị điện tử',
        desc: 'Ốp lưng từ tính MagSafe, kính cường lực KingKong, củ sạc GaN 65W nhỏ gọn, cáp sạc bọc dù chống đứt gãy bảo hành 12 tháng.',
        logo: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80',
        pickup_address: '246 Cách Mạng Tháng 8, Phường 10, Quận 3, TP. Hồ Chí Minh',
        pickup_province: 'Thành phố Hồ Chí Minh',
        pickup_province_code: '79',
        pickup_ward: 'Phường 10',
        pickup_ward_code: '26800',
        phone: '0981110010',
        bank: { name: 'Techcombank', acc: '190222333444', holder: 'NGO PHUONG LINH' },
        initialBalance: 4800000,
        initialHold: 1100000,
      },
      {
        idx: 11,
        name: 'Thời Trang Nam Classic Man',
        tier: 'STANDARD' as const,
        status: 'ACTIVE' as const,
        category: 'Thời trang & Phụ kiện',
        desc: 'Áo sơ mi Oxford chống nhăn, áo polo sợi dệt cá sấu cotton 100%, quần âu may đo tôn dáng lịch lãm công sở.',
        logo: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=400&q=80',
        pickup_address: '35 Hàng Bông, Phường Hàng Gai, Quận Hoàn Kiếm, Hà Nội',
        pickup_province: 'Thành phố Hà Nội',
        pickup_province_code: '01',
        pickup_ward: 'Phường Hàng Gai',
        pickup_ward_code: '00199',
        phone: '0981110011',
        bank: { name: 'ACB', acc: '666777888', holder: 'VU VAN TRUNG' },
        initialBalance: 2900000,
        initialHold: 600000,
      },
      {
        idx: 12,
        name: 'Minh Trang Skincare Organic',
        tier: 'STANDARD' as const,
        status: 'ACTIVE' as const,
        category: 'Mỹ phẩm & Chăm sóc sắc đẹp',
        desc: 'Mỹ phẩm thiên nhiên chiết xuất rau má, tràm trà hỗ trợ ngừa mụn và phục hồi da nhạy cảm. Không cồn, không paraben.',
        logo: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=400&q=80',
        pickup_address: '89 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
        pickup_province: 'Thành phố Hồ Chí Minh',
        pickup_province_code: '79',
        pickup_ward: 'Phường Bến Thành',
        pickup_ward_code: '26740',
        phone: '0981110012',
        bank: { name: 'Vietcombank', acc: '0071009988776', holder: 'TRAN MINH TRANG' },
        initialBalance: 3500000,
        initialHold: 400000,
      },
      {
        idx: 13,
        name: 'Nội Thất & Decor Nhà Đẹp',
        tier: 'STANDARD' as const,
        status: 'ACTIVE' as const,
        category: 'Nhà cửa & Đời sống',
        desc: 'Gương lượn sóng đèn LED, kệ gỗ treo tường mini, thảm trải sàn dệt lông cừu nhân tạo và đồng hồ treo tường Bắc Âu.',
        logo: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=400&q=80',
        pickup_address: '412 Kim Mã, Phường Ngọc Khánh, Quận Ba Đình, Hà Nội',
        pickup_province: 'Thành phố Hà Nội',
        pickup_province_code: '01',
        pickup_ward: 'Phường Ngọc Khánh',
        pickup_ward_code: '00088',
        phone: '0981110013',
        bank: { name: 'MB Bank', acc: '0981110013777', holder: 'NGUYEN TIEN DUNG' },
        initialBalance: 2700000,
        initialHold: 300000,
      },
      {
        idx: 14,
        name: 'Gia Vị & Đồ Khô Ba Miền',
        tier: 'STANDARD' as const,
        status: 'ACTIVE' as const,
        category: 'Thực phẩm & Đặc sản OCOP',
        desc: 'Hạt tiêu đen Phú Quốc nguyên hạt, tỏi đen cô đơn Lý Sơn, nấm hương rừng Sa Pa thơm nức nở cho mâm cơm chuẩn vị.',
        logo: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=400&q=80',
        pickup_address: '16 Bạch Đằng, Phường 24, Quận Bình Thạnh, TP. Hồ Chí Minh',
        pickup_province: 'Thành phố Hồ Chí Minh',
        pickup_province_code: '79',
        pickup_ward: 'Phường 24',
        pickup_ward_code: '26884',
        phone: '0981110014',
        bank: { name: 'VietinBank', acc: '109988776611', holder: 'LE THI NGOC MAI' },
        initialBalance: 1900000,
        initialHold: 250000,
      },
      {
        idx: 15,
        name: 'Giày Thể Thao Sneaker Station',
        tier: 'PREFERRED' as const,
        status: 'ACTIVE' as const,
        category: 'Thời trang & Phụ kiện',
        desc: 'Giày chạy bộ đệm khí trợ lực, sneaker phong cách vintage đi học đi làm cực êm chân, hỗ trợ đổi size miễn phí tận nhà.',
        logo: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=400&q=80',
        pickup_address: '184 Lê Duẩn, Phường Thạch Thang, Quận Hải Châu, Đà Nẵng',
        pickup_province: 'Thành phố Đà Nẵng',
        pickup_province_code: '48',
        pickup_ward: 'Phường Thạch Thang',
        pickup_ward_code: '20197',
        phone: '0981110015',
        bank: { name: 'Techcombank', acc: '190555666777', holder: 'PHAN HOANG NAM' },
        initialBalance: 7200000,
        initialHold: 1400000,
      },
      {
        idx: 16,
        name: 'Đồ Chơi Giáo Dục SmartKids',
        tier: 'STANDARD' as const,
        status: 'ACTIVE' as const,
        category: 'Mẹ & Bé',
        desc: 'Đồ chơi xếp hình gỗ Montessori rèn luyện tư duy logic, bộ lego thành phố, đất nặn an toàn tự nhiên không độc hại.',
        logo: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=400&q=80',
        pickup_address: '56 Trần Hưng Đạo, Phường Phan Chu Trinh, Quận Hoàn Kiếm, Hà Nội',
        pickup_province: 'Thành phố Hà Nội',
        pickup_province_code: '01',
        pickup_ward: 'Phường Phan Chu Trinh',
        pickup_ward_code: '00205',
        phone: '0981110016',
        bank: { name: 'ACB', acc: '999888111', holder: 'HOANG DIEU LINH' },
        initialBalance: 2100000,
        initialHold: 350000,
      },
      {
        idx: 17,
        name: 'Thời Trang Nữ Minimalist Studio',
        tier: 'STANDARD' as const,
        status: 'ACTIVE' as const,
        category: 'Thời trang & Phụ kiện',
        desc: 'Đầm midi hoa nhí dáng xòe, áo blouse chất tơ mềm nhẹ, chân váy xếp ly công sở thanh lịch nữ tính.',
        logo: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=400&q=80',
        pickup_address: '22 Võ Thị Sáu, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh',
        pickup_province: 'Thành phố Hồ Chí Minh',
        pickup_province_code: '79',
        pickup_ward: 'Phường Đa Kao',
        pickup_ward_code: '26743',
        phone: '0981110017',
        bank: { name: 'Vietcombank', acc: '0021003344556', holder: 'VU THI MY DUYEN' },
        initialBalance: 3100000,
        initialHold: 450000,
      },
      {
        idx: 18,
        name: 'Dino Audio & Phụ Kiện',
        tier: 'STANDARD' as const,
        status: 'ACTIVE' as const,
        category: 'Thiết bị điện tử',
        desc: 'Loa bluetooth chống nước IPX7 pin 24h, micro thu âm làm vlog podcast, giá treo tai nghe bằng nhôm nguyên khối.',
        logo: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=400&q=80',
        pickup_address: '94 Cầu Giấy, Phường Quan Hoa, Quận Cầu Giấy, Hà Nội',
        pickup_province: 'Thành phố Hà Nội',
        pickup_province_code: '01',
        pickup_ward: 'Phường Quan Hoa',
        pickup_ward_code: '00160',
        phone: '0981110018',
        bank: { name: 'MB Bank', acc: '0981110018999', holder: 'NGUYEN VIET BACH' },
        initialBalance: 2400000,
        initialHold: 200000,
      },
      {
        idx: 19,
        name: 'Tiệm Gốm & Bát Đĩa Thủ Công',
        tier: 'STANDARD' as const,
        status: 'PENDING' as const, // Trạng thái chờ duyệt để test chức năng duyệt shop
        category: 'Nhà cửa & Đời sống',
        desc: 'Gốm mộc Bát Tràng tráng men hỏa biến, bộ ấm trà tử sa nung củi, ly sứ vẽ tay thủ công tinh xảo.',
        logo: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=400&q=80',
        pickup_address: 'Thôn 1 Làng Cổ Bát Tràng, Xã Bát Tràng, Huyện Gia Lâm, Hà Nội',
        pickup_province: 'Thành phố Hà Nội',
        pickup_province_code: '01',
        pickup_ward: 'Xã Bát Tràng',
        pickup_ward_code: '00604',
        phone: '0981110019',
        bank: { name: 'Agribank', acc: '1480205123456', holder: 'TRAN VAN BAT' },
        initialBalance: 0,
        initialHold: 0,
      },
      {
        idx: 20,
        name: 'Văn Phòng Phẩm & Bullet Journal',
        tier: 'STANDARD' as const,
        status: 'SUSPENDED' as const, // Trạng thái tạm ngưng vi phạm để test Moderation Admin
        category: 'Sách & Văn phòng phẩm',
        desc: 'Tập giấy note màu pastel, bút highlight 6 màu pastel, bộ sticker trang trí sổ tay vintage phong cách retro.',
        logo: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=400&q=80',
        pickup_address: '15 Nguyễn Trãi, Phường 2, Quận 5, TP. Hồ Chí Minh',
        pickup_province: 'Thành phố Hồ Chí Minh',
        pickup_province_code: '79',
        pickup_ward: 'Phường 2',
        pickup_ward_code: '26815',
        phone: '0981110020',
        bank: { name: 'VPBank', acc: '199888777', holder: 'LE DANG KHOA' },
        initialBalance: 1200000,
        initialHold: 0,
      },
    ];

    const shopMap = new Map<number, { id: string; ownerId: string; name: string; tier: string; category: string }>();

    for (const s of shopProfiles) {
      const email = `seller${String(s.idx).padStart(2, '0')}@dino-demo.test`;
      const ownerId = userUuidMap.get(email)!;
      const shopId = randomUUID();
      shopMap.set(s.idx, { id: shopId, ownerId, name: s.name, tier: s.tier, category: s.category });

      await client.query(
        `INSERT INTO shops (shop_id, owner_id, shop_name, description, logo_url, pickup_address, pickup_province, pickup_province_code, pickup_ward, pickup_ward_code, pickup_detail_address, contact_phone, status, tier, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $6, $11, $12, $13, $14, $14)`,
        [
          shopId,
          ownerId,
          s.name,
          s.desc,
          s.logo,
          s.pickup_address,
          s.pickup_province,
          s.pickup_province_code,
          s.pickup_ward,
          s.pickup_ward_code,
          s.phone,
          s.status,
          s.tier,
          daysAgo(35),
        ]
      );

      // Shop Wallet
      const walletId = randomUUID();
      await client.query(
        `INSERT INTO shop_wallets (wallet_id, shop_id, balance, hold_balance, bank_name, bank_account_number, bank_account_holder, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        [
          walletId,
          shopId,
          s.initialBalance,
          s.initialHold,
          s.bank.name,
          s.bank.acc,
          s.bank.holder,
          daysAgo(35),
        ]
      );
    }
    console.log(`✓ Đã tạo thành công 20 shops và 20 ví tiền.\n`);

    // -------------------------------------------------------------------------
    // BƯỚC 6: TẠO SẢN PHẨM, BIẾN THỂ VÀ HÌNH ẢNH (PRODUCTS & VARIANTS & IMAGES)
    // -------------------------------------------------------------------------
    console.log('>>> [Bước 6/11] Tạo danh mục sản phẩm, biến thể chi tiết và ảnh minh họa...');

    type ProductDef = {
      shopIdx: number;
      categoryName: string;
      name: string;
      description: string;
      weightGrams: number;
      images: string[];
      variants: Array<{
        name: string;
        value: string;
        sku: string;
        price: number;
        stock: number;
      }>;
    };

    const productDefinitions: ProductDef[] = [
      // SHOP 1: Dino Tech Official Store
      {
        shopIdx: 1,
        categoryName: 'Thiết bị điện tử',
        name: 'Tai Nghe Bluetooth Không Dây Dino Pods Pro Chống Ồn ANC',
        description: 'Tai nghe Bluetooth 5.3 trang bị công nghệ chống ồn chủ động ANC 35dB, màng loa Composite 13mm cho âm bass sâu lắng, thời lượng pin liên tục lên đến 8 giờ, hộp sạc hỗ trợ sạc nhanh không dây.',
        weightGrams: 250,
        images: [
          'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Màu sắc', value: 'Trắng Tinh Khôi', sku: 'DINO-POD-WHT', price: 690000, stock: 45 },
          { name: 'Màu sắc', value: 'Đen Nhám Titan', sku: 'DINO-POD-BLK', price: 690000, stock: 30 },
          { name: 'Màu sắc', value: 'Xanh Midnight', sku: 'DINO-POD-BLU', price: 720000, stock: 15 },
        ],
      },
      {
        shopIdx: 1,
        categoryName: 'Thiết bị điện tử',
        name: 'Chuột Không Dây Công Thái Học Dino Ergonomic Silent Click',
        description: 'Thiết kế góc nghiêng tự nhiên 57 độ giảm áp lực cổ tay, nút bấm Silent hoàn toàn êm ái, kết nối kép Bluetooth 5.0 và USB Receiver 2.4GHz tiện lợi khi làm việc văn phòng.',
        weightGrams: 180,
        images: [
          'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Màu sắc', value: 'Xám Không Gian', sku: 'MOUSE-ERGO-GRY', price: 349000, stock: 60 },
          { name: 'Màu sắc', value: 'Trắng Bạc', sku: 'MOUSE-ERGO-SLV', price: 349000, stock: 50 },
        ],
      },
      {
        shopIdx: 1,
        categoryName: 'Thiết bị điện tử',
        name: 'Bàn Phím Cơ Không Dây 3 Chế Độ Dino Mechanical K87',
        description: 'Layout 87 phím nhỏ gọn, hỗ trợ kết nối Type-C/Bluetooth/Wireless 2.4G. Hotswap 5 pin tiện thay switch, đèn nền RGB 16.8 triệu màu tùy chỉnh nhiều hiệu ứng bắt mắt.',
        weightGrams: 900,
        images: [
          'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Switch', value: 'Red Switch (Gõ êm, mượt)', sku: 'KB-K87-RED', price: 850000, stock: 25 },
          { name: 'Switch', value: 'Brown Switch (Khấc êm)', sku: 'KB-K87-BRN', price: 850000, stock: 20 },
        ],
      },

      // SHOP 2: An An Cosmetics & Beauty
      {
        shopIdx: 2,
        categoryName: 'Mỹ phẩm & Chăm sóc sắc đẹp',
        name: 'Serum Dưỡng Trắng & Cấp Ẩm Chuyên Sâu Niacinamide 10% + Zinc 1%',
        description: 'Tinh chất phục hồi da mụn, kiểm soát dầu thừa, làm mờ thâm nám và thu nhỏ lỗ chân lông hiệu quả chỉ sau 4 tuần sử dụng. Thích hợp cho mọi loại da kể cả da nhạy cảm.',
        weightGrams: 150,
        images: [
          'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Dung tích', value: 'Chai 30ml', sku: 'SERUM-NIA-30ML', price: 280000, stock: 120 },
          { name: 'Dung tích', value: 'Chai 60ml (Tiết kiệm)', sku: 'SERUM-NIA-60ML', price: 490000, stock: 80 },
        ],
      },
      {
        shopIdx: 2,
        categoryName: 'Mỹ phẩm & Chăm sóc sắc đẹp',
        name: 'Kem Chống Nắng Phổ Rộng Dịu Nhẹ SPF 50+ PA++++ An An Sunscreen',
        description: 'Màng lọc chống nắng vật lý lai hóa học thế giới mới, bảo vệ da toàn diện trước tia UVA, UVB và ánh sáng xanh. Lớp finish kiềm dầu nâng tông tự nhiên nhẹ nhàng.',
        weightGrams: 100,
        images: [
          'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Dung tích', value: 'Tuýp 50ml', sku: 'SUN-SPF50-50ML', price: 320000, stock: 95 },
        ],
      },
      {
        shopIdx: 2,
        categoryName: 'Mỹ phẩm & Chăm sóc sắc đẹp',
        name: 'Nước Tẩy Trang Rau Má Dịu Nhẹ Làm Sạch Sâu Micellar Water',
        description: 'Công nghệ hạt Micellar hút sạch bụi mịn PM2.5, bã nhờn và cặn trang điểm lâu trôi mà không gây khô căng rát da. Bổ sung chiết xuất rau má làm dịu tức thì.',
        weightGrams: 550,
        images: [
          'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Dung tích', value: 'Chai 500ml', sku: 'MICELLAR-500ML', price: 215000, stock: 70 },
        ],
      },

      // SHOP 3: Urban Chic Fashion
      {
        shopIdx: 3,
        categoryName: 'Thời trang & Phụ kiện',
        name: 'Áo Sơ Mi Linen Nam Nữ Dáng Suông Thoáng Mát Minimalist',
        description: 'Chất vải linen bột tự nhiên dệt dày dặn, thấm hút mồ hôi tuyệt đối, phom dáng rộng rãi chuẩn phong cách Hàn Quốc dễ phối cùng quần âu, quần short hoặc mặc khoác ngoài.',
        weightGrams: 250,
        images: [
          'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Kích cỡ', value: 'Size M (50 - 65kg)', sku: 'SHIRT-LINEN-M', price: 289000, stock: 40 },
          { name: 'Kích cỡ', value: 'Size L (65 - 78kg)', sku: 'SHIRT-LINEN-L', price: 289000, stock: 35 },
          { name: 'Kích cỡ', value: 'Size XL (78 - 90kg)', sku: 'SHIRT-LINEN-XL', price: 299000, stock: 20 },
        ],
      },
      {
        shopIdx: 3,
        categoryName: 'Thời trang & Phụ kiện',
        name: 'Quần Dài Chino Co Giãn 4 Chiều Công Sở Dáng Slimfit',
        description: 'Vải cotton pha spandex co giãn cực tốt, bề mặt vải xử lý chống nhăn, đường may đúp chắc chắn không bung chỉ, thích hợp mặc cả tuần từ văn phòng đến dạo phố cuối tuần.',
        weightGrams: 400,
        images: [
          'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Màu / Size', value: 'Đen / Size 30', sku: 'PANT-CHINO-BLK-30', price: 379000, stock: 25 },
          { name: 'Màu / Size', value: 'Be Khaki / Size 31', sku: 'PANT-CHINO-KHK-31', price: 379000, stock: 30 },
          { name: 'Màu / Size', value: 'Xanh Navy / Size 32', sku: 'PANT-CHINO-NVY-32', price: 379000, stock: 20 },
        ],
      },

      // SHOP 4: Gia Dụng Thông Minh ZenLife
      {
        shopIdx: 4,
        categoryName: 'Đồ gia dụng & Nhà bếp',
        name: 'Nồi Chiên Không Dầu Điện Tử 6.5L Kính Trong Suốt ZenLife',
        description: 'Khoang chiên lớn 6.5L nướng vừa nguyên con gà 2kg, cửa kính cường lực kết hợp đèn halogen quan sát độ chín thức ăn, 8 chế độ nấu nướng lập trình sẵn giảm đến 85% lượng dầu mỡ.',
        weightGrams: 4500,
        images: [
          'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Phiên bản', value: 'Bản Tiêu Chuẩn 6.5L', sku: 'AF-ZEN-65L', price: 1490000, stock: 18 },
        ],
      },
      {
        shopIdx: 4,
        categoryName: 'Đồ gia dụng & Nhà bếp',
        name: 'Bình Giữ Nhiệt Inox 316 Cao Cấp 800ml Có Lưới Lọc Trà',
        description: 'Lòng bình chế tác từ thép không gỉ y tế SUS 316 an toàn tuyệt đối cho sức khỏe, giữ nóng trên 12 giờ và giữ lạnh trên 24 giờ, có quai xách thể thao năng động.',
        weightGrams: 420,
        images: [
          'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Màu sắc', value: 'Đen Nhám 800ml', sku: 'THERMOS-316-BLK', price: 249000, stock: 50 },
          { name: 'Màu sắc', value: 'Bạc Titan 800ml', sku: 'THERMOS-316-SLV', price: 249000, stock: 40 },
        ],
      },

      // SHOP 5: Nông Sản & Đặc Sản Vùng Cao
      {
        shopIdx: 5,
        categoryName: 'Thực phẩm & Đặc sản OCOP',
        name: 'Hạt Điều Rang Muối Bình Phước Loại A Cồ Vỏ Lụa Hũ 500g',
        description: 'Hạt điều vụ mới giòn rụm béo ngậy, rang củi thủ công giữ trọn vị ngọt tự nhiên, chỉ phủ nhẹ 1% muối tinh tạo vị đậm đà. Đạt chứng chỉ OCOP chất lượng cao.',
        weightGrams: 550,
        images: [
          'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Đóng gói', value: 'Hũ 500g Vỏ Lụa', sku: 'CASHEW-500G', price: 145000, stock: 85 },
          { name: 'Đóng gói', value: 'Combo 2 Hũ (1kg)', sku: 'CASHEW-1KG', price: 279000, stock: 50 },
        ],
      },
      {
        shopIdx: 5,
        categoryName: 'Thực phẩm & Đặc sản OCOP',
        name: 'Mật Ong Hoa Cà Phê Nguyên Chất Đắk Lắk Chai Thủy Tinh 1 Lít',
        description: 'Mật ong thu hoạch vụ hoa cà phê nở rộ tháng 3 tại Buôn Ma Thuột. Màu vàng óng sánh đặc, hương thơm dịu nhẹ, không lắng đường, thích hợp pha cam sả tắc mật ong mỗi sáng.',
        weightGrams: 1400,
        images: [
          'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Dung tích', value: 'Chai 1 Lít', sku: 'HONEY-COFFEE-1L', price: 189000, stock: 60 },
        ],
      },

      // SHOP 6: BabyCare Mẹ & Bé Yêu
      {
        shopIdx: 6,
        categoryName: 'Mẹ & Bé',
        name: 'Bình Sữa Cổ Rộng PPSU Chống Sặc Kháng Khuẩn BabyCare 240ml',
        description: 'Nhựa PPSU cao cấp nhập khẩu từ Đức chịu nhiệt lên tới 180 độ C, van thông khí chống đầy hơi nôn trớ hiệu quả, núm ti silicone siêu mềm mô phỏng bầu ngực mẹ.',
        weightGrams: 200,
        images: [
          'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Dung tích', value: '240ml (Núm ti M)', sku: 'BOTTLE-PPSU-240M', price: 235000, stock: 45 },
          { name: 'Dung tích', value: '300ml (Núm ti L)', sku: 'BOTTLE-PPSU-300L', price: 255000, stock: 30 },
        ],
      },

      // SHOP 7: SportLife Phụ Kiện Thể Thao
      {
        shopIdx: 7,
        categoryName: 'Thể thao & Dã ngoại',
        name: 'Thảm Tập Yoga Định Tuyến Cao Cấp TPE 2 Lớp Chống Trượt 6mm',
        description: 'Chất liệu TPE sinh thái không mùi độc hại, vạch định tuyến chuẩn xác hỗ trợ người mới tập chỉnh tư thế đúng, độ dày 6mm bảo vệ tối ưu khớp gối và cột sống.',
        weightGrams: 1100,
        images: [
          'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Màu sắc', value: 'Tím Lavender', sku: 'YOGA-MAT-PUR', price: 220000, stock: 40 },
          { name: 'Màu sắc', value: 'Xanh Mint', sku: 'YOGA-MAT-MNT', price: 220000, stock: 35 },
        ],
      },

      // SHOP 8: Hiệu Sách & Văn Phòng Phẩm Tuổi Trẻ
      {
        shopIdx: 8,
        categoryName: 'Sách & Văn phòng phẩm',
        name: 'Bộ Sách Kỹ Năng: Tư Duy Ngược & Tư Duy Mở (Tái Bản 2026)',
        description: 'Bộ đôi tác phẩm bán chạy giúp bạn bứt phá khỏi những lối mòn định kiến, làm chủ cảm xúc và mở rộng giới hạn tư duy trong kỷ nguyên số. Bìa cứng mạ vàng sang trọng.',
        weightGrams: 650,
        images: [
          'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Bộ sách', value: 'Combo 2 Cuốn Bìa Cứng', sku: 'BOOK-TUDUY-COMBO', price: 198000, stock: 55 },
        ],
      },

      // SHOP 9: Cà Phê Mộc & Trà Thảo Mộc
      {
        shopIdx: 9,
        categoryName: 'Thực phẩm & Đặc sản OCOP',
        name: 'Cà Phê Rang Mộc Pha Phin Robusta Cầu Đất 100% Gói 500g',
        description: '100% hạt Robusta chín cây hái chọn lọc, rang mộc độ vừa (Medium Dark), thể chất đậm đà, hậu vị ngọt kéo dài, hương sô cô la thơm nồng quyến rũ cho buổi sáng tỉnh táo.',
        weightGrams: 520,
        images: [
          'https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Quy cách', value: 'Gói 500g Xay Phin', sku: 'CF-ROBUSTA-500G', price: 135000, stock: 90 },
          { name: 'Quy cách', value: 'Gói 1kg Tiết Kiệm', sku: 'CF-ROBUSTA-1KG', price: 250000, stock: 60 },
        ],
      },

      // SHOP 10: Phụ Kiện Điện Thoại ProMax
      {
        shopIdx: 10,
        categoryName: 'Thiết bị điện tử',
        name: 'Củ Sạc Nhanh GaN 65W 3 Cổng Type-C & USB-A Siêu Nhỏ Gọn',
        description: 'Công nghệ Gallium Nitride (GaN) giảm 50% kích thước củ sạc, hỗ trợ Power Delivery 3.0 và Quick Charge 4.0 sạc được cùng lúc cả Laptop, iPad và điện thoại iPhone/Samsung.',
        weightGrams: 160,
        images: [
          'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Màu sắc', value: 'Trắng Sữa', sku: 'CHARGER-GAN-WHT', price: 389000, stock: 70 },
          { name: 'Màu sắc', value: 'Đen Nhám', sku: 'CHARGER-GAN-BLK', price: 389000, stock: 65 },
        ],
      },

      // SHOP 15: Giày Thể Thao Sneaker Station
      {
        shopIdx: 15,
        categoryName: 'Thời trang & Phụ kiện',
        name: 'Giày Chạy Bộ Nam Nữ Siêu Nhẹ Dino Running Cushion Pro',
        description: 'Đế đệm hạt E-TPU đàn hồi vượt trội hỗ trợ lực đẩy từng bước chạy, thân giày dệt lưới thoáng khí không hầm bí chân, trọng lượng siêu nhẹ chỉ 210g cho cảm giác lướt gió tự tin.',
        weightGrams: 650,
        images: [
          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
        ],
        variants: [
          { name: 'Size', value: 'Size 40', sku: 'SHOE-RUN-40', price: 580000, stock: 25 },
          { name: 'Size', value: 'Size 41', sku: 'SHOE-RUN-41', price: 580000, stock: 30 },
          { name: 'Size', value: 'Size 42', sku: 'SHOE-RUN-42', price: 580000, stock: 20 },
        ],
      },
    ];

    type CreatedProduct = {
      productId: string;
      shopId: string;
      productName: string;
      variants: Array<{ variantId: string; name: string; price: number; stock: number; sku: string }>;
    };

    const createdProductList: CreatedProduct[] = [];

    for (const p of productDefinitions) {
      const shopInfo = shopMap.get(p.shopIdx);
      if (!shopInfo) continue;

      const categoryId = categoryMap.get(p.categoryName) || categoryList[0].id;
      const productId = randomUUID();

      await client.query(
        `INSERT INTO products (product_id, shop_id, category_id, product_name, description, weight_grams, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, $7)`,
        [productId, shopInfo.id, categoryId, p.name, p.description, p.weightGrams, daysAgo(32)]
      );

      // Product Images
      for (let i = 0; i < p.images.length; i++) {
        await client.query(
          `INSERT INTO product_images (image_id, product_id, image_url, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [randomUUID(), productId, p.images[i], i]
        );
      }

      // Product Variants
      const createdVariants: CreatedProduct['variants'] = [];
      for (const v of p.variants) {
        const variantId = randomUUID();
        await client.query(
          `INSERT INTO product_variants (variant_id, product_id, variant_name, variant_value, sku, price, stock_quantity, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, $8)`,
          [variantId, productId, v.name, v.value, v.sku, v.price, v.stock, daysAgo(32)]
        );
        createdVariants.push({
          variantId,
          name: `${v.name}: ${v.value}`,
          price: v.price,
          stock: v.stock,
          sku: v.sku,
        });
      }

      createdProductList.push({
        productId,
        shopId: shopInfo.id,
        productName: p.name,
        variants: createdVariants,
      });
    }

    console.log(`✓ Đã tạo thành công ${createdProductList.length} sản phẩm thực tế với đầy đủ biến thể và hình ảnh.\n`);

    // -------------------------------------------------------------------------
    // BƯỚC 7: TẠO MÃ GIẢM GIÁ (VOUCHERS) & FLASH SALE SESSIONS
    // -------------------------------------------------------------------------
    console.log('>>> [Bước 7/11] Tạo mã giảm giá Vouchers và phiên Flash Sale...');

    const voucherDefs = [
      {
        code: 'FREESHIPMAX',
        name: 'Miễn Phí Vận Chuyển Toàn Sàn Đơn Từ 150K',
        scope: 'PLATFORM' as const,
        shopId: null,
        type: 'FIXED' as const,
        val: 25000,
        maxDisc: null,
        minOrder: 150000,
        qty: 500,
        start: daysAgo(30),
        end: daysAgo(-15),
      },
      {
        code: 'DINOMVP2026',
        name: 'Giảm 10% Tối Đa 50K Mừng Phiên Bản Mới',
        scope: 'PLATFORM' as const,
        shopId: null,
        type: 'PERCENT' as const,
        val: 10,
        maxDisc: 50000,
        minOrder: 200000,
        qty: 300,
        start: daysAgo(30),
        end: daysAgo(-15),
      },
      {
        code: 'MEGA1010',
        name: 'Siêu Sale 10.10 Giảm Ngay 50K',
        scope: 'PLATFORM' as const,
        shopId: null,
        type: 'FIXED' as const,
        val: 50000,
        maxDisc: null,
        minOrder: 350000,
        qty: 200,
        start: daysAgo(2),
        end: daysAgo(-2),
      },
      {
        code: 'TECH50K',
        name: 'Voucher Shop Dino Tech Giảm 50K',
        scope: 'SHOP' as const,
        shopId: shopMap.get(1)!.id,
        type: 'FIXED' as const,
        val: 50000,
        maxDisc: null,
        minOrder: 500000,
        qty: 50,
        start: daysAgo(20),
        end: daysAgo(-10),
      },
      {
        code: 'ANAN20K',
        name: 'Voucher Shop An An Giảm 20K',
        scope: 'SHOP' as const,
        shopId: shopMap.get(2)!.id,
        type: 'FIXED' as const,
        val: 20000,
        maxDisc: null,
        minOrder: 250000,
        qty: 100,
        start: daysAgo(20),
        end: daysAgo(-10),
      },
      {
        code: 'EXPIRED09',
        name: 'Voucher Chào Thu Hết Hạn 30/09',
        scope: 'PLATFORM' as const,
        shopId: null,
        type: 'PERCENT' as const,
        val: 15,
        maxDisc: 40000,
        minOrder: 100000,
        qty: 0,
        start: daysAgo(30),
        end: daysAgo(10), // Hết hạn ngày 30/09
      },
    ];

    const voucherIdMap = new Map<string, string>();
    for (const v of voucherDefs) {
      const vid = randomUUID();
      voucherIdMap.set(v.code, vid);
      await client.query(
        `INSERT INTO vouchers (voucher_id, code, voucher_name, scope, shop_id, discount_type, discount_value, max_discount, min_order_value, quantity, start_at, end_at, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)`,
        [
          vid,
          v.code,
          v.name,
          v.scope,
          v.shopId,
          v.type,
          v.val,
          v.maxDisc,
          v.minOrder,
          v.qty,
          v.start,
          v.end,
          new Date(v.end) < BASE_DATE ? 'INACTIVE' : 'ACTIVE',
          daysAgo(31),
        ]
      );
    }

    // Flash Sale Session 1: Đang diễn ra hôm nay 10/10
    const flashSession1Id = randomUUID();
    await client.query(
      `INSERT INTO flash_sale_sessions (slot_id, slot_name, start_time, end_time, status, created_at, updated_at)
       VALUES ($1, 'Đại Tiệc Flash Sale 10.10', $2, $3, 'ACTIVE', $4, $4)`,
      [flashSession1Id, daysAgo(0, 0, 0), daysAgo(-1, 0, 0), daysAgo(5)]
    );

    // Gán 2 sản phẩm vào Flash Sale 1
    if (createdProductList.length >= 2) {
      const p1 = createdProductList[0];
      const v1 = p1.variants[0];
      await client.query(
        `INSERT INTO flash_sale_items (item_id, slot_id, product_id, variant_id, original_price, flash_sale_price, allocated_stock, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        [randomUUID(), flashSession1Id, p1.productId, v1.variantId, v1.price, Math.round(v1.price * 0.8), 20, daysAgo(5)]
      );

      const p2 = createdProductList[1];
      const v2 = p2.variants[0];
      await client.query(
        `INSERT INTO flash_sale_items (item_id, slot_id, product_id, variant_id, original_price, flash_sale_price, allocated_stock, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        [randomUUID(), flashSession1Id, p2.productId, v2.variantId, v2.price, Math.round(v2.price * 0.75), 15, daysAgo(5)]
      );
    }
    console.log('✓ Đã tạo Vouchers và Flash Sale Session thành công.\n');

    // -------------------------------------------------------------------------
    // BƯỚC 8: TẠO ĐƠN HÀNG, THANH TOÁN, VẬN CHUYỂN, ESCROW & LỊCH SỬ TRẠNG THÁI
    // (Phát sinh chính từ 10/09/2026 đến 10/10/2026)
    // -------------------------------------------------------------------------
    console.log('>>> [Bước 8/11] Tạo 35 đơn hàng thực tế trải dài 10/09/2026 - 10/10/2026...');

    type OrderSpec = {
      buyerEmail: string;
      productIdx: number;
      variantIdx: number;
      quantity: number;
      daysAgo: number;
      status: 'COMPLETED' | 'SHIPPING' | 'PREPARING' | 'CONFIRMED' | 'PENDING_CONFIRMATION' | 'CANCELLED';
      paymentMethod: 'ONLINE' | 'COD';
      voucherCode?: string;
      cancelReason?: string;
    };

    const orderSpecs: OrderSpec[] = [
      // Tuần 1: 10/09 - 17/09/2026 (Đều đã hoàn thành)
      { buyerEmail: 'buyer01@dino-demo.test', productIdx: 0, variantIdx: 0, quantity: 1, daysAgo: 28, status: 'COMPLETED', paymentMethod: 'ONLINE', voucherCode: 'FREESHIPMAX' },
      { buyerEmail: 'buyer02@dino-demo.test', productIdx: 3, variantIdx: 0, quantity: 2, daysAgo: 27, status: 'COMPLETED', paymentMethod: 'ONLINE', voucherCode: 'DINOMVP2026' },
      { buyerEmail: 'buyer03@dino-demo.test', productIdx: 6, variantIdx: 1, quantity: 1, daysAgo: 26, status: 'COMPLETED', paymentMethod: 'COD' },
      { buyerEmail: 'buyer04@dino-demo.test', productIdx: 9, variantIdx: 0, quantity: 1, daysAgo: 25, status: 'COMPLETED', paymentMethod: 'ONLINE' },
      { buyerEmail: 'buyer05@dino-demo.test', productIdx: 10, variantIdx: 0, quantity: 2, daysAgo: 24, status: 'COMPLETED', paymentMethod: 'COD' },

      // Tuần 2: 18/09 - 25/09/2026 (Hoàn thành & 1 hủy)
      { buyerEmail: 'buyer01@dino-demo.test', productIdx: 4, variantIdx: 0, quantity: 1, daysAgo: 21, status: 'COMPLETED', paymentMethod: 'ONLINE' },
      { buyerEmail: 'buyer02@dino-demo.test', productIdx: 1, variantIdx: 0, quantity: 1, daysAgo: 20, status: 'COMPLETED', paymentMethod: 'ONLINE', voucherCode: 'FREESHIPMAX' },
      { buyerEmail: 'buyer03@dino-demo.test', productIdx: 8, variantIdx: 0, quantity: 1, daysAgo: 19, status: 'CANCELLED', paymentMethod: 'COD', cancelReason: 'Khách hàng đổi ý, muốn mua mẫu khác' },
      { buyerEmail: 'buyer04@dino-demo.test', productIdx: 12, variantIdx: 0, quantity: 1, daysAgo: 18, status: 'COMPLETED', paymentMethod: 'COD' },
      { buyerEmail: 'buyer05@dino-demo.test', productIdx: 14, variantIdx: 1, quantity: 1, daysAgo: 17, status: 'COMPLETED', paymentMethod: 'ONLINE' },

      // Tuần 3: 26/09 - 03/10/2026
      { buyerEmail: 'buyer01@dino-demo.test', productIdx: 2, variantIdx: 0, quantity: 1, daysAgo: 14, status: 'COMPLETED', paymentMethod: 'ONLINE', voucherCode: 'TECH50K' },
      { buyerEmail: 'buyer02@dino-demo.test', productIdx: 5, variantIdx: 0, quantity: 1, daysAgo: 13, status: 'COMPLETED', paymentMethod: 'ONLINE', voucherCode: 'ANAN20K' },
      { buyerEmail: 'buyer03@dino-demo.test', productIdx: 7, variantIdx: 0, quantity: 1, daysAgo: 12, status: 'COMPLETED', paymentMethod: 'COD' },
      { buyerEmail: 'buyer04@dino-demo.test', productIdx: 11, variantIdx: 0, quantity: 1, daysAgo: 11, status: 'COMPLETED', paymentMethod: 'ONLINE' },
      { buyerEmail: 'buyer05@dino-demo.test', productIdx: 13, variantIdx: 0, quantity: 2, daysAgo: 10, status: 'CANCELLED', paymentMethod: 'ONLINE', cancelReason: 'Đặt nhầm địa chỉ nhận hàng, đã hoàn tiền' },

      // Tuần 4: 04/10 - 08/10/2026 (Hoàn thành và đang giao)
      { buyerEmail: 'buyer01@dino-demo.test', productIdx: 15, variantIdx: 1, quantity: 1, daysAgo: 6, status: 'COMPLETED', paymentMethod: 'ONLINE' },
      { buyerEmail: 'buyer02@dino-demo.test', productIdx: 0, variantIdx: 1, quantity: 1, daysAgo: 5, status: 'COMPLETED', paymentMethod: 'ONLINE', voucherCode: 'FREESHIPMAX' },
      { buyerEmail: 'buyer03@dino-demo.test', productIdx: 3, variantIdx: 1, quantity: 1, daysAgo: 4, status: 'SHIPPING', paymentMethod: 'ONLINE' },
      { buyerEmail: 'buyer04@dino-demo.test', productIdx: 6, variantIdx: 0, quantity: 1, daysAgo: 3, status: 'SHIPPING', paymentMethod: 'COD' },
      { buyerEmail: 'buyer05@dino-demo.test', productIdx: 9, variantIdx: 1, quantity: 1, daysAgo: 3, status: 'SHIPPING', paymentMethod: 'ONLINE' },

      // Ngày 09/10/2026 - 10/10/2026 (Đang chuẩn bị & Mới đặt)
      { buyerEmail: 'buyer01@dino-demo.test', productIdx: 1, variantIdx: 1, quantity: 1, daysAgo: 1, status: 'PREPARING', paymentMethod: 'ONLINE', voucherCode: 'MEGA1010' },
      { buyerEmail: 'buyer02@dino-demo.test', productIdx: 10, variantIdx: 0, quantity: 1, daysAgo: 1, status: 'CONFIRMED', paymentMethod: 'COD' },
      { buyerEmail: 'buyer03@dino-demo.test', productIdx: 14, variantIdx: 0, quantity: 1, daysAgo: 0, status: 'PENDING_CONFIRMATION', paymentMethod: 'ONLINE' },
      { buyerEmail: 'buyer04@dino-demo.test', productIdx: 4, variantIdx: 0, quantity: 1, daysAgo: 0, status: 'PENDING_CONFIRMATION', paymentMethod: 'COD' },
    ];

    type CompletedOrderData = {
      orderId: string;
      orderItemId: string;
      buyerId: string;
      productId: string;
      totalAmount: number;
    };
    const completedOrders: CompletedOrderData[] = [];

    const shippingCarriers = ['Giao Hàng Tiết Kiệm (GHTK)', 'Giao Hàng Nhanh (GHN)', 'Viettel Post'];

    for (let i = 0; i < orderSpecs.length; i++) {
      const spec = orderSpecs[i];
      const buyerId = userUuidMap.get(spec.buyerEmail)!;
      const targetProd = createdProductList[spec.productIdx % createdProductList.length];
      const targetVar = targetProd.variants[spec.variantIdx % targetProd.variants.length];
      const orderId = randomUUID();
      const orderCreatedAt = daysAgo(spec.daysAgo, 8 + (i % 12), (i * 7) % 60);

      const subtotal = targetVar.price * spec.quantity;
      const shippingFee = 25000;
      let discountAmount = 0;
      let usedVoucherId: string | null = null;

      if (spec.voucherCode && voucherIdMap.has(spec.voucherCode)) {
        usedVoucherId = voucherIdMap.get(spec.voucherCode)!;
        if (spec.voucherCode === 'FREESHIPMAX') discountAmount = 25000;
        else if (spec.voucherCode === 'DINOMVP2026') discountAmount = Math.min(50000, Math.round(subtotal * 0.1));
        else if (spec.voucherCode === 'MEGA1010') discountAmount = 50000;
        else if (spec.voucherCode === 'TECH50K') discountAmount = 50000;
        else if (spec.voucherCode === 'ANAN20K') discountAmount = 20000;
      }

      const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);

      const buyerAddr = buyerAddressesData.find((a) => a.email === spec.buyerEmail) || buyerAddressesData[0];

      // 1. Tạo đơn hàng
      await client.query(
        `INSERT INTO orders (order_id, buyer_id, shop_id, recipient_name, recipient_phone, province, district, ward, delivery_address, subtotal, discount_amount, shipping_fee, total_amount, status, cancel_reason, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)`,
        [
          orderId,
          buyerId,
          targetProd.shopId,
          buyerAddr.recipient,
          buyerAddr.phone,
          buyerAddr.province,
          buyerAddr.district,
          buyerAddr.ward,
          buyerAddr.detail,
          subtotal,
          discountAmount,
          shippingFee,
          totalAmount,
          spec.status,
          spec.cancelReason || null,
          orderCreatedAt,
        ]
      );

      // 2. Tạo chi tiết đơn hàng (order_items)
      const orderItemId = randomUUID();
      await client.query(
        `INSERT INTO order_items (order_item_id, order_id, product_id, variant_id, product_name_snapshot, variant_snapshot, unit_price, quantity, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          orderItemId,
          orderId,
          targetProd.productId,
          targetVar.variantId,
          targetProd.productName,
          targetVar.name,
          targetVar.price,
          spec.quantity,
          subtotal,
        ]
      );

      // 3. Voucher Usage (nếu có dùng voucher)
      if (usedVoucherId && discountAmount > 0) {
        await client.query(
          `INSERT INTO voucher_usages (usage_id, voucher_id, order_id, buyer_id, discount_amount, used_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [randomUUID(), usedVoucherId, orderId, buyerId, discountAmount, orderCreatedAt]
        );
      }

      // 4. Lịch sử trạng thái đơn hàng (Timeline hợp lý)
      await client.query(
        `INSERT INTO order_status_history (history_id, order_id, old_status, new_status, changed_by, reason, changed_at)
         VALUES ($1, $2, NULL, 'PENDING_CONFIRMATION', $3, 'Khách hàng tạo đơn thành công', $4)`,
        [randomUUID(), orderId, buyerId, orderCreatedAt]
      );

      if (['CONFIRMED', 'PREPARING', 'SHIPPING', 'COMPLETED'].includes(spec.status)) {
        await client.query(
          `INSERT INTO order_status_history (history_id, order_id, old_status, new_status, changed_by, reason, changed_at)
           VALUES ($1, $2, 'PENDING_CONFIRMATION', 'CONFIRMED', NULL, 'Người bán đã xác nhận đơn hàng', $3)`,
          [randomUUID(), orderId, daysAgo(spec.daysAgo, 10, 30)]
        );
      }

      if (['PREPARING', 'SHIPPING', 'COMPLETED'].includes(spec.status)) {
        await client.query(
          `INSERT INTO order_status_history (history_id, order_id, old_status, new_status, changed_by, reason, changed_at)
           VALUES ($1, $2, 'CONFIRMED', 'PREPARING', NULL, 'Đang đóng gói kiện hàng', $3)`,
          [randomUUID(), orderId, daysAgo(spec.daysAgo, 14, 0)]
        );
      }

      if (['SHIPPING', 'COMPLETED'].includes(spec.status)) {
        await client.query(
          `INSERT INTO order_status_history (history_id, order_id, old_status, new_status, changed_by, reason, changed_at)
           VALUES ($1, $2, 'PREPARING', 'SHIPPING', NULL, 'Đã bàn giao cho đơn vị vận chuyển', $3)`,
          [randomUUID(), orderId, daysAgo(Math.max(1, spec.daysAgo - 1), 9, 0)]
        );
      }

      if (spec.status === 'COMPLETED') {
        const deliveredTime = daysAgo(Math.max(0, spec.daysAgo - 3), 16, 0);
        await client.query(
          `INSERT INTO order_status_history (history_id, order_id, old_status, new_status, changed_by, reason, changed_at)
           VALUES ($1, $2, 'SHIPPING', 'COMPLETED', NULL, 'Giao hàng thành công đến người nhận', $3)`,
          [randomUUID(), orderId, deliveredTime]
        );

        completedOrders.push({
          orderId,
          orderItemId,
          buyerId,
          productId: targetProd.productId,
          totalAmount,
        });
      }

      if (spec.status === 'CANCELLED') {
        await client.query(
          `INSERT INTO order_status_history (history_id, order_id, old_status, new_status, changed_by, reason, changed_at)
           VALUES ($1, $2, 'PENDING_CONFIRMATION', 'CANCELLED', $3, $4, $5)`,
          [randomUUID(), orderId, buyerId, spec.cancelReason, daysAgo(spec.daysAgo, 12, 0)]
        );
      }

      // 5. Thanh toán (Payments)
      const payStatus = spec.status === 'COMPLETED'
        ? 'SUCCESS'
        : spec.paymentMethod === 'ONLINE' && spec.status !== 'CANCELLED'
        ? 'SUCCESS'
        : 'PENDING';

      const txCode = `PAY-${Date.now()}-${i}`;
      const paidAt = payStatus === 'SUCCESS' ? orderCreatedAt : null;

      await client.query(
        `INSERT INTO payments (payment_id, order_id, transaction_code, method, amount, status, created_at, paid_at, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          randomUUID(),
          orderId,
          txCode,
          spec.paymentMethod,
          totalAmount,
          payStatus,
          orderCreatedAt,
          paidAt,
          spec.paymentMethod === 'ONLINE' ? 'Thanh toán trực tuyến VietQR / PayOS' : 'Thanh toán tiền mặt khi nhận hàng (COD)',
        ]
      );

      // 6. Vận chuyển (Shipments)
      if (['SHIPPING', 'COMPLETED'].includes(spec.status)) {
        const carrier = shippingCarriers[i % shippingCarriers.length];
        const trackingCode = `DN${String(Date.now()).slice(-8)}${String(i).padStart(3, '0')}`;
        await client.query(
          `INSERT INTO shipments (shipment_id, order_id, carrier_name, tracking_code, status, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            randomUUID(),
            orderId,
            carrier,
            trackingCode,
            spec.status === 'COMPLETED' ? 'DELIVERED' : 'SHIPPING',
            orderCreatedAt,
          ]
        );
      }

      // 7. Ký quỹ & Quyết toán (Escrow Records)
      const commissionFee = Math.round(subtotal * 0.05); // Phí sàn 5%
      const netAmount = subtotal - commissionFee;
      const escrowStatus = spec.status === 'COMPLETED'
        ? 'RELEASED'
        : spec.status === 'CANCELLED'
        ? 'REFUNDED'
        : 'HOLDING';

      const releasedAt = spec.status === 'COMPLETED' ? daysAgo(Math.max(0, spec.daysAgo - 3), 16, 5) : null;

      await client.query(
        `INSERT INTO escrow_records (escrow_id, order_id, shop_id, gross_amount, commission_rate, commission_fee, net_amount, status, released_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 0.05, $5, $6, $7, $8, $9, $9)`,
        [
          randomUUID(),
          orderId,
          targetProd.shopId,
          subtotal,
          commissionFee,
          netAmount,
          escrowStatus,
          releasedAt,
          orderCreatedAt,
        ]
      );

      // Nếu đơn hoàn thành -> ghi nhận giao dịch ví cho người bán
      if (spec.status === 'COMPLETED') {
        const shopWalletRes = await client.query<{ wallet_id: string; balance: number }>(
          `SELECT wallet_id, balance FROM shop_wallets WHERE shop_id = $1`,
          [targetProd.shopId]
        );
        if (shopWalletRes.rows.length > 0) {
          const w = shopWalletRes.rows[0];
          await client.query(
            `INSERT INTO wallet_transactions (transaction_id, wallet_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, created_at)
             VALUES ($1, $2, 'SETTLEMENT', $3, $4, $5, 'ORDER', $6, $7, $8)`,
            [
              randomUUID(),
              w.wallet_id,
              netAmount,
              w.balance,
              Number(w.balance) + netAmount,
              orderId,
              `Quyết toán tiền hàng đơn #${orderId.slice(0, 8)}`,
              releasedAt,
            ]
          );
        }
      }
    }
    console.log(`✓ Đã tạo thành công ${orderSpecs.length} đơn hàng kèm đầy đủ thanh toán, vận chuyển và ký quỹ.\n`);

    // -------------------------------------------------------------------------
    // BƯỚC 9: ĐÁNH GIÁ SẢN PHẨM & TÍCH ĐIỂM THÀNH VIÊN (REVIEWS & LOYALTY POINTS)
    // -------------------------------------------------------------------------
    console.log('>>> [Bước 9/11] Tạo đánh giá sản phẩm từ người mua và tích điểm thành viên...');

    const reviewComments = [
      'Sản phẩm đẹp xuất sắc, đóng gói cẩn thận 3 lớp chống sốc, giao hàng siêu nhanh chỉ trong 2 ngày!',
      'Chất lượng vượt mong đợi so với tầm giá. Shop tư vấn nhiệt tình, đúng size đúng mẫu. Sẽ ủng hộ tiếp!',
      'Hàng chính hãng chuẩn 100%, có tem mác niêm phong đầy đủ. Sử dụng rất thích và ưng ý.',
      'Đóng gói đẹp, giao đúng hẹn, nhân viên giao hàng thân thiện lễ phép. Cho shop 5 sao chất lượng!',
      'Sản phẩm dùng tốt, âm thanh trong trẻo / chất vải mát / hạt thơm ngon. Rất đáng đồng tiền bát gạo.',
    ];

    for (let i = 0; i < completedOrders.length; i++) {
      const co = completedOrders[i];
      const rating = i % 7 === 0 ? 4 : 5; // Phần lớn 5 sao, thi thoảng 4 sao thực tế
      const content = reviewComments[i % reviewComments.length];
      const reviewId = randomUUID();

      await client.query(
        `INSERT INTO reviews (review_id, buyer_id, product_id, order_item_id, rating, content, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'VISIBLE', $7, $7)`,
        [reviewId, co.buyerId, co.productId, co.orderItemId, rating, content, daysAgo(2)]
      );

      // Điểm tích lũy Loyalty (10.000đ = 1 điểm)
      const points = Math.max(1, Math.floor(co.totalAmount / 10000));
      await client.query(
        `INSERT INTO loyalty_point_transactions (transaction_id, user_id, points_delta, reference_order_id, reason, created_at)
         VALUES ($1, $2, $3, $4, 'ORDER_COMPLETED', $5)`,
        [randomUUID(), co.buyerId, points, co.orderId, daysAgo(2)]
      );

      // Cập nhật điểm và tổng chi tiêu cho buyer trong app_users
      await client.query(
        `UPDATE app_users 
         SET total_spent = total_spent + $1, loyalty_points = loyalty_points + $2, updated_at = now()
         WHERE user_id = $3`,
        [co.totalAmount, points, co.buyerId]
      );
    }
    console.log(`✓ Đã tạo ${completedOrders.length} đánh giá thực tế và cộng điểm thành viên.\n`);

    // -------------------------------------------------------------------------
    // BƯỚC 10: TẠO GIỎ HÀNG CHO CÁC BUYER (CARTS & CART_ITEMS)
    // -------------------------------------------------------------------------
    console.log('>>> [Bước 10/11] Tạo giỏ hàng có sẵn sản phẩm cho các tài khoản Buyer...');

    for (let b = 0; b < buyerAccounts.length; b++) {
      const buyerId = userUuidMap.get(buyerAccounts[b].email)!;
      const cartId = randomUUID();

      await client.query(
        `INSERT INTO carts (cart_id, buyer_id, created_at, updated_at)
         VALUES ($1, $2, $3, $3)`,
        [cartId, buyerId, daysAgo(10)]
      );

      // Thêm 2-3 món vào giỏ hàng
      const p1 = createdProductList[(b * 2) % createdProductList.length];
      const p2 = createdProductList[(b * 2 + 1) % createdProductList.length];

      if (p1 && p1.variants.length > 0) {
        await client.query(
          `INSERT INTO cart_items (cart_item_id, cart_id, variant_id, quantity, is_selected, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $6)`,
          [randomUUID(), cartId, p1.variants[0].variantId, 1, true, daysAgo(1)]
        );
      }

      if (p2 && p2.variants.length > 0) {
        await client.query(
          `INSERT INTO cart_items (cart_item_id, cart_id, variant_id, quantity, is_selected, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $6)`,
          [randomUUID(), cartId, p2.variants[0].variantId, 2, false, daysAgo(1)]
        );
      }
    }
    console.log('✓ Đã tạo giỏ hàng cho tất cả các Buyer.\n');

    // -------------------------------------------------------------------------
    // BƯỚC 11: CHAT, THÔNG BÁO VÀ NHẬT KÝ ADMIN (NOTIFICATIONS & CHAT & LOGS)
    // -------------------------------------------------------------------------
    console.log('>>> [Bước 11/11] Tạo hội thoại Chat, Thông báo hệ thống và Nhật ký Admin...');

    const adminId = userUuidMap.get(adminAccount.email)!;

    // 1. Hội thoại chat thực tế giữa buyer01 và shop01
    const conv1Id = randomUUID();
    const shop1 = shopMap.get(1)!;
    const buyer1Id = userUuidMap.get('buyer01@dino-demo.test')!;

    await client.query(
      `INSERT INTO chat_conversations (conversation_id, buyer_id, shop_id, current_product_id, mode, last_message_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'BOT_ASSISTANT', $5, $6, $5)`,
      [conv1Id, buyer1Id, shop1.id, createdProductList[0].productId, daysAgo(1, 14, 30), daysAgo(2)]
    );

    const chatMsgs = [
      { sender: buyer1Id, role: 'BUYER' as const, text: 'Shop ơi, tai nghe Dino Pods Pro này còn màu Đen Nhám không ạ?', time: daysAgo(1, 14, 0) },
      { sender: null, role: 'BOT' as const, text: 'Dạ Dino Pods Pro màu Đen Nhám hiện vẫn còn sẵn hàng tại kho Hà Nội ạ. Anh/chị có thể đặt ngay để nhận quà tặng kèm túi đựng nhé!', time: daysAgo(1, 14, 1) },
      { sender: buyer1Id, role: 'BUYER' as const, text: 'Giao về Cầu Giấy trong chiều nay kịp không shop?', time: daysAgo(1, 14, 10) },
      { sender: shop1.ownerId, role: 'SELLER' as const, text: 'Dạ được bạn nha, shop gửi hỏa tốc qua Ahamove/Grab chỉ 1-2 tiếng là tới nơi ạ!', time: daysAgo(1, 14, 15) },
    ];

    for (let m = 0; m < chatMsgs.length; m++) {
      const msg = chatMsgs[m];
      await client.query(
        `INSERT INTO chat_messages (message_id, conversation_id, client_message_id, sender_id, sender_role, message_type, content, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, 'TEXT', $6, true, $7)`,
        [randomUUID(), conv1Id, `cli-msg-${m}-${Date.now()}`, msg.sender, msg.role, msg.text, msg.time]
      );
    }

    // 2. Thông báo (Notifications)
    const notificationList = [
      {
        recipient: buyer1Id,
        type: 'ORDER',
        title: 'Đặt hàng thành công #DN1010',
        content: 'Đơn hàng của bạn đã được xác nhận và người bán đang tiến hành đóng gói vận chuyển.',
      },
      {
        recipient: buyer1Id,
        type: 'SHIPPING',
        title: 'Kiện hàng đang trên đường giao',
        content: 'Shipper GHTK đang giao kiện hàng đến địa chỉ Duy Tân của bạn. Vui lòng để ý điện thoại.',
      },
      {
        recipient: shop1.ownerId,
        type: 'ORDER',
        title: 'Bạn có đơn hàng mới!',
        content: 'Khách hàng Nguyễn Đức Thắng vừa đặt sản phẩm Tai nghe Bluetooth Dino Pods Pro.',
      },
      {
        recipient: adminId,
        type: 'SYSTEM',
        title: 'Hệ thống vận hành ổn định',
        content: 'Đã hoàn tất kiểm tra tải định kỳ và sao lưu cơ sở dữ liệu ngày 10/10/2026.',
      },
    ];

    for (const notif of notificationList) {
      await client.query(
        `INSERT INTO notifications (notification_id, recipient_id, type, title, content, is_read, read_at, created_at)
         VALUES ($1, $2, $3, $4, $5, true, $6, $6)`,
        [randomUUID(), notif.recipient, notif.type, notif.title, notif.content, daysAgo(1)]
      );
    }

    // 3. Admin Moderation & Logs
    const shop20 = shopMap.get(20)!;
    await client.query(
      `INSERT INTO moderation_records (moderation_id, target_type, target_id, reason, action, admin_id, created_at)
       VALUES ($1, 'SHOP', $2, 'Cửa hàng có dấu hiệu đăng tải sản phẩm vi phạm bản quyền trí tuệ, tạm khóa để làm rõ giải trình.', 'SUSPEND_SHOP', $3, $4)`,
      [randomUUID(), shop20.id, adminId, daysAgo(3)]
    );

    await client.query(
      `INSERT INTO admin_logs (log_id, admin_id, action, target_type, target_id, reason, created_at)
       VALUES ($1, $2, 'APPROVE_SHOP_TIER_MALL', 'SHOP', $3, 'Duyệt thăng hạng Mall cho Dino Tech Official Store dựa trên chứng từ ủy quyền phân phối.', $4)`,
      [randomUUID(), adminId, shop1.id, daysAgo(15)]
    );

    await client.query('COMMIT');
    console.log('✓ Hoàn tất commit toàn bộ cơ sở dữ liệu!\n');

    // -------------------------------------------------------------------------
    // BÁO CÁO THỐNG KÊ SAU KHI SEED
    // -------------------------------------------------------------------------
    console.log('================================================================');
    console.log('THỐNG KÊ SỐ LƯỢNG BẢN GHI ĐÃ TẠO THEO BẢNG:');
    console.log('================================================================');

    const checkTables = [
      'app_users',
      'user_profiles',
      'addresses',
      'shops',
      'shop_wallets',
      'categories',
      'products',
      'product_variants',
      'product_images',
      'vouchers',
      'voucher_usages',
      'flash_sale_sessions',
      'flash_sale_items',
      'orders',
      'order_items',
      'order_status_history',
      'payments',
      'shipments',
      'escrow_records',
      'wallet_transactions',
      'reviews',
      'carts',
      'cart_items',
      'chat_conversations',
      'chat_messages',
      'notifications',
      'moderation_records',
      'admin_logs',
    ];

    for (const t of checkTables) {
      const r = await client.query(`SELECT count(*)::int as cnt FROM ${t}`);
      console.log(`- ${t.padEnd(32)}: ${r.rows[0].cnt} bản ghi`);
    }

    console.log('\n================================================================');
    console.log('DANH SÁCH TÀI KHOẢN ĐĂNG NHẬP HỆ THỐNG:');
    console.log(`Mật khẩu chung cho tất cả tài khoản: ${SHARED_PASSWORD}`);
    console.log('----------------------------------------------------------------');
    console.log('ADMIN:');
    console.log('- admin@dino-demo.test');
    console.log('BUYERS (5 người):');
    for (let i = 1; i <= 5; i++) {
      console.log(`- buyer${String(i).padStart(2, '0')}@dino-demo.test`);
    }
    console.log('SELLERS (20 shop):');
    for (let i = 1; i <= 20; i++) {
      console.log(`- seller${String(i).padStart(2, '0')}@dino-demo.test`);
    }
    console.log('================================================================\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('LỖI TRONG QUÁ TRÌNH SEED DỮ LIỆU:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();
