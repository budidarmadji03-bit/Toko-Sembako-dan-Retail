const $ = (id) => document.getElementById(id);
const rupiah = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n || 0));
const qtyFormat = (n) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(Number(n || 0));

let categories = [];
let products = [];
let cart = [];
let salesHistory = [];
let reportRows = [];
let lastReceiptSaleId = null;
let mode = "LOCAL";
let busy = false;

const LOCAL_KEY = "retailpro_v4_data";

const demoData = {
  categories: [
    { category_id: "cat-1", category_name: "Sembako", description: "Kebutuhan pokok", created_at: new Date().toISOString() },
    { category_id: "cat-2", category_name: "Minuman", description: "Minuman kemasan", created_at: new Date().toISOString() },
    { category_id: "cat-3", category_name: "Makanan", description: "Makanan dan snack", created_at: new Date().toISOString() },
    { category_id: "cat-4", category_name: "Kebersihan", description: "Produk kebersihan", created_at: new Date().toISOString() }
  ],
  products: [
    { product_id:"prd-1", category_id:"cat-1", product_code:"BRG001", product_name:"Beras Premium 5 Kg", unit:"pcs", purchase_price:65000, selling_price:75000, stock:20, minimum_stock:5, is_active:true },
    { product_id:"prd-2", category_id:"cat-1", product_code:"BRG002", product_name:"Minyak Goreng 1 Liter", unit:"pcs", purchase_price:15000, selling_price:18000, stock:35, minimum_stock:10, is_active:true },
    { product_id:"prd-3", category_id:"cat-1", product_code:"BRG003", product_name:"Gula Pasir 1 Kg", unit:"kg", purchase_price:15000, selling_price:17000, stock:50, minimum_stock:10, is_active:true },
    { product_id:"prd-4", category_id:"cat-2", product_code:"BRG004", product_name:"Teh Celup 25 Kantong", unit:"box", purchase_price:6000, selling_price:8500, stock:25, minimum_stock:5, is_active:true },
    { product_id:"prd-5", category_id:"cat-2", product_code:"BRG005", product_name:"Air Mineral 600 ml", unit:"botol", purchase_price:2500, selling_price:3500, stock:60, minimum_stock:15, is_active:true },
    { product_id:"prd-6", category_id:"cat-3", product_code:"BRG006", product_name:"Mie Instan Goreng", unit:"pcs", purchase_price:2500, selling_price:3500, stock:100, minimum_stock:20, is_active:true },
    { product_id:"prd-7", category_id:"cat-4", product_code:"BRG007", product_name:"Sabun Cuci Piring 800 ml", unit:"botol", purchase_price:12000, selling_price:15000, stock:15, minimum_stock:5, is_active:true }
  ],
  sales: [],
  stock_movements: []
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    mode = window.RETAILPRO_CONFIG?.SUPABASE_CONFIGURED && supabaseClient ? "SUPABASE" : "LOCAL";
    setText("userEmail", mode === "SUPABASE" ? "Supabase Mode" : "Demo Lokal");
    setText("todayText", new Date().toLocaleDateString("id-ID", { weekday:"long", day:"2-digit", month:"long", year:"numeric" }));
    setText("modeBadge", mode === "SUPABASE" ? "SUPABASE" : "DEMO");
    setupNavigation();
    setupEvents();
    setDefaultReportDates();
    if (mode === "LOCAL") loadLocalData();
    else await loadSupabaseData();
    renderAll();
    await loadSalesHistory();
    await loadDashboard();
    await loadReport();
  } catch (err) {
    console.error(err);
    notify(normalizeError(err), true);
  }
}

function setText(id, value) { if ($(id)) $(id).textContent = value; }
function normalizeError(error) { return error?.message || error?.error_description || String(error) || "Terjadi kesalahan."; }

function setupNavigation() {
  document.querySelectorAll(".nav-item[data-section]").forEach(btn => btn.addEventListener("click", () => showSection(btn.dataset.section)));
  document.querySelectorAll("[data-section-link]").forEach(btn => btn.addEventListener("click", () => showSection(btn.dataset.sectionLink)));
}

function showSection(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item[data-section]").forEach(b => b.classList.remove("active"));
  $(id)?.classList.add("active");
  document.querySelector(`.nav-item[data-section="${id}"]`)?.classList.add("active");
  const titles = { dashboard:"Dashboard", products:"Produk", categories:"Kategori", sales:"Penjualan", inventory:"Persediaan", reports:"Laporan" };
  setText("pageTitle", titles[id] || "RetailPro");
}

function setupEvents() {
  $("logoutBtn")?.addEventListener("click", () => window.location.href = "login.html");
  $("addProductBtn")?.addEventListener("click", () => openProductDialog());
  $("productForm")?.addEventListener("submit", saveProduct);
  $("productSearch")?.addEventListener("input", renderProducts);
  $("productCategoryFilter")?.addEventListener("change", renderProducts);
  $("addCategoryBtn")?.addEventListener("click", () => openCategoryDialog());
  $("categoryForm")?.addEventListener("submit", saveCategory);
  $("saleProductSearch")?.addEventListener("input", renderSaleProductOptions);
  $("saleProductSearch")?.addEventListener("keydown", event => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      $("saleProductResults")?.querySelector("[data-sale-product-id]")?.focus();
    } else if (event.key === "Enter" && $("saleProductResults")?.querySelector("[data-sale-product-id]")) {
      event.preventDefault();
      chooseSaleProduct($("saleProductResults").querySelector("[data-sale-product-id]").dataset.saleProductId);
    }
  });
  $("saleProductResults")?.addEventListener("click", event => {
    const option = event.target.closest("[data-sale-product-id]");
    if (option) chooseSaleProduct(option.dataset.saleProductId);
  });
  $("saleProductSelect")?.addEventListener("change", showSelectedSaleProduct);
  $("addToCartBtn")?.addEventListener("click", addToCart);
  $("clearCartBtn")?.addEventListener("click", () => { cart = []; renderCart(); });
  $("paidAmount")?.addEventListener("input", updateChange);
  $("checkoutBtn")?.addEventListener("click", checkout);
  $("stockForm")?.addEventListener("submit", saveStock);
  $("loadReportBtn")?.addEventListener("click", loadReport);
  $("reportType")?.addEventListener("change", loadReport);
  document.querySelectorAll("[data-export]").forEach(button => button.addEventListener("click", () => exportExcel(button.dataset.export)));
  document.querySelectorAll("[data-print]").forEach(button => button.addEventListener("click", () => window.print()));
  $("printLastReceiptBtn")?.addEventListener("click", () => printReceipt(lastReceiptSaleId));
  document.querySelectorAll("[data-close-dialog]").forEach(b => b.addEventListener("click", () => closeDialog(b.dataset.closeDialog)));
}

function getFilteredProducts() {
  const q = ($("productSearch")?.value || "").toLowerCase().trim();
  const cat = $("productCategoryFilter")?.value || "";
  return products.filter(p => (!q || `${p.product_code} ${p.product_name}`.toLowerCase().includes(q)) && (!cat || p.category_id === cat));
}

function closeDialog(id) { const d = $(id); if (d?.open) d.close(); }

function loadLocalData() {
  const saved = localStorage.getItem(LOCAL_KEY);
  if (saved) {
    try { const d = JSON.parse(saved); categories = d.categories || []; products = d.products || []; window.localSales = d.sales || []; window.localMovements = d.stock_movements || []; return; } catch { localStorage.removeItem(LOCAL_KEY); }
  }
  categories = structuredClone(demoData.categories);
  products = structuredClone(demoData.products);
  window.localSales = [];
  window.localMovements = [];
  persistLocal();
}
function persistLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ categories, products, sales: window.localSales || [], stock_movements: window.localMovements || [] }));
}

async function loadSupabaseData() {
  const [c, p] = await Promise.all([
    supabaseClient.from("categories").select("*").order("category_name"),
    supabaseClient.from("products").select("*, categories(category_name)").order("product_name")
  ]);
  if (c.error) throw c.error;
  if (p.error) throw p.error;
  categories = c.data || [];
  products = p.data || [];
}

function renderAll() {
  fillCategorySelects();
  renderCategories();
  renderProducts();
  renderInventory();
  renderSaleProductOptions();
  renderCart();
}

function categoryName(id) { return categories.find(c => c.category_id === id)?.category_name || "-"; }
function stockBadge(p) {
  if (Number(p.stock) <= 0) return '<span class="badge out">HABIS</span>';
  if (Number(p.stock) <= Number(p.minimum_stock)) return '<span class="badge low">MENIPIS</span>';
  return '<span class="badge safe">AMAN</span>';
}
function fillCategorySelects() {
  const opts = categories.map(c => `<option value="${esc(c.category_id)}">${esc(c.category_name)}</option>`).join("");
  if ($("productCategory")) $("productCategory").innerHTML = `<option value="">Pilih kategori</option>${opts}`;
  if ($("productCategoryFilter")) $("productCategoryFilter").innerHTML = `<option value="">Semua kategori</option>${opts}`;
}

function renderProducts() {
  const rows = getFilteredProducts();
  $("productsBody").innerHTML = rows.length ? rows.map(p => `<tr class="${p.is_active === false ? "product-inactive" : ""}"><td>${esc(p.product_code)}</td><td>${esc(p.product_name)}</td><td>${esc(p.categories?.category_name || categoryName(p.category_id))}</td><td>${esc(p.unit)}</td><td>${rupiah(p.purchase_price)}</td><td>${rupiah(p.selling_price)}</td><td>${qtyFormat(p.stock)}</td><td><div class="action-group"><button class="btn secondary" onclick="editProduct('${p.product_id}')">Edit</button><button class="btn ${p.is_active === false ? "secondary" : "danger"}" onclick="deleteProduct('${p.product_id}')">${p.is_active === false ? "Aktifkan" : "Hapus"}</button></div></td></tr>`).join("") : emptyRow(8, "Belum ada produk.");
}

function renderInventory() {
  const activeProducts = products.filter(product => product.is_active !== false);
  $("inventoryBody").innerHTML = activeProducts.length ? activeProducts.map(p => `<tr><td>${esc(p.product_code)}</td><td>${esc(p.product_name)}</td><td>${esc(p.categories?.category_name || categoryName(p.category_id))}</td><td>${qtyFormat(p.stock)}</td><td>${qtyFormat(p.minimum_stock)}</td><td>${stockBadge(p)}</td><td><button class="btn primary" onclick="openStockDialog('${p.product_id}')">+ Stok</button></td></tr>`).join("") : emptyRow(7, "Belum ada data.");
}

function openProductDialog(id = null) {
  $("productForm").reset(); $("productId").value = ""; $("productDialogTitle").textContent = id ? "Edit Produk" : "Tambah Produk"; $("productStock").disabled = !!id;
  if (id) { const p = products.find(x => x.product_id === id); if (!p) return; $("productId").value=p.product_id; $("productCategory").value=p.category_id; $("productCode").value=p.product_code; $("productName").value=p.product_name; $("productUnit").value=p.unit; $("purchasePrice").value=p.purchase_price; $("sellingPrice").value=p.selling_price; $("productStock").value=p.stock; $("minimumStock").value=p.minimum_stock; }
  $("productDialog").showModal();
}
window.editProduct = openProductDialog;

async function saveProduct(e) {
  e.preventDefault();
  const id = $("productId").value;
  const payload = { category_id:$("productCategory").value, product_code:$("productCode").value.trim(), product_name:$("productName").value.trim(), unit:$("productUnit").value.trim(), purchase_price:Number($("purchasePrice").value), selling_price:Number($("sellingPrice").value), minimum_stock:Number($("minimumStock").value) };
  const opening = Number($("productStock").value || 0);
  if (!payload.category_id || !payload.product_code || !payload.product_name || !payload.unit) return notify("Kategori, kode, nama, dan unit wajib diisi.", true);
  if (![payload.purchase_price,payload.selling_price,payload.minimum_stock,opening].every(n => Number.isFinite(n) && n >= 0)) return notify("Harga dan stok harus berupa angka valid.", true);
  try {
    if (mode === "LOCAL") {
      if (products.some(p => p.product_code.toLowerCase() === payload.product_code.toLowerCase() && p.product_id !== id)) throw new Error("Kode produk sudah digunakan.");
      if (id) Object.assign(products.find(p=>p.product_id===id), payload);
      else products.push({ ...payload, product_id:uid("prd"), stock:opening, is_active:true });
      persistLocal();
    } else {
      if (id) { const r = await supabaseClient.from("products").update(payload).eq("product_id", id); if (r.error) throw r.error; }
      else { const r = await supabaseClient.from("products").insert({...payload,stock:0,is_active:true}).select("product_id").single(); if (r.error) throw r.error; if (opening > 0) { const s=await supabaseClient.rpc("add_stock",{p_product_id:r.data.product_id,p_quantity:opening,p_movement_type:"OPENING",p_notes:"Stok awal produk"}); if(s.error) throw s.error; } }
    }
    closeDialog("productDialog"); notify(id ? "Produk berhasil diperbarui." : "Produk berhasil ditambahkan."); await refresh();
  } catch(err) { notify(normalizeError(err), true); }
}

window.deleteProduct = async (id) => {
  const product = products.find(item => item.product_id === id);
  if (!product) return;
  const isActive = product.is_active !== false;
  const prompt = isActive
    ? `Hapus produk "${product.product_name}"? Jika memiliki riwayat transaksi atau stok, produk akan dinonaktifkan agar riwayat tetap tersimpan.`
    : `Aktifkan kembali produk "${product.product_name}"?`;
  if (!confirm(prompt)) return;

  try {
    if (!isActive) {
      if (mode === "LOCAL") product.is_active = true;
      else {
        const result = await supabaseClient.from("products").update({ is_active: true }).eq("product_id", id);
        if (result.error) throw result.error;
      }
      if (mode === "LOCAL") persistLocal();
      notify("Produk berhasil diaktifkan kembali.");
    } else if (mode === "LOCAL") {
      const hasSales = (window.localSales || []).some(sale => sale.items?.some(item => item.product_id === id));
      const hasMovements = (window.localMovements || []).some(movement => movement.product_id === id);
      if (hasSales || hasMovements) {
        product.is_active = false;
        notify("Produk memiliki riwayat dan telah dinonaktifkan.");
      } else {
        products = products.filter(item => item.product_id !== id);
        notify("Produk berhasil dihapus.");
      }
      persistLocal();
    } else {
      const result = await supabaseClient.from("products").delete().eq("product_id", id);
      if (result.error?.code === "23503") {
        const archive = await supabaseClient.from("products").update({ is_active: false }).eq("product_id", id);
        if (archive.error) throw archive.error;
        notify("Produk memiliki riwayat dan telah dinonaktifkan.");
      } else if (result.error) {
        throw result.error;
      } else {
        notify("Produk berhasil dihapus.");
      }
    }
    await refresh();
  } catch (error) {
    notify(normalizeError(error), true);
  }
};

function renderCategories() {
  $("categoriesBody").innerHTML = categories.length ? categories.map(c=>`<tr><td>${esc(c.category_name)}</td><td>${esc(c.description||"-")}</td><td>${formatDate(c.created_at)}</td><td><div class="action-group"><button class="btn secondary" onclick="editCategory('${c.category_id}')">Edit</button><button class="btn danger" onclick="deleteCategory('${c.category_id}')">Hapus</button></div></td></tr>`).join("") : emptyRow(4,"Belum ada kategori.");
}

async function loadSalesHistory() {
  if (mode === "LOCAL") {
    salesHistory = (window.localSales || []).slice().sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date));
  } else {
    const result = await supabaseClient.from("sales").select("*").order("sale_date", { ascending: false });
    if (result.error) throw result.error;
    salesHistory = await attachSaleItems(result.data || []);
  }
  renderSalesHistory();
}

async function attachSaleItems(sales) {
  if (!sales.length) return [];
  if (mode === "LOCAL") return sales.map(sale => ({ ...sale, items: sale.items || [] }));
  const result = await supabaseClient.from("sale_items").select("sale_id, product_id, quantity, selling_price, subtotal").in("sale_id", sales.map(sale => sale.sale_id));
  if (result.error) throw result.error;
  const itemsBySale = new Map();
  (result.data || []).forEach(item => {
    const product = products.find(p => p.product_id === item.product_id);
    const items = itemsBySale.get(item.sale_id) || [];
    items.push({ ...item, product_name: product?.product_name || "-", unit: product?.unit || "" });
    itemsBySale.set(item.sale_id, items);
  });
  return sales.map(sale => ({ ...sale, items: itemsBySale.get(sale.sale_id) || [] }));
}

function renderSalesHistory() {
  const rows = [];
  salesHistory.forEach(sale => {
    const items = sale.items?.length ? sale.items : [{ product_name: "-", quantity: 0, selling_price: 0, subtotal: Number(sale.total_amount || 0), unit: "" }];
    items.forEach(item => rows.push(`<tr><td>${esc(sale.invoice_no)}</td><td>${formatDate(sale.sale_date)}</td><td>${esc(item.product_name)}</td><td>${qtyFormat(item.quantity)} ${esc(item.unit || "")}</td><td>${rupiah(item.selling_price)}</td><td>${rupiah(item.subtotal ?? Number(item.quantity || 0) * Number(item.selling_price || 0))}</td><td>${rupiah(sale.total_amount)}</td><td><button class="btn secondary" onclick="printReceipt('${esc(sale.sale_id)}')">Cetak Struk</button></td></tr>`));
  });
  $("salesHistoryBody").innerHTML = rows.length ? rows.join("") : emptyRow(8, "Belum ada transaksi.");
}
function openCategoryDialog(id=null) {
  $("categoryForm").reset(); $("categoryId").value=""; $("categoryDialogTitle").textContent=id?"Edit Kategori":"Tambah Kategori";
  if(id){const c=categories.find(x=>x.category_id===id); if(!c)return; $("categoryId").value=c.category_id;$("categoryName").value=c.category_name;$("categoryDescription").value=c.description||"";}
  $("categoryDialog").showModal();
}
window.editCategory=openCategoryDialog;
async function saveCategory(e){
  e.preventDefault(); const id=$("categoryId").value; const name=$("categoryName").value.trim(); const description=$("categoryDescription").value.trim(); if(!name)return notify("Nama kategori wajib diisi.",true);
  try{
    if(categories.some(c=>c.category_name.toLowerCase()===name.toLowerCase()&&c.category_id!==id))throw new Error("Nama kategori sudah digunakan.");
    if(mode==="LOCAL"){if(id)Object.assign(categories.find(c=>c.category_id===id),{category_name:name,description});else categories.push({category_id:uid("cat"),category_name:name,description,created_at:new Date().toISOString()});persistLocal();}
    else {const r=id?await supabaseClient.from("categories").update({category_name:name,description}).eq("category_id",id):await supabaseClient.from("categories").insert({category_name:name,description});if(r.error)throw r.error;}
    closeDialog("categoryDialog");notify(id?"Kategori berhasil diperbarui.":"Kategori berhasil ditambahkan.");await refresh();
  }catch(err){notify(normalizeError(err),true);}
}
window.deleteCategory=async(id)=>{const c=categories.find(x=>x.category_id===id);if(!c||!confirm(`Hapus kategori "${c.category_name}"?`))return;try{if(mode==="LOCAL"){if(products.some(p=>p.category_id===id))throw new Error("Kategori masih digunakan oleh produk.");categories=categories.filter(x=>x.category_id!==id);persistLocal();}else{const r=await supabaseClient.from("categories").delete().eq("category_id",id);if(r.error)throw r.error;}notify("Kategori berhasil dihapus.");await refresh();}catch(err){notify(normalizeError(err),true);}};

function renderSaleProductOptions() {
  const query = ($("saleProductSearch")?.value || "").toLowerCase().trim();
  const rows = products.filter(product => product.is_active !== false && (!query || `${product.product_code} ${product.product_name}`.toLowerCase().includes(query)));
  $("saleProductSelect").innerHTML = `<option value="">Pilih produk</option>${rows.map(product => `<option value="${esc(product.product_id)}">${esc(product.product_code)} - ${esc(product.product_name)} (stok ${qtyFormat(product.stock)})</option>`).join("")}`;
  const results = $("saleProductResults");
  results.hidden = !query;
  results.innerHTML = query ? rows.length
    ? rows.map(product => `<button type="button" class="sale-product-option" role="option" data-sale-product-id="${esc(product.product_id)}"><strong>${esc(product.product_code)} - ${esc(product.product_name)}</strong><span>Stok ${qtyFormat(product.stock)} ${esc(product.unit)}</span></button>`).join("")
    : '<div class="sale-product-empty">Produk tidak ditemukan.</div>' : "";
  showSelectedSaleProduct();
}

function chooseSaleProduct(productId) {
  $("saleProductSearch").value = "";
  renderSaleProductOptions();
  $("saleProductSelect").value = productId;
  showSelectedSaleProduct();
}
function showSelectedSaleProduct(){const p=products.find(x=>x.product_id===$('saleProductSelect').value);$('saleProductInfo').innerHTML=p?`<strong>${esc(p.product_name)}</strong><span>Harga: ${rupiah(p.selling_price)} / ${esc(p.unit)} · Stok: ${qtyFormat(p.stock)}</span>`:'';}
function addToCart(){const id=$('saleProductSelect').value,q=Number($('saleQty').value),p=products.find(x=>x.product_id===id);if(!p)return notify('Pilih produk terlebih dahulu.',true);if(!Number.isFinite(q)||q<=0)return notify('Quantity harus lebih dari 0.',true);if(p.stock<=0)return notify('Stok produk habis.',true);const old=cart.find(x=>x.product_id===id),newQty=(old?.quantity||0)+q;if(newQty>Number(p.stock))return notify(`Stok ${p.product_name} tidak mencukupi.`,true);if(old)old.quantity=newQty;else cart.push({product_id:p.product_id,product_name:p.product_name,unit:p.unit,selling_price:Number(p.selling_price),quantity:q});$('saleQty').value=1;renderCart();}
function renderCart(){const body=$('cartBody');body.innerHTML=cart.length?cart.map((x,i)=>`<tr><td>${esc(x.product_name)}</td><td>${qtyFormat(x.quantity)} ${esc(x.unit)}</td><td>${rupiah(x.selling_price)}</td><td>${rupiah(x.quantity*x.selling_price)}</td><td><button class="btn danger" onclick="removeCartItem(${i})">×</button></td></tr>`).join(''):emptyRow(5,'Keranjang kosong.');const total=cart.reduce((s,x)=>s+x.quantity*x.selling_price,0);setText('cartTotal',rupiah(total));updateChange();}
window.removeCartItem=i=>{if(i>=0&&i<cart.length)cart.splice(i,1);renderCart();};
function updateChange(){const total=cart.reduce((s,x)=>s+x.quantity*x.selling_price,0),paid=Number($('paidAmount').value||0);setText('changeAmount',rupiah(Math.max(0,paid-total)));}

async function checkout() {
  if (busy) return;
  if (!cart.length) return notify("Keranjang masih kosong.", true);
  const items = cart.map(item => ({ ...item, subtotal: item.quantity * item.selling_price }));
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  const paid = Number($("paidAmount").value || 0);
  if (!Number.isFinite(paid) || paid < total) return notify(`Pembayaran kurang ${rupiah(total - paid)}.`, true);
  busy = true;
  $("checkoutBtn").disabled = true;
  $("checkoutBtn").textContent = "Menyimpan...";
  try {
    let savedSale;
    if (mode === "LOCAL") {
      for (const item of items) {
        const product = products.find(p => p.product_id === item.product_id);
        if (!product || product.stock < item.quantity) throw new Error(`Stok ${item.product_name} tidak mencukupi.`);
      }
      savedSale = { sale_id: uid("sale"), invoice_no: `INV-DEMO-${Date.now()}`, sale_date: new Date().toISOString(), payment_method: $("paymentMethod").value, total_amount: total, paid_amount: paid, change_amount: paid - total, items };
      window.localSales.push(savedSale);
      for (const item of items) {
        const product = products.find(p => p.product_id === item.product_id);
        product.stock -= item.quantity;
        window.localMovements.push({ movement_id: uid("mov"), product_id: product.product_id, movement_type: "OUT", quantity: item.quantity, reference_no: savedSale.invoice_no, created_at: new Date().toISOString() });
      }
      persistLocal();
    } else {
      const result = await supabaseClient.rpc("create_sale", { p_payment_method: $("paymentMethod").value, p_paid_amount: paid, p_items: items.map(item => ({ product_id: item.product_id, quantity: item.quantity })) });
      if (result.error) throw result.error;
      savedSale = { ...result.data, items };
    }
    lastReceiptSaleId = savedSale.sale_id;
    $("printLastReceiptBtn").hidden = false;
    notify(`Transaksi ${savedSale.invoice_no} berhasil disimpan.`);
    cart = [];
    $("paidAmount").value = 0;
    renderCart();
    await refresh();
    await loadDashboard();
    await loadReport();
  } catch (err) {
    notify(normalizeError(err), true);
  } finally {
    busy = false;
    $("checkoutBtn").disabled = false;
    $("checkoutBtn").textContent = "Simpan Transaksi";
  }
}

function openStockDialog(id){const p=products.find(x=>x.product_id===id);if(!p)return;$('stockProductId').value=id;$('stockProductName').textContent=`${p.product_code} - ${p.product_name}. Stok saat ini: ${qtyFormat(p.stock)} ${p.unit}`;$('stockQuantity').value='';$('stockNotes').value='';$('stockDialog').showModal();}window.openStockDialog=openStockDialog;
async function saveStock(e){e.preventDefault();const id=$('stockProductId').value,q=Number($('stockQuantity').value);if(!Number.isFinite(q)||q<=0)return notify('Jumlah stok harus lebih dari 0.',true);try{if(mode==='LOCAL'){const p=products.find(x=>x.product_id===id);if(!p)throw new Error('Produk tidak ditemukan.');p.stock+=q;window.localMovements.push({movement_id:uid('mov'),product_id:id,movement_type:'IN',quantity:q,notes:$('stockNotes').value.trim(),created_at:new Date().toISOString()});persistLocal();}else{const r=await supabaseClient.rpc('add_stock',{p_product_id:id,p_quantity:q,p_movement_type:'IN',p_notes:$('stockNotes').value.trim()||'Penambahan stok'});if(r.error)throw r.error;}closeDialog('stockDialog');notify('Stok berhasil ditambahkan.');await refresh();await loadDashboard();}catch(err){notify(normalizeError(err),true);}}

async function refresh(){if(mode==='LOCAL')loadLocalData();else await loadSupabaseData();renderAll();await loadSalesHistory();}

async function loadDashboard(){setText('statProducts',products.length);setText('statStock',qtyFormat(products.reduce((s,p)=>s+Number(p.stock||0),0)));let sales=[];if(mode==='LOCAL')sales=window.localSales||[];else{const d=new Date();d.setHours(0,0,0,0);const t=new Date(d);t.setDate(t.getDate()+1);const r=await supabaseClient.from('sales').select('*').gte('sale_date',d.toISOString()).lt('sale_date',t.toISOString()).order('sale_date',{ascending:false});if(r.error){notify(normalizeError(r.error),true);return;}sales=r.data||[];}setText('statSales',rupiah(sales.reduce((s,x)=>s+Number(x.total_amount||0),0)));setText('statTransactions',sales.length);const low=products.filter(p=>Number(p.stock)<=Number(p.minimum_stock)).slice(0,8);$('lowStockBody').innerHTML=low.length?low.map(p=>`<tr><td>${esc(p.product_code)}</td><td>${esc(p.product_name)}</td><td>${qtyFormat(p.stock)}</td><td>${stockBadge(p)}</td></tr>`).join(''):emptyRow(4,'Tidak ada stok menipis.');$('recentSalesBody').innerHTML=sales.length?sales.slice(0,8).map(s=>`<tr><td>${esc(s.invoice_no)}</td><td>${formatDate(s.sale_date)}</td><td>${rupiah(s.total_amount)}</td></tr>`).join(''):emptyRow(3,'Belum ada transaksi.');}

function setDefaultReportDates(){const end=new Date(),start=new Date();start.setDate(start.getDate()-6);$('reportStart').value=dateInput(start);$('reportEnd').value=dateInput(end);}
async function loadReport() {
  const start = $("reportStart").value;
  const end = $("reportEnd").value;
  if (!start || !end) return;
  if (start > end) return notify("Tanggal awal tidak boleh setelah tanggal akhir.", true);
  const type = $("reportType").value;
  const from = new Date(`${start}T00:00:00`);
  const until = new Date(`${end}T00:00:00`);
  until.setDate(until.getDate() + 1);
  setText("reportPrintTitle", type === "sales" ? "Laporan Penjualan" : "Laporan Persediaan");
  document.querySelector("#reports .section-toolbar h2").textContent = type === "sales" ? "Laporan Penjualan" : "Laporan Persediaan";
  setText("reportPrintPeriod", `Periode: ${dateLabel(start)} s/d ${dateLabel(end)}`);
  $("reportPrintHeading").hidden = false;

  if (type === "sales") {
    let sales;
    if (mode === "LOCAL") {
      sales = (window.localSales || []).filter(sale => new Date(sale.sale_date) >= from && new Date(sale.sale_date) < until).sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date));
      sales = await attachSaleItems(sales);
    } else {
      const result = await supabaseClient.from("sales").select("*").gte("sale_date", from.toISOString()).lt("sale_date", until.toISOString()).order("sale_date", { ascending: false });
      if (result.error) return notify(normalizeError(result.error), true);
      sales = await attachSaleItems(result.data || []);
    }
    reportRows = [];
    let number = 0;
    sales.forEach(sale => {
      const items = sale.items?.length ? sale.items : [{ product_name: "-", quantity: 0, selling_price: 0, subtotal: Number(sale.total_amount || 0) }];
      items.forEach(item => reportRows.push({ number: ++number, invoice: sale.invoice_no, date: formatDate(sale.sale_date), product: item.product_name || "-", quantity: Number(item.quantity || 0), price: Number(item.selling_price || 0), total: Number(item.subtotal ?? Number(item.quantity || 0) * Number(item.selling_price || 0)) }));
    });
    $("reportsHead").innerHTML = "<tr><th>No</th><th>Invoice</th><th>Tanggal</th><th>Produk</th><th>Qty</th><th>Harga</th><th>Total</th></tr>";
    $("reportsBody").innerHTML = reportRows.length ? reportRows.map(row => `<tr><td>${row.number}</td><td>${esc(row.invoice)}</td><td>${esc(row.date)}</td><td>${esc(row.product)}</td><td>${qtyFormat(row.quantity)}</td><td>${rupiah(row.price)}</td><td>${rupiah(row.total)}</td></tr>`).join("") : emptyRow(7, "Tidak ada transaksi pada periode tersebut.");
    setText("reportCount", sales.length);
    setText("reportTotal", rupiah(sales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0)));
  } else {
    let movements;
    if (mode === "LOCAL") {
      movements = (window.localMovements || []).filter(movement => new Date(movement.created_at) >= from && new Date(movement.created_at) < until).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else {
      const result = await supabaseClient.from("stock_movements").select("*").gte("created_at", from.toISOString()).lt("created_at", until.toISOString()).order("created_at", { ascending: false });
      if (result.error) return notify(normalizeError(result.error), true);
      movements = result.data || [];
    }
    reportRows = movements.map(movement => ({ date: formatDate(movement.created_at), product: products.find(product => product.product_id === movement.product_id)?.product_name || "-", type: movement.movement_type, quantity: Number(movement.quantity), notes: movement.notes || movement.reference_no || "-" }));
    $("reportsHead").innerHTML = "<tr><th>Tanggal</th><th>Produk</th><th>Jenis Transaksi</th><th>Jumlah</th><th>Keterangan</th></tr>";
    $("reportsBody").innerHTML = reportRows.length ? reportRows.map(row => `<tr><td>${esc(row.date)}</td><td>${esc(row.product)}</td><td>${esc(row.type)}</td><td>${qtyFormat(row.quantity)}</td><td>${esc(row.notes)}</td></tr>`).join("") : emptyRow(5, "Tidak ada mutasi pada periode tersebut.");
    setText("reportCount", movements.length);
    setText("reportTotal", `${qtyFormat(movements.reduce((sum, movement) => sum + Number(movement.quantity || 0), 0))} unit`);
  }
  document.querySelector("#reports .report-summary span:first-child").firstChild.textContent = type === "sales" ? "Total transaksi: " : "Total mutasi: ";
  document.querySelector("#reports .report-summary span:last-child").firstChild.textContent = type === "sales" ? "Total penjualan: " : "Total jumlah: ";
}

function exportExcel(page) {
  if (!window.XLSX) return notify("Library Excel belum berhasil dimuat. Periksa koneksi internet.", true);
  let headers;
  let rows;
  if (page === "products") {
    headers = ["Kode Produk", "Nama Produk", "Kategori", "Harga Beli", "Harga Jual", "Stok", "Stok Minimum"];
    rows = getFilteredProducts().map(product => [product.product_code, product.product_name, product.categories?.category_name || categoryName(product.category_id), Number(product.purchase_price), Number(product.selling_price), Number(product.stock), Number(product.minimum_stock)]);
  } else if (page === "categories") {
    headers = ["Nama Kategori", "Deskripsi", "Dibuat"];
    rows = categories.map(category => [category.category_name, category.description || "", category.created_at ? new Date(category.created_at).toLocaleDateString("id-ID") : ""]);
  } else if (page === "sales") {
    headers = ["No Invoice", "Tanggal", "Produk", "Qty", "Harga", "Subtotal", "Total"];
    rows = salesHistory.flatMap(sale => (sale.items?.length ? sale.items : [{ product_name: "-", quantity: 0, selling_price: 0, subtotal: Number(sale.total_amount || 0) }]).map(item => [sale.invoice_no, formatDate(sale.sale_date), item.product_name || "-", Number(item.quantity || 0), Number(item.selling_price || 0), Number(item.subtotal ?? Number(item.quantity || 0) * Number(item.selling_price || 0)), Number(sale.total_amount || 0)]));
  } else if (page === "inventory") {
    headers = ["Kode Produk", "Produk", "Kategori", "Stok", "Stok Minimum", "Status"];
    rows = products.filter(product => product.is_active !== false).map(product => [product.product_code, product.product_name, product.categories?.category_name || categoryName(product.category_id), Number(product.stock), Number(product.minimum_stock), Number(product.stock) <= 0 ? "HABIS" : Number(product.stock) <= Number(product.minimum_stock) ? "MENIPIS" : "AMAN"]);
  } else {
    if ($("reportType").value === "sales") {
      headers = ["No", "Invoice", "Tanggal", "Produk", "Qty", "Harga", "Total"];
      rows = reportRows.map(row => [row.number, row.invoice, row.date, row.product, row.quantity, row.price, row.total]);
    } else {
      headers = ["Tanggal", "Produk", "Jenis Transaksi", "Jumlah", "Keterangan"];
      rows = reportRows.map(row => [row.date, row.product, row.type, row.quantity, row.notes]);
    }
  }
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet["!cols"] = headers.map(header => ({ wch: Math.max(header.length + 2, 16) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  const labels = { products: "Produk", categories: "Kategori", sales: "Penjualan", inventory: "Persediaan", reports: "Laporan" };
  XLSX.writeFile(workbook, `RetailPro_${labels[page]}_${dateInput(new Date())}.xlsx`);
}

function printReceipt(saleId) {
  const sale = salesHistory.find(item => item.sale_id === saleId) || (window.localSales || []).find(item => item.sale_id === saleId);
  if (!sale) return notify("Data transaksi tidak ditemukan untuk dicetak.", true);
  const items = sale.items || [];
  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal ?? Number(item.quantity || 0) * Number(item.selling_price || 0)), 0);
  const discount = Number(sale.discount_amount || 0);
  $("receiptPrint").innerHTML = `<div class="receipt-brand">RETAILPRO</div><div class="receipt-subtitle">Sistem Penjualan &amp; Persediaan</div><div class="receipt-meta"><div>No Invoice: ${esc(sale.invoice_no)}</div><div>Tanggal: ${esc(formatDate(sale.sale_date))}</div></div><table><thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Total</th></tr></thead><tbody>${items.map(item => `<tr><td>${esc(item.product_name || "-")}</td><td>${qtyFormat(item.quantity)}</td><td>${rupiah(item.selling_price)}</td><td>${rupiah(item.subtotal ?? Number(item.quantity || 0) * Number(item.selling_price || 0))}</td></tr>`).join("")}</tbody></table><div class="receipt-totals"><div><span>Subtotal:</span><span>${rupiah(subtotal)}</span></div>${discount > 0 ? `<div><span>Diskon:</span><span>${rupiah(discount)}</span></div>` : ""}<div class="receipt-grand-total"><span>Total:</span><span>${rupiah(sale.total_amount)}</span></div></div><div class="receipt-thanks">Terima kasih.</div>`;
  document.body.classList.add("print-receipt");
  window.print();
}
window.printReceipt = printReceipt;
window.addEventListener("afterprint", () => document.body.classList.remove("print-receipt"));

function notify(message,error=false){const el=$('toast');if(!el)return;el.textContent=message;el.className='toast show'+(error?' error':'');clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.className='toast',4000);}
function formatDate(v){return v?new Date(v).toLocaleString('id-ID',{dateStyle:'short',timeStyle:'short'}):'-';}
function dateLabel(value){const [year,month,day]=value.split('-');return `${day}-${month}-${year}`;}
function dateInput(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function emptyRow(cols,text){return `<tr><td colspan="${cols}" class="muted">${esc(text)}</td></tr>`;}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function uid(prefix){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}
