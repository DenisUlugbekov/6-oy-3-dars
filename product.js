const USD_TO_UZS = 12500; // taxminiy kurs, o'zingiz o'zgartirishingiz mumkin

const $ = (id) => document.getElementById(id);
const productsEl = $("products");
const searchEl = $("search");
const overlay = $("overlay");
const cartEl = $("cart");
const modalEl = $("modal");

let products = [];
let cart = JSON.parse(localStorage.getItem("cart_v2") || "[]");
let favs = JSON.parse(localStorage.getItem("favs_v2") || "[]");
let onlyFavs = false;
let plain = localStorage.getItem("view_v2") !== "uzum"; // standart: rasmdagidek oddiy ko'rinish

/* ---------- Yordamchi funksiyalar ---------- */
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const money = (n) => Math.round(n).toLocaleString("ru-RU") + " so'm";

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ---------- Ma'lumotlarni yuklash (2 ta manba) ---------- */
async function getProducts() {
  productsEl.innerHTML = '<div class="empty">Yuklanmoqda...</div>';

  const [fake, dummy] = await Promise.allSettled([
    fetch("https://fakestoreapi.com/products").then((r) => r.json()),
    fetch("https://dummyjson.com/products?limit=100").then((r) => r.json()),
  ]);

  const list = [];

  if (fake.status === "fulfilled" && Array.isArray(fake.value)) {
    fake.value.forEach((p) =>
      list.push({
        id: "f" + p.id,
        title: p.title,
        description: p.description,
        category: p.category,
        brand: "",
        image: p.image,
        usd: p.price,
        discount: 0,
        rating: p.rating?.rate ?? 0,
        reviews: p.rating?.count ?? 0,
        stock: null,
      })
    );
  }

  if (dummy.status === "fulfilled" && dummy.value.products) {
    dummy.value.products.forEach((p) =>
      list.push({
        id: "d" + p.id,
        title: p.title,
        description: p.description,
        category: (p.category || "").replace(/-/g, " "),
        brand: p.brand || "",
        image: p.thumbnail,
        usd: p.price,
        discount: Math.round(p.discountPercentage || 0),
        rating: p.rating ?? 0,
        reviews: p.reviews ? p.reviews.length : 0,
        stock: p.stock ?? null,
      })
    );
  }

  if (list.length === 0) {
    productsEl.innerHTML = '<div class="empty">Mahsulotlarni yuklab bo\'lmadi. Internetni tekshiring.</div>';
    return;
  }

  // narxlarni so'mga o'tkazish
  products = list.map((p) => {
    const price = Math.round((p.usd * USD_TO_UZS) / 1000) * 1000;
    const oldPrice = p.discount > 0 ? Math.round(price / (1 - p.discount / 100) / 1000) * 1000 : 0;
    return { ...p, price, oldPrice };
  });

  render();
}

/* ---------- Chizish ---------- */
function currentList() {
  const q = searchEl.value.trim().toLowerCase();
  return products.filter((p) => {
    if (onlyFavs && !favs.includes(p.id)) return false;
    if (!q) return true;
    return p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });
}

function render() {
  productsEl.classList.toggle("plain", plain);
  $("viewBtn").innerHTML = plain
    ? '<i class="fa-solid fa-table-cells-large"></i> Uzum ko\'rinishi'
    : '<i class="fa-solid fa-list"></i> Oddiy ko\'rinish';
  const list = currentList();
  $("listTitle").textContent = onlyFavs ? "Sevimlilar" : "Barcha mahsulotlar";
  $("resultInfo").textContent = `${list.length} ta mahsulot`;

  if (list.length === 0) {
    productsEl.innerHTML = '<div class="empty">Hech narsa topilmadi</div>';
    return;
  }

  productsEl.innerHTML = list
    .map(
      (p) => `
        <article class="card" data-id="${p.id}">
          <div class="card-img" data-open>
            <img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy" />
            ${p.discount ? `<span class="disc">-${p.discount}%</span>` : ""}
            <button class="fav ${favs.includes(p.id) ? "on" : ""}" data-fav>
              <i class="${favs.includes(p.id) ? "fa-solid" : "fa-regular"} fa-heart"></i>
            </button>
          </div>
          <div class="card-body">
            <h3 data-open>${esc(p.title)}</h3>
            <p class="desc">${esc(p.description)}</p>
            <div class="meta">
              <span class="star"><i class="fa-solid fa-star"></i> ${Number(p.rating).toFixed(1)}</span>
              <span>(${p.reviews} ta sharh)</span>
            </div>
            <div class="cat">${esc(p.category)}${p.brand ? " · " + esc(p.brand) : ""}</div>
            <div class="installment">${money(p.price / 12)}/oy</div>
            <div class="prices">
              ${p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : ""}
              <b>${money(p.price)}</b>
            </div>
            <button class="buy-btn" data-buy><i class="fa-solid fa-cart-plus"></i> Sotib olish</button>
          </div>
        </article>`
    )
    .join("");
}

productsEl.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const id = card.dataset.id;

  if (e.target.closest("[data-fav]")) return toggleFav(id, e.target.closest("[data-fav]"));
  if (e.target.closest("[data-buy]")) return addToCart(id);
  if (e.target.closest("[data-open]")) return openModal(id);
});

/* ---------- Qidiruv ---------- */
searchEl.addEventListener("input", render);

$("viewBtn").addEventListener("click", () => {
  plain = !plain;
  localStorage.setItem("view_v2", plain ? "plain" : "uzum");
  render();
});

/* ---------- Sevimlilar ---------- */
function toggleFav(id, btn) {
  if (favs.includes(id)) favs = favs.filter((f) => f !== id);
  else favs.push(id);
  localStorage.setItem("favs_v2", JSON.stringify(favs));
  $("favCount").textContent = favs.length;

  if (onlyFavs) return render();
  const on = favs.includes(id);
  btn.classList.toggle("on", on);
  btn.firstElementChild.className = (on ? "fa-solid" : "fa-regular") + " fa-heart";
}

$("favBtn").addEventListener("click", () => {
  onlyFavs = !onlyFavs;
  $("favBtn").classList.toggle("active", onlyFavs);
  render();
});

/* ---------- Savat ---------- */
function saveCart() {
  localStorage.setItem("cart_v2", JSON.stringify(cart));
}

function addToCart(id) {
  const item = cart.find((c) => c.id === id);
  if (item) {
    item.qty++;
  } else {
    const p = products.find((p) => p.id === id);
    cart.push({ id: p.id, title: p.title, price: p.price, image: p.image, qty: 1 });
  }
  saveCart();
  renderCart();
  toast("Savatga qo'shildi ✓");
}

function changeQty(id, delta) {
  const item = cart.find((c) => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((c) => c.id !== id);
  saveCart();
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter((c) => c.id !== id);
  saveCart();
  renderCart();
}

function renderCart() {
  const count = cart.reduce((s, c) => s + c.qty, 0);
  const total = cart.reduce((s, c) => s + c.qty * c.price, 0);
  $("cartCount").textContent = count;
  $("cartTotal").textContent = money(total);

  if (cart.length === 0) {
    $("cartItems").innerHTML = '<p class="cart-empty">Savat bo\'sh</p>';
    return;
  }

  $("cartItems").innerHTML = cart
    .map(
      (c) => `
        <div class="cart-item">
          <div class="ci-img"><img src="${esc(c.image)}" alt="" /></div>
          <div class="ci-info">
            <h4>${esc(c.title)}</h4>
            <b>${money(c.price * c.qty)}</b>
            <div class="qty">
              <button onclick="changeQty('${c.id}', -1)">−</button>
              <b>${c.qty}</b>
              <button onclick="changeQty('${c.id}', 1)">+</button>
            </div>
          </div>
          <button class="remove" onclick="removeFromCart('${c.id}')"><i class="fa-regular fa-trash-can"></i></button>
        </div>`
    )
    .join("");
}

function openCart() {
  closeModal();
  cartEl.classList.add("open");
  overlay.classList.add("show");
}

function closeAll() {
  cartEl.classList.remove("open");
  modalEl.classList.remove("open");
  overlay.classList.remove("show");
}

$("cartBtn").addEventListener("click", openCart);
$("closeCart").addEventListener("click", closeAll);
overlay.addEventListener("click", closeAll);
document.addEventListener("keydown", (e) => e.key === "Escape" && closeAll());

$("clearCart").addEventListener("click", () => {
  cart = [];
  saveCart();
  renderCart();
});

$("orderBtn").addEventListener("click", () => {
  if (cart.length === 0) return toast("Savat bo'sh");
  cart = [];
  saveCart();
  renderCart();
  closeAll();
  toast("Buyurtma qabul qilindi! 🎉");
});

/* ---------- Mahsulot ma'lumoti ---------- */
function openModal(id) {
  const p = products.find((p) => p.id === id);
  if (!p) return;

  $("modalBody").innerHTML = `
        <div class="modal-img"><img src="${esc(p.image)}" alt="${esc(p.title)}" /></div>
        <div class="modal-info">
          <h2>${esc(p.title)}</h2>
          <div class="meta">
            <span class="star"><i class="fa-solid fa-star"></i> ${Number(p.rating).toFixed(1)}</span>
            <span>(${p.reviews} ta sharh)</span>
          </div>
          <div class="modal-price">
            ${p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : ""}<b>${money(p.price)}</b>
          </div>
          <div class="installment">${money(p.price / 12)}/oy · 12 oyga</div>
          <p>${esc(p.description)}</p>
          <div class="info-row"><span>Kategoriya</span><span>${esc(p.category)}</span></div>
          ${p.brand ? `<div class="info-row"><span>Brend</span><span>${esc(p.brand)}</span></div>` : ""}
          ${p.stock !== null ? `<div class="info-row"><span>Omborda</span><span>${p.stock} ta</span></div>` : ""}
          ${p.discount ? `<div class="info-row"><span>Chegirma</span><span>${p.discount}%</span></div>` : ""}
          <button class="order-btn" style="margin-top:16px" onclick="addToCart('${p.id}')">
            <i class="fa-solid fa-cart-plus"></i> Sotib olish
          </button>
        </div>`;

  cartEl.classList.remove("open");
  modalEl.classList.add("open");
  overlay.classList.add("show");
}

function closeModal() {
  modalEl.classList.remove("open");
}

$("closeModal").addEventListener("click", closeAll);

/* ---------- Boshlash ---------- */
$("favCount").textContent = favs.length;
renderCart();
getProducts();