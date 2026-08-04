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

// 🔥 PODSTAW SWÓJ URL WEB APP Z APPS SCRIPT
const ADMIN_AVAILABILITY_URL = "https://script.google.com/macros/s/AKfycbwKvA4KIZNnDbwsQS4cZWCx9oSl40iPwZ7l4zYKyuxXgpJn6Fx4wLd_csJpagYeWw/exec";

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

  // mapowanie dni tygodnia
  const dayNames = {
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday"
  };

  // 1️⃣ BLOKADA: jeśli START wypada w niedzielę
  for (const b of adminBlocks) {
    if (b.type === "weekday_start" && b.weekday) {
      if (b.product === "all" || b.product === productId) {
        const startName = dayNames[startDate.getDay()];
        if (startName === b.weekday) {
          return false;
        }
      }
    }
  }

  // 2️⃣ BLOKADA: jeśli KONIEC wypada w niedzielę
  for (const b of adminBlocks) {
    if (b.type === "weekday_end" && b.weekday) {
      if (b.product === "all" || b.product === productId) {
        const endName = dayNames[endDate.getDay()];
        if (endName === b.weekday) {
          return false;
        }
      }
    }
  }

  // 3️⃣ BLOKADY ZAKRESÓW DAT Z PANELU ADMINA
  for (const b of adminBlocks) {
    if (b.type === "range" && b.from && b.to) {
      if (b.product === "all" || b.product === productId) {
        const blockStart = new Date(b.from);
        const blockEnd = new Date(b.to);

        if (startDate <= blockEnd && endDate >= blockStart) {
          return false;
        }
      }
    }
  }

  // 4️⃣ LOKALNE BLOKADY (availability)
  const blocks = availability[productId] || [];

  const conflict = blocks.some(block => {
    const blockStart = new Date(block.from);
    const blockEnd = new Date(block.to);

    return (
      (startDate <= blockEnd) &&
      (endDate >= blockStart)
    );
  });

  if (conflict) return false;

  return true;
}


function applyAvailability() {
  const { start, end } = getDates();

  document.querySelectorAll(".mosaic-card").forEach(card => {
    const productId = card.dataset.product;
    const addBtn = card.querySelector(".add-to-cart");

    const available = isAvailable(productId, start, end);

    if (!available) {
      card.classList.add("unavailable");

      if (addBtn) {
        addBtn.textContent = "Niedostępny";
        addBtn.classList.add("disabled");
        addBtn.style.pointerEvents = "none";
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

// Inicjalizacja: najpierw pobierz blokady admina, potem zastosuj
(async function init() {
  updateCartTopbar();
  renderCartInForm();
  await fetchAdminAvailability();
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

    const items = cart.map(item => `${item.name} (${item.price} zł/dzień)`).join(", ");

    const payload = {
      name: document.getElementById("name").value,
      phone: document.getElementById("phone").value,
      email: document.getElementById("email").value,
      startDate: start,
      endDate: end,
      items,
      totalPrice: total.toFixed(2)
    };

    await fetch("https://script.google.com/macros/s/AKfycbxxpCDCDQqwQHRnXqdxDV8h-bVHbCSrsddqfqAhip57b37UvNPtK2QxTgKwKwAP9iQ/exec", {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    alert("Rezerwacja wysłana! Skontaktujemy się wkrótce.");
    localStorage.removeItem("cart");
    window.location.href = "index.html";
  }
});
