-- SQL Server diagram-only copy of PostgreSQL migrations (through 20261011200000).
-- Run once in SSMS. Creates a separate diagram database; contains structure only, no data.
-- Supabase auth.users is external, so its FK is omitted.

IF DB_ID(N'ECommerceClassDiagram') IS NULL
    CREATE DATABASE [ECommerceClassDiagram];
GO
USE [ECommerceClassDiagram];
GO

CREATE TABLE [dbo].[app_users] (
    [user_id] UNIQUEIDENTIFIER NOT NULL,
    [email] VARCHAR(255) NOT NULL,
    [role] VARCHAR(20) NOT NULL,
    [status] VARCHAR(20) NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    [buyer_tier] VARCHAR(20) NOT NULL,
    [total_spent] NUMERIC(15,2) NOT NULL,
    [loyalty_points] INT NOT NULL,
    CONSTRAINT [pk_app_users] PRIMARY KEY ([user_id])
);
GO

CREATE TABLE [dbo].[user_profiles] (
    [user_id] UNIQUEIDENTIFIER NOT NULL,
    [full_name] VARCHAR(150) NOT NULL,
    [phone] VARCHAR(20) NULL,
    [avatar_url] NVARCHAR(MAX) NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_user_profiles] PRIMARY KEY ([user_id])
);
GO

CREATE TABLE [dbo].[addresses] (
    [address_id] UNIQUEIDENTIFIER NOT NULL,
    [user_id] UNIQUEIDENTIFIER NOT NULL,
    [recipient_name] VARCHAR(150) NOT NULL,
    [phone] VARCHAR(20) NOT NULL,
    [province] VARCHAR(100) NOT NULL,
    [district] VARCHAR(100) NOT NULL,
    [ward] VARCHAR(100) NOT NULL,
    [detail_address] VARCHAR(255) NOT NULL,
    [is_default] BIT NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    [province_code] VARCHAR(10) NULL,
    [ward_code] VARCHAR(10) NULL,
    CONSTRAINT [pk_addresses] PRIMARY KEY ([address_id])
);
GO

CREATE TABLE [dbo].[shops] (
    [shop_id] UNIQUEIDENTIFIER NOT NULL,
    [owner_id] UNIQUEIDENTIFIER NOT NULL,
    [shop_name] VARCHAR(150) NOT NULL,
    [description] NVARCHAR(MAX) NULL,
    [logo_url] NVARCHAR(MAX) NULL,
    [pickup_address] VARCHAR(255) NULL,
    [contact_phone] VARCHAR(20) NULL,
    [status] VARCHAR(20) NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    [pickup_province_code] VARCHAR(10) NULL,
    [pickup_province] VARCHAR(100) NULL,
    [pickup_ward_code] VARCHAR(10) NULL,
    [pickup_ward] VARCHAR(100) NULL,
    [pickup_detail_address] VARCHAR(255) NULL,
    [tier] VARCHAR(20) NOT NULL,
    [tier_override] BIT NOT NULL,
    [tier_override_reason] NVARCHAR(MAX) NULL,
    [tier_overridden_at] DATETIMEOFFSET NULL,
    [tier_override_by] UNIQUEIDENTIFIER NULL,
    CONSTRAINT [pk_shops] PRIMARY KEY ([shop_id])
);
GO

CREATE TABLE [dbo].[categories] (
    [category_id] UNIQUEIDENTIFIER NOT NULL,
    [parent_category_id] UNIQUEIDENTIFIER NULL,
    [category_name] VARCHAR(150) NOT NULL,
    [description] NVARCHAR(MAX) NULL,
    [status] VARCHAR(20) NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_categories] PRIMARY KEY ([category_id])
);
GO

CREATE TABLE [dbo].[products] (
    [product_id] UNIQUEIDENTIFIER NOT NULL,
    [shop_id] UNIQUEIDENTIFIER NOT NULL,
    [category_id] UNIQUEIDENTIFIER NOT NULL,
    [product_name] VARCHAR(255) NOT NULL,
    [description] NVARCHAR(MAX) NULL,
    [status] VARCHAR(20) NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    [weight_grams] INT NOT NULL,
    CONSTRAINT [pk_products] PRIMARY KEY ([product_id])
);
GO

CREATE TABLE [dbo].[product_images] (
    [image_id] UNIQUEIDENTIFIER NOT NULL,
    [product_id] UNIQUEIDENTIFIER NOT NULL,
    [image_url] NVARCHAR(MAX) NOT NULL,
    [sort_order] INT NOT NULL,
    CONSTRAINT [pk_product_images] PRIMARY KEY ([image_id])
);
GO

CREATE TABLE [dbo].[product_variants] (
    [variant_id] UNIQUEIDENTIFIER NOT NULL,
    [product_id] UNIQUEIDENTIFIER NOT NULL,
    [variant_name] VARCHAR(100) NOT NULL,
    [variant_value] VARCHAR(150) NULL,
    [sku] VARCHAR(100) NOT NULL,
    [price] NUMERIC(15,2) NOT NULL,
    [stock_quantity] INT NOT NULL,
    [status] VARCHAR(20) NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_product_variants] PRIMARY KEY ([variant_id])
);
GO

CREATE TABLE [dbo].[carts] (
    [cart_id] UNIQUEIDENTIFIER NOT NULL,
    [buyer_id] UNIQUEIDENTIFIER NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_carts] PRIMARY KEY ([cart_id])
);
GO

CREATE TABLE [dbo].[cart_items] (
    [cart_item_id] UNIQUEIDENTIFIER NOT NULL,
    [cart_id] UNIQUEIDENTIFIER NOT NULL,
    [variant_id] UNIQUEIDENTIFIER NOT NULL,
    [quantity] INT NOT NULL,
    [is_selected] BIT NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_cart_items] PRIMARY KEY ([cart_item_id])
);
GO

CREATE TABLE [dbo].[orders] (
    [order_id] UNIQUEIDENTIFIER NOT NULL,
    [buyer_id] UNIQUEIDENTIFIER NOT NULL,
    [shop_id] UNIQUEIDENTIFIER NOT NULL,
    [recipient_name] VARCHAR(150) NOT NULL,
    [recipient_phone] VARCHAR(20) NOT NULL,
    [province] VARCHAR(100) NOT NULL,
    [district] VARCHAR(100) NOT NULL,
    [ward] VARCHAR(100) NOT NULL,
    [delivery_address] VARCHAR(255) NOT NULL,
    [subtotal] NUMERIC(15,2) NOT NULL,
    [discount_amount] NUMERIC(15,2) NOT NULL,
    [shipping_fee] NUMERIC(15,2) NOT NULL,
    [total_amount] NUMERIC(15,2) NOT NULL,
    [status] VARCHAR(30) NOT NULL,
    [cancel_reason] NVARCHAR(MAX) NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_orders] PRIMARY KEY ([order_id])
);
GO

CREATE TABLE [dbo].[order_items] (
    [order_item_id] UNIQUEIDENTIFIER NOT NULL,
    [order_id] UNIQUEIDENTIFIER NOT NULL,
    [product_id] UNIQUEIDENTIFIER NOT NULL,
    [variant_id] UNIQUEIDENTIFIER NOT NULL,
    [product_name_snapshot] VARCHAR(255) NOT NULL,
    [variant_snapshot] VARCHAR(255) NULL,
    [unit_price] NUMERIC(15,2) NOT NULL,
    [quantity] INT NOT NULL,
    [line_total] NUMERIC(15,2) NOT NULL,
    CONSTRAINT [pk_order_items] PRIMARY KEY ([order_item_id])
);
GO

CREATE TABLE [dbo].[order_status_history] (
    [history_id] UNIQUEIDENTIFIER NOT NULL,
    [order_id] UNIQUEIDENTIFIER NOT NULL,
    [old_status] VARCHAR(30) NULL,
    [new_status] VARCHAR(30) NOT NULL,
    [changed_by] UNIQUEIDENTIFIER NULL,
    [reason] NVARCHAR(MAX) NULL,
    [changed_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_order_status_history] PRIMARY KEY ([history_id])
);
GO

CREATE TABLE [dbo].[payments] (
    [payment_id] UNIQUEIDENTIFIER NOT NULL,
    [order_id] UNIQUEIDENTIFIER NOT NULL,
    [transaction_code] VARCHAR(100) NULL,
    [method] VARCHAR(20) NOT NULL,
    [amount] NUMERIC(15,2) NOT NULL,
    [status] VARCHAR(20) NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [paid_at] DATETIMEOFFSET NULL,
    [note] NVARCHAR(MAX) NULL,
    CONSTRAINT [pk_payments] PRIMARY KEY ([payment_id])
);
GO

CREATE TABLE [dbo].[shipments] (
    [shipment_id] UNIQUEIDENTIFIER NOT NULL,
    [order_id] UNIQUEIDENTIFIER NOT NULL,
    [carrier_name] VARCHAR(150) NULL,
    [tracking_code] VARCHAR(100) NULL,
    [status] VARCHAR(30) NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_shipments] PRIMARY KEY ([shipment_id])
);
GO

CREATE TABLE [dbo].[vouchers] (
    [voucher_id] UNIQUEIDENTIFIER NOT NULL,
    [code] VARCHAR(50) NOT NULL,
    [voucher_name] VARCHAR(150) NOT NULL,
    [scope] VARCHAR(20) NOT NULL,
    [shop_id] UNIQUEIDENTIFIER NULL,
    [discount_type] VARCHAR(20) NOT NULL,
    [discount_value] NUMERIC(15,2) NOT NULL,
    [max_discount] NUMERIC(15,2) NULL,
    [min_order_value] NUMERIC(15,2) NOT NULL,
    [quantity] INT NOT NULL,
    [start_at] DATETIMEOFFSET NOT NULL,
    [end_at] DATETIMEOFFSET NOT NULL,
    [status] VARCHAR(20) NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    [loyalty_owner_id] UNIQUEIDENTIFIER NULL,
    CONSTRAINT [pk_vouchers] PRIMARY KEY ([voucher_id])
);
GO

CREATE TABLE [dbo].[voucher_usages] (
    [usage_id] UNIQUEIDENTIFIER NOT NULL,
    [voucher_id] UNIQUEIDENTIFIER NOT NULL,
    [order_id] UNIQUEIDENTIFIER NOT NULL,
    [buyer_id] UNIQUEIDENTIFIER NOT NULL,
    [discount_amount] NUMERIC(15,2) NOT NULL,
    [used_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_voucher_usages] PRIMARY KEY ([usage_id])
);
GO

CREATE TABLE [dbo].[reviews] (
    [review_id] UNIQUEIDENTIFIER NOT NULL,
    [buyer_id] UNIQUEIDENTIFIER NOT NULL,
    [product_id] UNIQUEIDENTIFIER NOT NULL,
    [order_item_id] UNIQUEIDENTIFIER NOT NULL,
    [rating] SMALLINT NOT NULL,
    [content] NVARCHAR(MAX) NULL,
    [status] VARCHAR(20) NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_reviews] PRIMARY KEY ([review_id])
);
GO

CREATE TABLE [dbo].[review_images] (
    [review_image_id] UNIQUEIDENTIFIER NOT NULL,
    [review_id] UNIQUEIDENTIFIER NOT NULL,
    [image_url] NVARCHAR(MAX) NOT NULL,
    [sort_order] INT NOT NULL,
    CONSTRAINT [pk_review_images] PRIMARY KEY ([review_image_id])
);
GO

CREATE TABLE [dbo].[notifications] (
    [notification_id] UNIQUEIDENTIFIER NOT NULL,
    [recipient_id] UNIQUEIDENTIFIER NOT NULL,
    [type] VARCHAR(30) NOT NULL,
    [title] VARCHAR(255) NOT NULL,
    [content] NVARCHAR(MAX) NOT NULL,
    [is_read] BIT NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [read_at] DATETIMEOFFSET NULL,
    [event_id] VARCHAR(100) NULL,
    CONSTRAINT [pk_notifications] PRIMARY KEY ([notification_id])
);
GO

CREATE TABLE [dbo].[moderation_records] (
    [moderation_id] UNIQUEIDENTIFIER NOT NULL,
    [target_type] VARCHAR(30) NOT NULL,
    [target_id] UNIQUEIDENTIFIER NULL,
    [reason] NVARCHAR(MAX) NOT NULL,
    [action] VARCHAR(50) NOT NULL,
    [admin_id] UNIQUEIDENTIFIER NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_moderation_records] PRIMARY KEY ([moderation_id])
);
GO

CREATE TABLE [dbo].[admin_logs] (
    [log_id] UNIQUEIDENTIFIER NOT NULL,
    [admin_id] UNIQUEIDENTIFIER NOT NULL,
    [action] VARCHAR(100) NOT NULL,
    [target_type] VARCHAR(30) NULL,
    [target_id] UNIQUEIDENTIFIER NULL,
    [reason] NVARCHAR(MAX) NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_admin_logs] PRIMARY KEY ([log_id])
);
GO

CREATE TABLE [dbo].[api_idempotency_records] (
    [user_id] UNIQUEIDENTIFIER NOT NULL,
    [endpoint] VARCHAR(120) NOT NULL,
    [idempotency_key] VARCHAR(128) NOT NULL,
    [fingerprint] CHAR(64) NOT NULL,
    [result] NVARCHAR(MAX) NOT NULL,
    [expires_at] DATETIMEOFFSET NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_api_idempotency_records] PRIMARY KEY ([user_id], [endpoint], [idempotency_key])
);
GO

CREATE TABLE [dbo].[media_uploads] (
    [media_id] UNIQUEIDENTIFIER NOT NULL,
    [owner_id] UNIQUEIDENTIFIER NOT NULL,
    [purpose] VARCHAR(20) NOT NULL,
    [bucket_id] VARCHAR(63) NOT NULL,
    [object_path] NVARCHAR(MAX) NOT NULL,
    [status] VARCHAR(20) NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [expires_at] DATETIMEOFFSET NOT NULL,
    [finalized_at] DATETIMEOFFSET NULL,
    [attached_at] DATETIMEOFFSET NULL,
    [deleted_at] DATETIMEOFFSET NULL,
    [cleanup_error] NVARCHAR(MAX) NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_media_uploads] PRIMARY KEY ([media_id])
);
GO

CREATE TABLE [dbo].[admin_notification_campaigns] (
    [campaign_id] UNIQUEIDENTIFIER NOT NULL,
    [admin_id] UNIQUEIDENTIFIER NOT NULL,
    [audience_role] VARCHAR(20) NOT NULL,
    [title] VARCHAR(200) NOT NULL,
    [content] NVARCHAR(MAX) NOT NULL,
    [reason] NVARCHAR(MAX) NOT NULL,
    [idempotency_key] VARCHAR(100) NOT NULL,
    [payload_fingerprint] CHAR(64) NOT NULL,
    [status] VARCHAR(20) NOT NULL,
    [recipient_count] INT NOT NULL,
    [delivered_count] INT NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_admin_notification_campaigns] PRIMARY KEY ([campaign_id])
);
GO

CREATE TABLE [dbo].[admin_notification_campaign_recipients] (
    [campaign_id] UNIQUEIDENTIFIER NOT NULL,
    [user_id] UNIQUEIDENTIFIER NOT NULL,
    [status] VARCHAR(20) NOT NULL,
    [sent_at] DATETIMEOFFSET NULL,
    CONSTRAINT [pk_admin_notification_campaign_recipients] PRIMARY KEY ([campaign_id], [user_id])
);
GO

CREATE TABLE [dbo].[chat_conversations] (
    [conversation_id] UNIQUEIDENTIFIER NOT NULL,
    [buyer_id] UNIQUEIDENTIFIER NOT NULL,
    [shop_id] UNIQUEIDENTIFIER NOT NULL,
    [current_product_id] UNIQUEIDENTIFIER NULL,
    [mode] VARCHAR(30) NOT NULL,
    [bot_permissions] NVARCHAR(MAX) NOT NULL,
    [last_message_at] DATETIMEOFFSET NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_chat_conversations] PRIMARY KEY ([conversation_id])
);
GO

CREATE TABLE [dbo].[chat_messages] (
    [message_id] UNIQUEIDENTIFIER NOT NULL,
    [conversation_id] UNIQUEIDENTIFIER NOT NULL,
    [client_message_id] VARCHAR(100) NULL,
    [sender_id] UNIQUEIDENTIFIER NULL,
    [sender_role] VARCHAR(20) NOT NULL,
    [message_type] VARCHAR(30) NOT NULL,
    [content] NVARCHAR(MAX) NOT NULL,
    [metadata] NVARCHAR(MAX) NOT NULL,
    [is_read] BIT NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_chat_messages] PRIMARY KEY ([message_id])
);
GO

CREATE TABLE [dbo].[flash_sale_sessions] (
    [slot_id] UNIQUEIDENTIFIER NOT NULL,
    [slot_name] VARCHAR(150) NOT NULL,
    [start_time] DATETIMEOFFSET NOT NULL,
    [end_time] DATETIMEOFFSET NOT NULL,
    [status] VARCHAR(20) NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_flash_sale_sessions] PRIMARY KEY ([slot_id])
);
GO

CREATE TABLE [dbo].[flash_sale_items] (
    [item_id] UNIQUEIDENTIFIER NOT NULL,
    [slot_id] UNIQUEIDENTIFIER NOT NULL,
    [product_id] UNIQUEIDENTIFIER NOT NULL,
    [variant_id] UNIQUEIDENTIFIER NOT NULL,
    [original_price] NUMERIC(15,2) NOT NULL,
    [flash_sale_price] NUMERIC(15,2) NOT NULL,
    [allocated_stock] INT NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_flash_sale_items] PRIMARY KEY ([item_id])
);
GO

CREATE TABLE [dbo].[flash_sale_compensation_logs] (
    [compensation_id] UNIQUEIDENTIFIER NOT NULL,
    [slot_id] UNIQUEIDENTIFIER NOT NULL,
    [item_id] UNIQUEIDENTIFIER NOT NULL,
    [user_id] UNIQUEIDENTIFIER NOT NULL,
    [reason] NVARCHAR(MAX) NOT NULL,
    [status] VARCHAR(20) NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_flash_sale_compensation_logs] PRIMARY KEY ([compensation_id])
);
GO

CREATE TABLE [dbo].[shop_wallets] (
    [wallet_id] UNIQUEIDENTIFIER NOT NULL,
    [shop_id] UNIQUEIDENTIFIER NOT NULL,
    [balance] NUMERIC(15,2) NOT NULL,
    [hold_balance] NUMERIC(15,2) NOT NULL,
    [bank_name] VARCHAR(100) NULL,
    [bank_account_number] VARCHAR(50) NULL,
    [bank_account_holder] VARCHAR(150) NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_shop_wallets] PRIMARY KEY ([wallet_id])
);
GO

CREATE TABLE [dbo].[escrow_records] (
    [escrow_id] UNIQUEIDENTIFIER NOT NULL,
    [order_id] UNIQUEIDENTIFIER NOT NULL,
    [shop_id] UNIQUEIDENTIFIER NOT NULL,
    [gross_amount] NUMERIC(15,2) NOT NULL,
    [commission_rate] NUMERIC(5,4) NOT NULL,
    [commission_fee] NUMERIC(15,2) NOT NULL,
    [net_amount] NUMERIC(15,2) NOT NULL,
    [status] VARCHAR(30) NOT NULL,
    [released_at] DATETIMEOFFSET NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_escrow_records] PRIMARY KEY ([escrow_id])
);
GO

CREATE TABLE [dbo].[wallet_transactions] (
    [transaction_id] UNIQUEIDENTIFIER NOT NULL,
    [wallet_id] UNIQUEIDENTIFIER NOT NULL,
    [type] VARCHAR(30) NOT NULL,
    [amount] NUMERIC(15,2) NOT NULL,
    [balance_before] NUMERIC(15,2) NOT NULL,
    [balance_after] NUMERIC(15,2) NOT NULL,
    [reference_type] VARCHAR(30) NOT NULL,
    [reference_id] UNIQUEIDENTIFIER NOT NULL,
    [description] NVARCHAR(MAX) NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_wallet_transactions] PRIMARY KEY ([transaction_id])
);
GO

CREATE TABLE [dbo].[withdrawal_requests] (
    [request_id] UNIQUEIDENTIFIER NOT NULL,
    [shop_id] UNIQUEIDENTIFIER NOT NULL,
    [amount] NUMERIC(15,2) NOT NULL,
    [bank_name] VARCHAR(100) NOT NULL,
    [bank_account_number] VARCHAR(50) NOT NULL,
    [bank_account_holder] VARCHAR(150) NOT NULL,
    [status] VARCHAR(30) NOT NULL,
    [admin_note] NVARCHAR(MAX) NULL,
    [processed_by] UNIQUEIDENTIFIER NULL,
    [processed_at] DATETIMEOFFSET NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_withdrawal_requests] PRIMARY KEY ([request_id])
);
GO

CREATE TABLE [dbo].[loyalty_point_transactions] (
    [transaction_id] UNIQUEIDENTIFIER NOT NULL,
    [user_id] UNIQUEIDENTIFIER NOT NULL,
    [points_delta] INT NOT NULL,
    [reference_order_id] UNIQUEIDENTIFIER NULL,
    [reason] VARCHAR(50) NOT NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [operation_key] NVARCHAR(MAX) NULL,
    [voucher_id] UNIQUEIDENTIFIER NULL,
    [eligible_spent_amount] NUMERIC(15,2) NULL,
    [refunded_eligible_amount] NUMERIC(15,2) NULL,
    CONSTRAINT [pk_loyalty_point_transactions] PRIMARY KEY ([transaction_id])
);
GO

CREATE TABLE [dbo].[shop_chat_presence] (
    [shop_id] UNIQUEIDENTIFIER NOT NULL,
    [is_online] BIT NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_shop_chat_presence] PRIMARY KEY ([shop_id])
);
GO

CREATE TABLE [dbo].[shop_mall_requests] (
    [request_id] UNIQUEIDENTIFIER NOT NULL,
    [shop_id] UNIQUEIDENTIFIER NOT NULL,
    [seller_id] UNIQUEIDENTIFIER NOT NULL,
    [admin_id] UNIQUEIDENTIFIER NULL,
    [reason] NVARCHAR(MAX) NOT NULL,
    [document_url] VARCHAR(500) NOT NULL,
    [status] VARCHAR(20) NOT NULL,
    [admin_note] NVARCHAR(MAX) NULL,
    [reviewed_at] DATETIMEOFFSET NULL,
    [cancelled_at] DATETIMEOFFSET NULL,
    [created_at] DATETIMEOFFSET NOT NULL,
    [updated_at] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [pk_shop_mall_requests] PRIMARY KEY ([request_id])
);
GO

ALTER TABLE [dbo].[user_profiles] ADD CONSTRAINT [fk_diagram_user_profiles_user_id] FOREIGN KEY ([user_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[addresses] ADD CONSTRAINT [fk_diagram_addresses_user_id] FOREIGN KEY ([user_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[shops] ADD CONSTRAINT [fk_diagram_shops_owner_id] FOREIGN KEY ([owner_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[categories] ADD CONSTRAINT [fk_diagram_categories_parent_category_id] FOREIGN KEY ([parent_category_id]) REFERENCES [dbo].[categories] ([category_id]);
GO
ALTER TABLE [dbo].[products] ADD CONSTRAINT [fk_diagram_products_shop_id] FOREIGN KEY ([shop_id]) REFERENCES [dbo].[shops] ([shop_id]);
GO
ALTER TABLE [dbo].[products] ADD CONSTRAINT [fk_diagram_products_category_id] FOREIGN KEY ([category_id]) REFERENCES [dbo].[categories] ([category_id]);
GO
ALTER TABLE [dbo].[product_images] ADD CONSTRAINT [fk_diagram_product_images_product_id] FOREIGN KEY ([product_id]) REFERENCES [dbo].[products] ([product_id]);
GO
ALTER TABLE [dbo].[product_variants] ADD CONSTRAINT [fk_diagram_product_variants_product_id] FOREIGN KEY ([product_id]) REFERENCES [dbo].[products] ([product_id]);
GO
ALTER TABLE [dbo].[carts] ADD CONSTRAINT [fk_diagram_carts_buyer_id] FOREIGN KEY ([buyer_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[cart_items] ADD CONSTRAINT [fk_diagram_cart_items_cart_id] FOREIGN KEY ([cart_id]) REFERENCES [dbo].[carts] ([cart_id]);
GO
ALTER TABLE [dbo].[cart_items] ADD CONSTRAINT [fk_diagram_cart_items_variant_id] FOREIGN KEY ([variant_id]) REFERENCES [dbo].[product_variants] ([variant_id]);
GO
ALTER TABLE [dbo].[orders] ADD CONSTRAINT [fk_diagram_orders_buyer_id] FOREIGN KEY ([buyer_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[orders] ADD CONSTRAINT [fk_diagram_orders_shop_id] FOREIGN KEY ([shop_id]) REFERENCES [dbo].[shops] ([shop_id]);
GO
ALTER TABLE [dbo].[order_items] ADD CONSTRAINT [fk_diagram_order_items_order_id] FOREIGN KEY ([order_id]) REFERENCES [dbo].[orders] ([order_id]);
GO
ALTER TABLE [dbo].[order_items] ADD CONSTRAINT [fk_diagram_order_items_product_id] FOREIGN KEY ([product_id]) REFERENCES [dbo].[products] ([product_id]);
GO
ALTER TABLE [dbo].[order_items] ADD CONSTRAINT [fk_diagram_order_items_variant_id] FOREIGN KEY ([variant_id]) REFERENCES [dbo].[product_variants] ([variant_id]);
GO
ALTER TABLE [dbo].[order_status_history] ADD CONSTRAINT [fk_diagram_order_status_history_order_id] FOREIGN KEY ([order_id]) REFERENCES [dbo].[orders] ([order_id]);
GO
ALTER TABLE [dbo].[order_status_history] ADD CONSTRAINT [fk_diagram_order_status_history_changed_by] FOREIGN KEY ([changed_by]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[payments] ADD CONSTRAINT [fk_diagram_payments_order_id] FOREIGN KEY ([order_id]) REFERENCES [dbo].[orders] ([order_id]);
GO
ALTER TABLE [dbo].[shipments] ADD CONSTRAINT [fk_diagram_shipments_order_id] FOREIGN KEY ([order_id]) REFERENCES [dbo].[orders] ([order_id]);
GO
ALTER TABLE [dbo].[vouchers] ADD CONSTRAINT [fk_diagram_vouchers_shop_id] FOREIGN KEY ([shop_id]) REFERENCES [dbo].[shops] ([shop_id]);
GO
ALTER TABLE [dbo].[voucher_usages] ADD CONSTRAINT [fk_diagram_voucher_usages_voucher_id] FOREIGN KEY ([voucher_id]) REFERENCES [dbo].[vouchers] ([voucher_id]);
GO
ALTER TABLE [dbo].[voucher_usages] ADD CONSTRAINT [fk_diagram_voucher_usages_order_id] FOREIGN KEY ([order_id]) REFERENCES [dbo].[orders] ([order_id]);
GO
ALTER TABLE [dbo].[voucher_usages] ADD CONSTRAINT [fk_diagram_voucher_usages_buyer_id] FOREIGN KEY ([buyer_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[reviews] ADD CONSTRAINT [fk_diagram_reviews_buyer_id] FOREIGN KEY ([buyer_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[reviews] ADD CONSTRAINT [fk_diagram_reviews_product_id] FOREIGN KEY ([product_id]) REFERENCES [dbo].[products] ([product_id]);
GO
ALTER TABLE [dbo].[reviews] ADD CONSTRAINT [fk_diagram_reviews_order_item_id] FOREIGN KEY ([order_item_id]) REFERENCES [dbo].[order_items] ([order_item_id]);
GO
ALTER TABLE [dbo].[review_images] ADD CONSTRAINT [fk_diagram_review_images_review_id] FOREIGN KEY ([review_id]) REFERENCES [dbo].[reviews] ([review_id]);
GO
ALTER TABLE [dbo].[notifications] ADD CONSTRAINT [fk_diagram_notifications_recipient_id] FOREIGN KEY ([recipient_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[moderation_records] ADD CONSTRAINT [fk_diagram_moderation_records_admin_id] FOREIGN KEY ([admin_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[admin_logs] ADD CONSTRAINT [fk_diagram_admin_logs_admin_id] FOREIGN KEY ([admin_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[api_idempotency_records] ADD CONSTRAINT [fk_diagram_api_idempotency_records_user_id] FOREIGN KEY ([user_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[media_uploads] ADD CONSTRAINT [fk_diagram_media_uploads_owner_id] FOREIGN KEY ([owner_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[admin_notification_campaigns] ADD CONSTRAINT [fk_diagram_admin_notification_campaigns_admin_id] FOREIGN KEY ([admin_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[admin_notification_campaign_recipients] ADD CONSTRAINT [fk_diagram_admin_notification_campaign_recipients_campaign_id] FOREIGN KEY ([campaign_id]) REFERENCES [dbo].[admin_notification_campaigns] ([campaign_id]);
GO
ALTER TABLE [dbo].[admin_notification_campaign_recipients] ADD CONSTRAINT [fk_diagram_admin_notification_campaign_recipients_user_id] FOREIGN KEY ([user_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[chat_conversations] ADD CONSTRAINT [fk_diagram_chat_conversations_buyer_id] FOREIGN KEY ([buyer_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[chat_conversations] ADD CONSTRAINT [fk_diagram_chat_conversations_shop_id] FOREIGN KEY ([shop_id]) REFERENCES [dbo].[shops] ([shop_id]);
GO
ALTER TABLE [dbo].[chat_conversations] ADD CONSTRAINT [fk_diagram_chat_conversations_current_product_id] FOREIGN KEY ([current_product_id]) REFERENCES [dbo].[products] ([product_id]);
GO
ALTER TABLE [dbo].[chat_messages] ADD CONSTRAINT [fk_diagram_chat_messages_conversation_id] FOREIGN KEY ([conversation_id]) REFERENCES [dbo].[chat_conversations] ([conversation_id]);
GO
ALTER TABLE [dbo].[chat_messages] ADD CONSTRAINT [fk_diagram_chat_messages_sender_id] FOREIGN KEY ([sender_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[flash_sale_items] ADD CONSTRAINT [fk_diagram_flash_sale_items_slot_id] FOREIGN KEY ([slot_id]) REFERENCES [dbo].[flash_sale_sessions] ([slot_id]);
GO
ALTER TABLE [dbo].[flash_sale_items] ADD CONSTRAINT [fk_diagram_flash_sale_items_product_id] FOREIGN KEY ([product_id]) REFERENCES [dbo].[products] ([product_id]);
GO
ALTER TABLE [dbo].[flash_sale_items] ADD CONSTRAINT [fk_diagram_flash_sale_items_variant_id] FOREIGN KEY ([variant_id]) REFERENCES [dbo].[product_variants] ([variant_id]);
GO
ALTER TABLE [dbo].[flash_sale_compensation_logs] ADD CONSTRAINT [fk_diagram_flash_sale_compensation_logs_user_id] FOREIGN KEY ([user_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[shop_wallets] ADD CONSTRAINT [fk_diagram_shop_wallets_shop_id] FOREIGN KEY ([shop_id]) REFERENCES [dbo].[shops] ([shop_id]);
GO
ALTER TABLE [dbo].[escrow_records] ADD CONSTRAINT [fk_diagram_escrow_records_order_id] FOREIGN KEY ([order_id]) REFERENCES [dbo].[orders] ([order_id]);
GO
ALTER TABLE [dbo].[escrow_records] ADD CONSTRAINT [fk_diagram_escrow_records_shop_id] FOREIGN KEY ([shop_id]) REFERENCES [dbo].[shops] ([shop_id]);
GO
ALTER TABLE [dbo].[wallet_transactions] ADD CONSTRAINT [fk_diagram_wallet_transactions_wallet_id] FOREIGN KEY ([wallet_id]) REFERENCES [dbo].[shop_wallets] ([wallet_id]);
GO
ALTER TABLE [dbo].[withdrawal_requests] ADD CONSTRAINT [fk_diagram_withdrawal_requests_shop_id] FOREIGN KEY ([shop_id]) REFERENCES [dbo].[shops] ([shop_id]);
GO
ALTER TABLE [dbo].[withdrawal_requests] ADD CONSTRAINT [fk_diagram_withdrawal_requests_processed_by] FOREIGN KEY ([processed_by]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[shops] ADD CONSTRAINT [fk_diagram_shops_tier_override_by] FOREIGN KEY ([tier_override_by]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[loyalty_point_transactions] ADD CONSTRAINT [fk_diagram_loyalty_point_transactions_user_id] FOREIGN KEY ([user_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[loyalty_point_transactions] ADD CONSTRAINT [fk_diagram_loyalty_point_transactions_reference_order_id] FOREIGN KEY ([reference_order_id]) REFERENCES [dbo].[orders] ([order_id]);
GO
ALTER TABLE [dbo].[shop_chat_presence] ADD CONSTRAINT [fk_diagram_shop_chat_presence_shop_id] FOREIGN KEY ([shop_id]) REFERENCES [dbo].[shops] ([shop_id]);
GO
ALTER TABLE [dbo].[shop_mall_requests] ADD CONSTRAINT [fk_diagram_shop_mall_requests_shop_id] FOREIGN KEY ([shop_id]) REFERENCES [dbo].[shops] ([shop_id]);
GO
ALTER TABLE [dbo].[shop_mall_requests] ADD CONSTRAINT [fk_diagram_shop_mall_requests_seller_id] FOREIGN KEY ([seller_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[shop_mall_requests] ADD CONSTRAINT [fk_diagram_shop_mall_requests_admin_id] FOREIGN KEY ([admin_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[vouchers] ADD CONSTRAINT [fk_diagram_vouchers_loyalty_owner_id] FOREIGN KEY ([loyalty_owner_id]) REFERENCES [dbo].[app_users] ([user_id]);
GO
ALTER TABLE [dbo].[loyalty_point_transactions] ADD CONSTRAINT [fk_diagram_loyalty_point_transactions_voucher_id] FOREIGN KEY ([voucher_id]) REFERENCES [dbo].[vouchers] ([voucher_id]);
GO
