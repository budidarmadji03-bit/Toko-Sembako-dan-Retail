-- =========================================================
-- RETAILPRO V4 - DATA AWAL
-- =========================================================

insert into public.categories(category_name,description) values
('Sembako','Kebutuhan pokok'),
('Minuman','Minuman kemasan'),
('Makanan','Makanan dan snack'),
('Kebersihan','Produk kebersihan'),
('Kebutuhan Rumah Tangga','Kebutuhan rumah tangga lainnya')
on conflict(category_name) do nothing;

insert into public.products(category_id,product_code,product_name,unit,purchase_price,selling_price,stock,minimum_stock)
select c.category_id,x.product_code,x.product_name,x.unit,x.purchase_price,x.selling_price,x.stock,x.minimum_stock
from (values
('Sembako','BRG001','Beras Premium 5 Kg','pcs',65000,75000,20,5),
('Sembako','BRG002','Minyak Goreng 1 Liter','pcs',15000,18000,35,10),
('Sembako','BRG003','Gula Pasir 1 Kg','kg',15000,17000,50,10),
('Minuman','BRG004','Teh Celup 25 Kantong','box',6000,8500,25,5),
('Minuman','BRG005','Air Mineral 600 ml','botol',2500,3500,60,15),
('Makanan','BRG006','Mie Instan Goreng','pcs',2500,3500,100,20),
('Kebersihan','BRG007','Sabun Cuci Piring 800 ml','botol',12000,15000,15,5)
) as x(category_name,product_code,product_name,unit,purchase_price,selling_price,stock,minimum_stock)
join public.categories c on c.category_name=x.category_name
on conflict(product_code) do nothing;
