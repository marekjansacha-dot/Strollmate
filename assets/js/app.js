// -------------------------------
// TERMINY W LOCALSTORAGE
// -------------------------------

document.addEventListener("click", (e) => {
  if (e.target.id === "apply-dates") {
    const start = document.getElementById("date-start").value;
    const end = document.getElementById("date-end").value;

    if (!start || !end) {
      alert("Wybierz obie daty.");
      return;
    }

    localStorage.setItem("startDate", start);
    localStorage.setItem("endDate", end);

    alert("Termin zapisany! Przenoszę do dostępnych produktów.");
    window.location.href = "produkty.html";
  }
});

// Pobranie terminu
function getDates() {
  return {
    start: localStorage.getItem("startDate"),
    end: localStorage.getItem("endDate")
  };
}

// -------------------------------
// AUTO-WYPEŁNIANIE DAT NA STRONIE PRODUKTÓW
// -------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const start = localStorage.getItem("startDate");
  const end = localStorage.getItem("endDate");

  const startInput = document.getElementById("date-start");
  const endInput = document.getElementById("date-end");

  if (start && startInput) startInput.value = start;
  if (end && endInput) endInput.value = end;
});

// -------------------------------
// AUTO-WYPEŁNIANIE DAT W FORMULARZU REZERWACJI
// -------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const start = localStorage.getItem("startDate");
  const end = localStorage.getItem("endDate");

  const startInput = document.querySelector("input[name='start']");
  const endInput = document.querySelector("input[name='end']");

  if (start && startInput) startInput.value = start;
  if (end && endInput) endInput.value = end;
});

// -------------------------------
// DOSTĘPNOŚĆ PRODUKTÓW
// -------------------------------

// lokalne blokady (na razie puste)
const availability = {
  wozek1: [],
  wozek2: [],
  fotelik1: [],
  fotelik2: [],
  lozeczko1: [],
  waga1: []
};

// blokady z panelu admina (Google Sheets)
let adminBlocks = [];

// 🔥 URL WEB APP Z APPS SCRIPT (availability_admin)
const ADMIN_AVAILABILITY_URL =
  "https://script.google.com/macros/s/AKfycbxIu0zR-s6ItV-y8Fbx2Ywwsusvjqn5hX7EyFLXtn4s8jySd0SwRZ-RB4oF2Nq4Vlag/exec";

async function fetchAdminAvailability() {
  try {
    const res = await fetch(ADMIN_AVAILABILITY_URL);
    const data = await res.json();
    adminBlocks = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Nie udało się pobrać blokad admina:", err);
    adminBlocks = [];
  }
}

function isAvailable(productId, start, end) {
  if (!start || !end) return true;

  const startDate = new Date(start);
  const endDate = new Date(end);

  const dayNames = {
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday"
  };

  for (const b of adminBlocks) {
    if (b.type === "weekday_start" && b.weekday) {
      if (b.product === "all" || b.product === productId) {
        const startName = dayNames[startDate.getDay()];
        if (startName === b.weekday) return false;
      }
    }
  }

  for (const b of adminBlocks) {
    if (b.type === "weekday_end" && b.weekday) {
      if (b.product === "all" || b.product === productId) {
        const endName = dayNames[endDate.getDay()];
        if (endName === b.weekday) return false;
      }
    }
  }

  for (const b of adminBlocks) {
    if (b.type === "range" && b.from && b.to) {
      if (b.product === "all" || b.product === productId) {
        const blockStart = new Date(b.from);
        const blockEnd = new Date(b.to);
        if (startDate <= blockEnd && endDate >= blockStart) return false;
      }
    }
  }

  const blocks = availability[productId] || [];

  const conflict = blocks.some(block => {
    const blockStart = new Date(block.from);
    const blockEnd = new Date(block.to);
    return (startDate <= blockEnd) && (endDate >= blockStart);
  });

  if (conflict) return false;

  return true;
}

// -------------------------------
// WYSZARZANIE + OVERLAY NIEDZIELNY
// -------------------------------

function applyAvailability() {
  const { start, end } = getDates();

  document.querySelectorAll(".mosaic-card").forEach(card => {
    const productId = card.dataset.product;
    const addBtn = card.querySelector(".add-to-cart");
    const img = card.querySelector(".product-image");

    const available = isAvailable(productId, start, end);

    if (img) {
      img.classList.remove("sunday-overlay");
      const oldOverlay = img.querySelector(".sunday-overlay-text");
      if (oldOverlay) oldOverlay.remove();
    }

    if (!available) {
      card.classList.add("unavailable");

      if (addBtn) {
        addBtn.textContent = "Niedostępny";
        addBtn.classList.add("disabled");
        addBtn.style.pointerEvents = "none";
      }

      const startDate = start ? new Date(start) : null;
      const endDate = end ? new Date(end) : null;

      const startDay = startDate ? startDate.getDay() : null;
      const endDay = endDate ? endDate.getDay() : null;

      const sundayStartBlocked = adminBlocks.some(b =>
        b.product === "all" &&
        b.type === "weekday_start" &&
        b.weekday === "Sunday"
      );

      const sundayEndBlocked = adminBlocks.some(b =>
        b.product === "all" &&
        b.type === "weekday_end" &&
        b.weekday === "Sunday"
      );

      const isSundayReason =
        (startDay === 0 && sundayStartBlocked) ||
        (endDay === 0 && sundayEndBlocked);

      if (isSundayReason && img) {
        img.classList.add("sunday-overlay");

        img.insertAdjacentHTML("beforeend", `
          <div class="sunday-overlay-text">
            W niedzielę nie realizujemy odbiorów ani dostaw sprzętu.<br>
            Prosimy o wybranie innego dnia.
          </div>
        `);
      }

    } else {
      card.classList.remove("unavailable");

      if (addBtn) {
        addBtn.textContent = "Dodaj do koszyka";
        addBtn.classList.remove("disabled");
        addBtn.style.pointerEvents = "auto";
      }
    }
  });
}

// -------------------------------
// DELIVERY AVAILABILITY — NOWY SYSTEM
// -------------------------------

let deliveryBlocks = [];

const DELIVERY_URL =
  "https://script.google.com/macros/s/AKfycbw88MA9RDV25l1uc3gLEjX5zx18-zKdUy9OPFr8O8GWviqCxyLi8I64Oif94HSPC5nj/exec";

async function fetchDeliveryAvailability() {
  try {
    const res = await fetch(DELIVERY_URL);
    const data = await res.json();
    deliveryBlocks = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Nie udało się pobrać blokad dostawy:", err);
    deliveryBlocks = [];
  }
}

function isDeliveryAvailable(option, start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const weekdayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  for (const b of deliveryBlocks) {

    if (b.delivery_option !== option) continue;

    if (b.type === "closed") return false;

    if (b.type === "weekday_block") {
      const startDay = weekdayNames[startDate.getDay()];
      const endDay = weekdayNames[endDate.getDay()];
      if (startDay === b.weekday || endDay === b.weekday) return false;
    }

    if (b.type === "range") {
      const blockStart = new Date(b.from);
      const blockEnd = new Date(b.to);
      if (startDate <= blockEnd && endDate >= blockStart) return false;
    }
  }

  return true;
}

// ⭐ SCALONY LISTENER — JEDEN OBSŁUGUJE WSZYSTKO
document.addEventListener("change", (e) => {
  if (e.target.id === "delivery-option") {
    const option = e.target.value;
    const { start, end } = getDates();

    // 🔥 1. Sprawdzenie dostępności dostawy
    if (!isDeliveryAvailable(option, start, end)) {
      alert("Ta opcja dostawy jest niedostępna w wybranym terminie.");
      e.target.value = "";
      return; // ważne — zatrzymuje dalsze działanie
    }

    // 🔥 2. Pokazywanie / ukrywanie pola adresu
    const addressField = document.getElementById("address-field");
    const addressInput = document.getElementById("address");

    if (option === "hotel" || option === "apartment") {
      addressField.classList.remove("hidden");
      addressInput.required = true;
    } else {
      addressField.classList.add("hidden");
      addressInput.required = false;
      addressInput.value = "";
    }
  }
});


// -------------------------------
// Koszyk trzyma tylko ID produktów
// -------------------------------

function getCart() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartTopbar();
  renderCartInForm();
}

// Dodawanie bez duplikatów
function addToCart(id, name, price) {
  const cart = getCart();

  if (cart.some(item => item.id === id)) {
    alert("Ten produkt jest już w koszyku.");
    return;
  }

  cart.push({ id, name, price });
  saveCart(cart);

  alert("Dodano do koszyka!");
}

// Usuwanie
function removeFromCart(id) {
  const cart = getCart().filter(item => item.id !== id);
  saveCart(cart);
}

// Liczenie dni
function countDays(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
}

// Suma w topbarze
function updateCartTopbar() {
  const cart = getCart();
  const { start, end } = getDates();

  const count = cart.length;
  const el = document.getElementById("cart-total");
  if (!el) return;

  if (!start || !end) {
    el.textContent = `(${count})`;
    return;
  }

  const days = countDays(start, end);
  const total = cart.reduce((sum, item) => sum + item.price * days, 0);

  el.textContent = `${total.toFixed(2)} zł (${count})`;
}

// Render koszyka w formularzu
function renderCartInForm() {
  const container = document.getElementById("cart-items");
  const totalEl = document.getElementById("cart-total-summary");
  const termEl = document.getElementById("cart-term-summary");

  if (!container || !totalEl) return;

  const cart = getCart();
  container.innerHTML = "";

  if (cart.length === 0) {
    container.innerHTML = `
      <p style="padding:12px; background:#fff; border-radius:10px; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
        Koszyk jest pusty.
      </p>
    `;
    totalEl.textContent = "0,00 zł";
    if (termEl) termEl.textContent = "";
    return;
  }

  const { start, end } = getDates();
  const days = countDays(start, end);

  let total = 0;

  cart.forEach((item) => {
    const itemTotal = item.price * days;
    total += itemTotal;

    const div = document.createElement("div");
    div.className = "cart-item-box";
    div.style = `
      padding: 12px;
      margin-bottom: 12px;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    `;

    div.innerHTML = `
      <h3 style="margin-bottom:6px;">${item.name}</h3>
      <p style="margin-bottom:10px;">${item.price * days} zł / okres</p>
      <p style="margin-bottom:10px; color:#555;">Łącznie: <strong>${itemTotal.toFixed(2)} zł</strong></p>
      <button 
        class="remove-from-cart"
        data-id="${item.id}"
        style="
          background:#d00000;
          color:#fff;
          border:none;
          padding:8px 14px;
          border-radius:6px;
          cursor:pointer;
        "
      >
        Usuń z koszyka
      </button>
    `;

    container.appendChild(div);
  });

  if (termEl) {
    termEl.textContent = `Termin wypożyczenia: ${start} → ${end} (${days} dni)`;
  }

  totalEl.textContent = `${total.toFixed(2)} zł`;
}

// Obsługa kliknięć
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("add-to-cart")) {
    const { start, end } = getDates();

    if (!start || !end) {
      alert("Najpierw wybierz termin wypożyczenia.");
      return;
    }

    const id = e.target.dataset.id;
    const name = e.target.dataset.name;
    const price = Number(e.target.dataset.price);

    addToCart(id, name, price);
  }

  if (e.target.classList.contains("remove-from-cart")) {
    removeFromCart(e.target.dataset.id);
  }
});

// Inicjalizacja
(async function init() {
  updateCartTopbar();
  renderCartInForm();
  await fetchAdminAvailability();
  await fetchDeliveryAvailability();   // ⭐ NOWE
  applyAvailability();
})();

// -------------------------------
// WYSYŁKA REZERWACJI
// -------------------------------

document.addEventListener("submit", async (e) => {
  if (e.target.id === "reservation-form") {
    e.preventDefault();

    const { start, end } = getDates();
    const cart = getCart();
    const days = countDays(start, end);

    const total = cart.reduce((sum, item) => sum + item.price * days, 0);

    const items = cart
      .map(item => `${item.name} (${item.price} zł/dzień)`)
      .join(", ");

    const deliveryOption = document.getElementById("delivery-option").value;
    const addressValue = document.getElementById("address").value;

    const payload = {
      name: document.getElementById("name").value,
      phone: document.getElementById("phone").value,
      email: document.getElementById("email").value,
      startDate: start,
      endDate: end,
      items,
      totalPrice: total.toFixed(2),
      delivery: deliveryOption,
      address: addressValue
    };

    // 🔥 Wysyłka rezerwacji do głównego WebAppa — POPRAWIONY URL
    await fetch(
      "https://script.google.com/macros/s/AKfycbwKvA4KIZNnDbwsQS4cZWCx9oSl40iPwZ7l4zYKyuxXgpJn6Fx4wLd_csJpagYeWw/exec",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    // 🔥 ZAPIS BLOKADY DLA KAŻDEGO PRODUKTU OSOBNO (OPCJA A)
    for (const item of cart) {
      await fetch(
        "https://script.google.com/macros/s/AKfycbxIu0zR-s6ItV-y8Fbx2Ywwsusvjqn5hX7EyFLXtn4s8jySd0SwRZ-RB4oF2Nq4Vlag/exec",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product: item.id,   // np. wozek1, fotelik2
            type: "range",
            from: start,
            to: end
          })
        }
      );
    }

    alert("Rezerwacja wysłana! Skontaktujemy się wkrótce.");
    localStorage.removeItem("cart");
    window.location.href = "index.html";
  }
});


// -------------------------------
// ⭐ SLIDER PRODUKTÓW
// -------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const track = document.querySelector(".slider-track");
  if (!track) return;

  const btnLeft = document.querySelector(".slider-btn-left");
  const btnRight = document.querySelector(".slider-btn-right");

  let position = 0;

  function getCardWidth() {
    const card = track.querySelector(".small-card");
    if (!card) return 300;
    return card.offsetWidth + 20;
  }

  btnRight.addEventListener("click", () => {
    const cardWidth = getCardWidth();
    const maxScroll = track.scrollWidth - track.clientWidth;
    position = Math.min(position + cardWidth, maxScroll);
    track.style.transform = `translateX(-${position}px)`;
  });

  btnLeft.addEventListener("click", () => {
    const cardWidth = getCardWidth();
    position = Math.max(position - cardWidth, 0);
    track.style.transform = `translateX(-${position}px)`;
  });
});

