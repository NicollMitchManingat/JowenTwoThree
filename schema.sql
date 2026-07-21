-- =====================================================
-- Enable UUID Extension
-- =====================================================
create extension if not exists "pgcrypto";

-- =====================================================
-- PRODUCT CATEGORIES
-- =====================================================
create table product_categories (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    description text,
    created_at timestamptz not null default now()
);

-- =====================================================
-- PRODUCTS
-- =====================================================
create table products (
    id uuid primary key default gen_random_uuid(),

    category_id uuid not null
        references product_categories(id)
        on delete restrict,

    product_name text not null,

    selling_price numeric(10,2) not null check (selling_price >= 0),

    status text not null default 'ACTIVE'
        check (status in ('ACTIVE', 'INACTIVE')),

    image_url text,

    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index idx_products_category
on products(category_id);

-- =====================================================
-- TRANSACTIONS
-- =====================================================
create table transactions (
    id uuid primary key default gen_random_uuid(),

    transaction_number text not null unique,

    idempotency_key uuid not null unique,

    subtotal numeric(10,2) not null default 0,
    discount numeric(10,2) not null default 0,
    total numeric(10,2) not null default 0,

    payment_method text not null
        check (payment_method in ('CASH', 'GCASH', 'CARD')),

    cash_received numeric(10,2),
    change_amount numeric(10,2),

    created_at timestamptz default now()
);

create index idx_transactions_created_at
on transactions(created_at);

-- =====================================================
-- TRANSACTION ITEMS
-- =====================================================
create table transaction_items (
    id uuid primary key default gen_random_uuid(),

    transaction_id uuid not null
        references transactions(id)
        on delete cascade,

    product_id uuid not null
        references products(id)
        on delete restrict,

    quantity integer not null check (quantity > 0),

    unit_price numeric(10,2) not null,

    subtotal numeric(10,2) not null
);

create index idx_transaction_items_transaction
on transaction_items(transaction_id);

create index idx_transaction_items_product
on transaction_items(product_id);

-- =====================================================
-- INVENTORY CATEGORIES
-- =====================================================
create table inventory_categories (
    id uuid primary key default gen_random_uuid(),

    name text not null unique,

    created_at timestamptz default now()
);

-- =====================================================
-- INVENTORY ITEMS
-- =====================================================
create table inventory_items (
    id uuid primary key default gen_random_uuid(),

    category_id uuid not null
        references inventory_categories(id)
        on delete restrict,

    item_name text not null,

    unit text not null,

    current_stock numeric(10,2) not null default 0,

    minimum_stock numeric(10,2) default 0,

    created_at timestamptz default now()
);

create index idx_inventory_items_category
on inventory_items(category_id);

-- =====================================================
-- INVENTORY BATCHES
-- =====================================================
create table inventory_batches (
    id uuid primary key default gen_random_uuid(),

    inventory_item_id uuid not null
        references inventory_items(id)
        on delete cascade,

    quantity numeric(10,2) not null,

    remaining_quantity numeric(10,2) not null,

    unit_cost numeric(10,2),

    supplier text,

    received_date date not null,

    expiration_date date,

    created_at timestamptz default now()
);

create index idx_inventory_batches_expiration
on inventory_batches(expiration_date);

create index idx_inventory_batches_item
on inventory_batches(inventory_item_id);

-- =====================================================
-- INVENTORY MOVEMENTS
-- =====================================================
create table inventory_movements (
    id uuid primary key default gen_random_uuid(),

    inventory_item_id uuid not null
        references inventory_items(id)
        on delete cascade,

    batch_id uuid
        references inventory_batches(id)
        on delete set null,

    movement_type text not null
        check (movement_type in ('IN', 'OUT', 'ADJUSTMENT', 'WASTE')),

    quantity numeric(10,2) not null,

    reference_type text
        check (reference_type in ('PURCHASE', 'SALE', 'MANUAL')),

    reference_id uuid,

    remarks text,

    created_at timestamptz default now()
);

create index idx_inventory_movements_item
on inventory_movements(inventory_item_id);