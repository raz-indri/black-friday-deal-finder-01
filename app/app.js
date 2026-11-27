// Bargain Beacon rendering and filtering: reads the deal list, builds the
// cards, and keeps search, filters and sort in the URL so a view can be shared.

import { DEALS, CHECKED_DATE } from "./deals.js";

const SIGNAL_LABELS = {
  "new-low": "New low",
  strong: "Strong price",
  routine: "Worth a look",
  modest: "Modest cut",
};

const grid = document.getElementById("deal-grid");
const statsBox = document.getElementById("stats");
const countLine = document.getElementById("result-count");
const emptyNote = document.getElementById("empty");
const searchInput = document.getElementById("search");
const categorySelect = document.getElementById("category");
const storeSelect = document.getElementById("store");
const discountSelect = document.getElementById("min-discount");
const sortSelect = document.getElementById("sort");
const newLowsOnly = document.getElementById("new-lows-only");

function discountOf(deal) {
  return Math.round((1 - deal.sale / deal.usual) * 100);
}

function money(amount) {
  return "$" + amount.toFixed(2).replace(/\.00$/, "");
}

function fillOptions(select, values) {
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
}

function renderStats() {
  const totalSaving = DEALS.reduce((sum, deal) => sum + (deal.usual - deal.sale), 0);
  const avgDiscount = Math.round(
    DEALS.reduce((sum, deal) => sum + discountOf(deal), 0) / DEALS.length,
  );
  const stores = new Set(DEALS.map((deal) => deal.store)).size;
  const newLows = DEALS.filter((deal) => deal.signal === "new-low").length;
  const stats = [
    [DEALS.length, "deals checked"],
    [avgDiscount + "%", "average discount"],
    [money(totalSaving), "total saving if you bought one of each"],
    [stores, "stores"],
    [newLows, "at a new low"],
  ];
  statsBox.innerHTML = stats
    .map(([value, label]) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`)
    .join("");
}

function dealCard(deal) {
  const card = document.createElement("article");
  card.className = "deal";

  const top = document.createElement("div");
  top.className = "deal-top";
  const store = document.createElement("span");
  store.className = "deal-store";
  store.textContent = deal.store;
  const category = document.createElement("span");
  category.className = "deal-category";
  category.textContent = deal.category;
  top.append(store, category);

  const title = document.createElement("h2");
  title.textContent = deal.name;

  const blurb = document.createElement("p");
  blurb.className = "deal-blurb";
  blurb.textContent = deal.blurb;

  const prices = document.createElement("div");
  prices.className = "price-row";
  const sale = document.createElement("span");
  sale.className = "sale-price";
  sale.textContent = money(deal.sale);
  const usual = document.createElement("span");
  usual.className = "usual-price";
  usual.textContent = "was " + money(deal.usual);
  const pill = document.createElement("span");
  pill.className = "discount-pill";
  pill.textContent = discountOf(deal) + "% off";
  prices.append(sale, usual, pill);

  const saving = document.createElement("p");
  saving.className = "save-line";
  saving.textContent = "You save " + money(deal.usual - deal.sale);

  const badge = document.createElement("span");
  badge.className = "badge badge-" + deal.signal;
  badge.textContent = SIGNAL_LABELS[deal.signal];

  const evidence = document.createElement("p");
  evidence.className = "evidence";
  evidence.textContent = deal.evidence;

  const checked = document.createElement("p");
  checked.className = "checked";
  checked.textContent = `Checked ${CHECKED_DATE} · ${deal.source}`;

  const link = document.createElement("a");
  link.className = "store-link";
  link.href = deal.url;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "View at " + deal.store;

  card.append(top, title, blurb, prices, saving, badge, evidence, checked, link);
  return card;
}

function readStateFromUrl() {
  const params = new URLSearchParams(location.search);
  return {
    q: params.get("q") ?? "",
    category: params.get("cat") ?? "",
    store: params.get("store") ?? "",
    min: Number(params.get("min") ?? 0),
    sort: params.get("sort") ?? "discount",
    newLows: params.get("lows") === "1",
  };
}

function writeStateToUrl(state) {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.category) params.set("cat", state.category);
  if (state.store) params.set("store", state.store);
  if (state.min) params.set("min", String(state.min));
  if (state.sort !== "discount") params.set("sort", state.sort);
  if (state.newLows) params.set("lows", "1");
  const query = params.toString();
  history.replaceState(null, "", query ? "?" + query : location.pathname);
}

function currentState() {
  return {
    q: searchInput.value.trim().toLowerCase(),
    category: categorySelect.value,
    store: storeSelect.value,
    min: Number(discountSelect.value),
    sort: sortSelect.value,
    newLows: newLowsOnly.checked,
  };
}

function applyFilters() {
  const state = currentState();
  writeStateToUrl(state);

  let shown = DEALS.filter((deal) => {
    if (state.q) {
      const haystack = (deal.name + " " + deal.blurb + " " + deal.store + " " + deal.category).toLowerCase();
      if (!haystack.includes(state.q)) return false;
    }
    if (state.category && deal.category !== state.category) return false;
    if (state.store && deal.store !== state.store) return false;
    if (discountOf(deal) < state.min) return false;
    if (state.newLows && deal.signal !== "new-low") return false;
    return true;
  });

  const byDiscount = (a, b) => discountOf(b) - discountOf(a);
  const bySaving = (a, b) => b.usual - b.sale - (a.usual - a.sale);
  const byPriceLow = (a, b) => a.sale - b.sale;
  const byPriceHigh = (a, b) => b.sale - a.sale;
  const sorters = {
    discount: byDiscount,
    saving: bySaving,
    "price-low": byPriceLow,
    "price-high": byPriceHigh,
  };
  shown = [...shown].sort(sorters[state.sort] ?? byDiscount);

  grid.replaceChildren(...shown.map(dealCard));
  emptyNote.hidden = shown.length > 0;
  countLine.textContent =
    shown.length === DEALS.length
      ? `Showing all ${DEALS.length} deals, sorted by ${sortSelect.options[sortSelect.selectedIndex].text.toLowerCase()}.`
      : `Showing ${shown.length} of ${DEALS.length} deals.`;
}

function init() {
  fillOptions(categorySelect, [...new Set(DEALS.map((deal) => deal.category))].sort());
  fillOptions(storeSelect, [...new Set(DEALS.map((deal) => deal.store))].sort());
  renderStats();

  const state = readStateFromUrl();
  searchInput.value = state.q;
  categorySelect.value = state.category;
  storeSelect.value = state.store;
  discountSelect.value = String(state.min);
  sortSelect.value = state.sort;
  newLowsOnly.checked = state.newLows;

  for (const control of [searchInput, categorySelect, storeSelect, discountSelect, sortSelect, newLowsOnly]) {
    control.addEventListener("input", applyFilters);
  }
  applyFilters();
}

init();
