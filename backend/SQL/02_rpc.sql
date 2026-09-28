-- =========================================================
-- RETAILPRO V4 - RPC TRANSACTION
-- Jalankan setelah 01_schema.sql.
-- =========================================================

create or replace function public.create_sale(
  p_payment_method public.payment_method,
  p_paid_amount numeric,
  p_items jsonb
) returns public.sales
language plpgsql security definer set search_path=public as $$
declare
  v_sale public.sales;
  v_item jsonb;
  v_product public.products;
  v_qty numeric;
  v_total numeric:=0;
  v_change numeric;
  v_invoice varchar;
begin
  if p_items is null or jsonb_array_length(p_items)=0 then raise exception 'Keranjang penjualan kosong.'; end if;
  if p_paid_amount is null or p_paid_amount<0 then raise exception 'Nominal pembayaran tidak valid.'; end if;

  -- Validasi dan kunci semua produk terlebih dahulu.
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
    where product_id=(v_item->>'product_id')::uuid and is_active=true for update;
    if not found then raise exception 'Produk tidak ditemukan atau tidak aktif.'; end if;
    v_qty=(v_item->>'quantity')::numeric;
    if v_qty is null or v_qty<=0 then raise exception 'Quantity produk tidak valid.'; end if;
    if v_product.stock<v_qty then raise exception 'Stok % tidak mencukupi. Stok tersedia: %.',v_product.product_name,v_product.stock; end if;
    v_total:=v_total+(v_qty*v_product.selling_price);
  end loop;

  if p_paid_amount<v_total then raise exception 'Pembayaran kurang. Total: %, dibayar: %.',v_total,p_paid_amount; end if;
  v_change:=p_paid_amount-v_total;
  v_invoice=public.next_invoice_no();

  insert into public.sales(invoice_no,payment_method,total_amount,paid_amount,change_amount,cashier_id)
  values(v_invoice,p_payment_method,v_total,p_paid_amount,v_change,null) returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where product_id=(v_item->>'product_id')::uuid for update;
    v_qty=(v_item->>'quantity')::numeric;
    insert into public.sale_items(sale_id,product_id,quantity,selling_price) values(v_sale.sale_id,v_product.product_id,v_qty,v_product.selling_price);
    update public.products set stock=stock-v_qty where product_id=v_product.product_id;
    insert into public.stock_movements(product_id,movement_type,quantity,reference_no,notes,created_by)
    values(v_product.product_id,'OUT',v_qty,v_invoice,'Penjualan',null);
  end loop;
  return v_sale;
end $$;

grant execute on function public.create_sale(public.payment_method,numeric,jsonb) to anon,authenticated;

create or replace function public.add_stock(
  p_product_id uuid,
  p_quantity numeric,
  p_movement_type varchar default 'IN',
  p_notes text default null
) returns public.products
language plpgsql security definer set search_path=public as $$
declare v_product public.products;
begin
  if p_quantity is null or p_quantity<=0 then raise exception 'Jumlah stok harus lebih dari 0.'; end if;
  if p_movement_type not in ('IN','ADJUSTMENT','OPENING') then raise exception 'Jenis mutasi stok tidak valid.'; end if;
  update public.products set stock=stock+p_quantity where product_id=p_product_id returning * into v_product;
  if not found then raise exception 'Produk tidak ditemukan.'; end if;
  insert into public.stock_movements(product_id,movement_type,quantity,notes,created_by)
  values(p_product_id,p_movement_type,p_quantity,p_notes,null);
  return v_product;
end $$;

grant execute on function public.add_stock(uuid,numeric,varchar,text) to anon,authenticated;
