-- =========================================================
-- RETAILPRO V4 - DATABASE SCHEMA
-- Jalankan file ini terlebih dahulu di Supabase SQL Editor.
-- =========================================================

create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_type where typname='payment_method') then
    create type public.payment_method as enum ('CASH','QRIS','TRANSFER');
  end if;
end $$;

create table if not exists public.categories (
  category_id uuid primary key default gen_random_uuid(),
  category_name varchar(100) not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  product_id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(category_id) on update cascade on delete restrict,
  product_code varchar(50) not null unique,
  product_name varchar(150) not null,
  unit varchar(30) not null default 'pcs',
  purchase_price numeric(15,2) not null default 0 check(purchase_price>=0),
  selling_price numeric(15,2) not null default 0 check(selling_price>=0),
  stock numeric(15,3) not null default 0 check(stock>=0),
  minimum_stock numeric(15,3) not null default 0 check(minimum_stock>=0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  sale_id uuid primary key default gen_random_uuid(),
  invoice_no varchar(60) not null unique,
  sale_date timestamptz not null default now(),
  payment_method public.payment_method not null default 'CASH',
  total_amount numeric(15,2) not null default 0 check(total_amount>=0),
  paid_amount numeric(15,2) not null default 0 check(paid_amount>=0),
  change_amount numeric(15,2) not null default 0 check(change_amount>=0),
  cashier_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  sale_item_id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(sale_id) on delete cascade,
  product_id uuid not null references public.products(product_id) on delete restrict,
  quantity numeric(15,3) not null check(quantity>0),
  selling_price numeric(15,2) not null check(selling_price>=0),
  subtotal numeric(15,2) generated always as (quantity*selling_price) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  movement_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(product_id) on delete restrict,
  movement_type varchar(20) not null check(movement_type in ('OPENING','IN','OUT','ADJUSTMENT')),
  quantity numeric(15,3) not null check(quantity>0),
  reference_no varchar(60),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_name on public.products(product_name);
create index if not exists idx_sales_date on public.sales(sale_date desc);
create index if not exists idx_sale_items_sale on public.sale_items(sale_id);
create index if not exists idx_sale_items_product on public.sale_items(product_id);
create index if not exists idx_stock_movements_product on public.stock_movements(product_id);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at before update on public.products for each row execute function public.set_updated_at();

create sequence if not exists public.invoice_seq start 1;

create or replace function public.next_invoice_no() returns varchar
language plpgsql security definer set search_path=public as $$
begin
  return 'INV-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.invoice_seq')::text,5,'0');
end $$;

-- Permissions untuk Supabase Data API.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.categories to anon, authenticated;
grant select, insert, update, delete on public.products to anon, authenticated;
grant select on public.sales, public.sale_items, public.stock_movements to anon, authenticated;
grant usage, select on sequence public.invoice_seq to anon, authenticated;
grant execute on function public.next_invoice_no() to anon, authenticated;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;

-- Hapus policy lama agar script aman dijalankan ulang.
do $$ declare r record; begin
  for r in select policyname,tablename from pg_policies where schemaname='public' and tablename in ('categories','products','sales','sale_items','stock_movements') loop
    execute format('drop policy if exists %I on public.%I',r.policyname,r.tablename);
  end loop;
end $$;

create policy "retail_demo_categories_select" on public.categories for select to anon,authenticated using(true);
create policy "retail_demo_categories_insert" on public.categories for insert to anon,authenticated with check(true);
create policy "retail_demo_categories_update" on public.categories for update to anon,authenticated using(true) with check(true);
create policy "retail_demo_categories_delete" on public.categories for delete to anon,authenticated using(true);

create policy "retail_demo_products_select" on public.products for select to anon,authenticated using(true);
create policy "retail_demo_products_insert" on public.products for insert to anon,authenticated with check(true);
create policy "retail_demo_products_update" on public.products for update to anon,authenticated using(true) with check(true);
create policy "retail_demo_products_delete" on public.products for delete to anon,authenticated using(true);

create policy "retail_demo_sales_select" on public.sales for select to anon,authenticated using(true);
create policy "retail_demo_sale_items_select" on public.sale_items for select to anon,authenticated using(true);
create policy "retail_demo_movements_select" on public.stock_movements for select to anon,authenticated using(true);
