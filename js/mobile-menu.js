const openBtn = document.querySelector("[data-menu-open]");
const closeBtn = document.querySelector("[data-menu-close]");
const menu = document.querySelector("[data-menu]");
const menuLinks = document.querySelectorAll(".mobile-menu-link");

const productBackdrop = document.querySelector("[data-product-modal]");
const productCloseBtn = document.querySelector("[data-product-close]");
const orderBackdrop = document.querySelector("[data-order-modal]");
const orderCloseBtn = document.querySelector("[data-order-close]");
const orderForm = document.querySelector(".modal-form");
const subscribeForm = document.querySelector(".subscribe-form");
const subscribeMessage = document.querySelector("[data-subscribe-message]");

const productImage = document.querySelector("[data-product-image]");
const productTitle = document.querySelector("[data-product-title]");
const productPrice = document.querySelector("[data-product-price]");
const productDescription = document.querySelector("[data-product-description]");
const selectedProductInput = document.querySelector("[data-selected-product]");

const flowersList = document.querySelector("[data-flowers-list]");
const bouquetsList = document.querySelector("[data-bouquets-list]");
const feedbackList = document.querySelector("[data-feedback-list]");
const flowersStatus = document.querySelector("[data-flowers-status]");
const bouquetsStatus = document.querySelector("[data-bouquets-status]");
const feedbackStatus = document.querySelector("[data-feedback-status]");
const loadMoreBtn = document.querySelector("[data-load-more]");
const flowersPrevBtn = document.querySelector("[data-flowers-prev]");
const flowersNextBtn = document.querySelector("[data-flowers-next]");
const feedbackPrevBtn = document.querySelector("[data-feedback-prev]");
const feedbackNextBtn = document.querySelector("[data-feedback-next]");
const sliderDots = document.querySelectorAll(".flowers .slider-dot");

const API_URL = "http://localhost:3000";
const PER_PAGE = 15;

const body = document.body;
const html = document.documentElement;

let scrollPosition = 0;
let activeModal = null;
let localDbCache = null;
let flowersData = [];
let feedbackData = [];
let bouquetsPage = 1;
let loadedBouquets = 0;
let totalBouquets = 0;
let flowersIndex = 0;
let feedbackIndex = 0;

const defaultProduct = {
  title: "Spring Elegance",
  price: "$35",
  description:
    "Each stem is carefully selected to create a bouquet that radiates freshness, elegance, and the gentle charm of spring.",
  image: "./images/spring_elegance.jpg",
  alt: "Spring Elegance bouquet",
};

const escapeHTML = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getVisibleCount = () => (window.innerWidth < 768 ? 1 : 3);

const showLoader = (statusElement) => {
  if (!statusElement) return;
  statusElement.innerHTML = '<span class="loader" aria-label="Loading"></span>';
};

const clearStatus = (statusElement) => {
  if (!statusElement) return;
  statusElement.innerHTML = "";
};

const showError = (statusElement) => {
  if (!statusElement) return;
  statusElement.innerHTML =
    '<p class="error-message">Sorry, we couldn’t load this section. Please check that json-server is running and try again.</p>';
};

const hideLoadMore = () => {
  if (!loadMoreBtn) return;
  loadMoreBtn.classList.add("is-hidden");
  loadMoreBtn.setAttribute("hidden", "");
};

const showLoadMore = () => {
  if (!loadMoreBtn) return;
  loadMoreBtn.classList.remove("is-hidden");
  loadMoreBtn.removeAttribute("hidden");
};

const setLoadMoreLoading = (isLoading) => {
  if (!loadMoreBtn) return;
  loadMoreBtn.disabled = isLoading;
  loadMoreBtn.textContent = isLoading ? "Loading..." : "Load more";
};

const getLocalDb = async () => {
  if (localDbCache) return localDbCache;
  const response = await axios.get("./db.json");
  localDbCache = response.data;
  return localDbCache;
};

const getData = async (resource) => {
  try {
    const response = await axios.get(`${API_URL}/${resource}`);
    return response.data;
  } catch (error) {
    const data = await getLocalDb();
    return data[resource] || [];
  }
};

const normalizePagination = ({ data, headers, page, perPage }) => {
  if (Array.isArray(data)) {
    return {
      items: data,
      total: Number(headers?.["x-total-count"]) || data.length,
    };
  }

  const items = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.items)
      ? data.items
      : [];

  const total =
    Number(headers?.["x-total-count"]) ||
    Number(data?.total) ||
    Number(data?.totalItems) ||
    Number(data?.items) ||
    (Number(data?.pages) ? Number(data.pages) * perPage : items.length + (page - 1) * perPage);

  return { items, total };
};

const getPaginatedData = async (resource, page = 1, perPage = PER_PAGE) => {
  try {
    const response = await axios.get(`${API_URL}/${resource}`, {
      params: {
        _page: page,
        _per_page: perPage,
      },
    });

    const normalized = normalizePagination({
      data: response.data,
      headers: response.headers,
      page,
      perPage,
    });

    if (normalized.items.length) return normalized;
    throw new Error("Empty paginated response");
  } catch (error) {
    const data = await getLocalDb();
    const items = data[resource] || [];
    const start = (page - 1) * perPage;
    const end = start + perPage;

    return {
      items: items.slice(start, end),
      total: items.length,
    };
  }
};

const createImageMarkup = ({ image, image2x, alt }) => `
  <img
    alt="${escapeHTML(alt)}"
    src="${escapeHTML(image)}"
    srcset="${escapeHTML(image)} 1x, ${escapeHTML(image2x || image)} 2x"
  />
`;

const createFlowerMarkup = (item) => `
  <li class="flowers-item" data-order-product role="button" tabindex="0">
    ${createImageMarkup(item)}
    <h3 class="flowers-title">${escapeHTML(item.title)}</h3>
    <p class="flowers-text">${escapeHTML(item.description)}</p>
    <p class="flowers-price">${escapeHTML(item.price)}</p>
  </li>
`;

const createBouquetMarkup = (item) => `
  <li class="bouquets-item" data-order-product role="button" tabindex="0">
    ${createImageMarkup(item)}
    <h3>${escapeHTML(item.title)}</h3>
    <p>${escapeHTML(item.description)}</p>
    <span>${escapeHTML(item.price)}</span>
  </li>
`;

const createFeedbackMarkup = (item) => `
  <li class="feedback-item">
    <p>${escapeHTML(item.text)}</p>
    <h3>${escapeHTML(item.name)}</h3>
  </li>
`;

const renderItems = (list, items, createMarkup, { append = false } = {}) => {
  if (!list) return;
  const markup = items.map(createMarkup).join("");
  if (!append) list.innerHTML = "";
  list.insertAdjacentHTML("beforeend", markup);
};

const getLoopSlice = (items, start, count) => {
  if (!items.length) return [];
  return Array.from({ length: Math.min(count, items.length) }, (_, index) => {
    return items[(start + index) % items.length];
  });
};

const updateFlowerDots = () => {
  if (!sliderDots.length || !flowersData.length) return;
  sliderDots.forEach((dot, index) => {
    dot.classList.toggle("active", index === flowersIndex % sliderDots.length);
  });
};

const renderFlowersSlider = () => {
  const visibleItems = getLoopSlice(flowersData, flowersIndex, getVisibleCount());
  renderItems(flowersList, visibleItems, createFlowerMarkup);
  updateFlowerDots();
};

const renderFeedbackSlider = () => {
  const visibleItems = getLoopSlice(feedbackData, feedbackIndex, getVisibleCount());
  renderItems(feedbackList, visibleItems, createFeedbackMarkup);
};

const scrollAfterLoad = () => {
  const card = bouquetsList?.querySelector(".bouquets-item");
  const cardHeight = card?.getBoundingClientRect().height || 0;
  if (!cardHeight) return;

  window.scrollBy({
    top: cardHeight * 2,
    behavior: "smooth",
  });
};

const loadFlowers = async () => {
  showLoader(flowersStatus);

  try {
    flowersData = await getData("flowers");
    flowersIndex = 0;

    if (!Array.isArray(flowersData) || flowersData.length === 0) {
      renderItems(flowersList, [], createFlowerMarkup);
      flowersStatus.innerHTML = '<p class="error-message">No flowers to show yet.</p>';
      return;
    }

    renderFlowersSlider();
    clearStatus(flowersStatus);
  } catch (error) {
    renderItems(flowersList, [], createFlowerMarkup);
    showError(flowersStatus);
  }
};

const loadFeedback = async () => {
  showLoader(feedbackStatus);

  try {
    feedbackData = await getData("feedback");
    feedbackIndex = 0;

    if (!Array.isArray(feedbackData) || feedbackData.length === 0) {
      renderItems(feedbackList, [], createFeedbackMarkup);
      feedbackStatus.innerHTML = '<p class="error-message">No feedback to show yet.</p>';
      return;
    }

    renderFeedbackSlider();
    clearStatus(feedbackStatus);
  } catch (error) {
    renderItems(feedbackList, [], createFeedbackMarkup);
    showError(feedbackStatus);
  }
};

const loadBouquets = async ({ reset = false } = {}) => {
  if (reset) {
    bouquetsPage = 1;
    loadedBouquets = 0;
    totalBouquets = 0;
    bouquetsList.innerHTML = "";
    hideLoadMore();
    clearStatus(bouquetsStatus);
  }

  showLoader(bouquetsStatus);
  setLoadMoreLoading(true);

  try {
    const { items, total } = await getPaginatedData("bouquets", bouquetsPage, PER_PAGE);

    if (!Array.isArray(items) || items.length === 0) {
      hideLoadMore();
      clearStatus(bouquetsStatus);
      return;
    }

    renderItems(bouquetsList, items, createBouquetMarkup, { append: !reset });
    clearStatus(bouquetsStatus);

    loadedBouquets += items.length;
    totalBouquets = total;

    if (loadedBouquets < totalBouquets && items.length === PER_PAGE) {
      showLoadMore();
    } else {
      hideLoadMore();
    }

    if (!reset) scrollAfterLoad();
    bouquetsPage += 1;
  } catch (error) {
    showError(bouquetsStatus);
  } finally {
    setLoadMoreLoading(false);
  }
};

const lockPage = () => {
  if (body.classList.contains("no-scroll")) return;

  scrollPosition = window.scrollY;
  body.classList.add("no-scroll");
  html.classList.add("no-scroll");
  body.style.position = "fixed";
  body.style.top = `-${scrollPosition}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
};

const unlockPage = () => {
  body.classList.remove("no-scroll");
  html.classList.remove("no-scroll");
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  window.scrollTo(0, scrollPosition);
};

const getProductData = (element) => {
  const card = element?.closest?.(".flowers-item, .bouquets-item");
  if (!card) return defaultProduct;

  const image = card.querySelector("img");
  const title = card.querySelector("h3")?.textContent.trim() || defaultProduct.title;
  const price = card.querySelector(".flowers-price, span")?.textContent.trim() || defaultProduct.price;
  const description =
    card.querySelector(".flowers-text, p")?.textContent.trim() || defaultProduct.description;

  return {
    title,
    price,
    description,
    image: image?.getAttribute("src") || defaultProduct.image,
    alt: image?.getAttribute("alt") || `${title} bouquet`,
  };
};

const setProductData = (product) => {
  if (productImage) {
    productImage.src = product.image;
    productImage.alt = product.alt;
  }

  if (productTitle) productTitle.textContent = product.title;
  if (productPrice) productPrice.textContent = product.price;
  if (productDescription) productDescription.textContent = product.description;
  if (selectedProductInput) selectedProductInput.value = product.title;
};

const closeMenu = () => {
  if (!menu) return;
  menu.classList.remove("is-open");
  if (!activeModal) unlockPage();
};

const openMenu = () => {
  if (!menu) return;
  menu.classList.add("is-open");
  lockPage();
};

const openProductModal = (element) => {
  if (!productBackdrop) return;
  if (menu?.classList.contains("is-open")) menu.classList.remove("is-open");
  setProductData(getProductData(element));
  productBackdrop.classList.add("is-open");
  activeModal = productBackdrop;
  lockPage();
  productCloseBtn?.focus();
};

const closeProductModal = ({ keepPageLocked = false } = {}) => {
  if (!productBackdrop) return;
  productBackdrop.classList.remove("is-open");

  if (!keepPageLocked) {
    activeModal = null;
    if (!menu?.classList.contains("is-open")) unlockPage();
  }
};

const openOrderModal = (element) => {
  if (!orderBackdrop) return;
  if (menu?.classList.contains("is-open")) menu.classList.remove("is-open");
  setProductData(getProductData(element));
  closeProductModal({ keepPageLocked: true });
  orderBackdrop.classList.add("is-open");
  activeModal = orderBackdrop;
  lockPage();
  orderCloseBtn?.focus();
};

const closeOrderModal = () => {
  if (!orderBackdrop) return;
  orderBackdrop.classList.remove("is-open");
  activeModal = null;
  if (!menu?.classList.contains("is-open")) unlockPage();
};

const closeActiveModal = () => {
  if (activeModal === productBackdrop) closeProductModal();
  if (activeModal === orderBackdrop) closeOrderModal();
};

const changeFlowersSlide = (direction) => {
  if (!flowersData.length) return;
  flowersIndex = (flowersIndex + direction + flowersData.length) % flowersData.length;
  renderFlowersSlider();
};

const changeFeedbackSlide = (direction) => {
  if (!feedbackData.length) return;
  feedbackIndex = (feedbackIndex + direction + feedbackData.length) % feedbackData.length;
  renderFeedbackSlider();
};

openBtn?.addEventListener("click", openMenu);
closeBtn?.addEventListener("click", closeMenu);
loadMoreBtn?.addEventListener("click", () => loadBouquets());
flowersPrevBtn?.addEventListener("click", () => changeFlowersSlide(-1));
flowersNextBtn?.addEventListener("click", () => changeFlowersSlide(1));
feedbackPrevBtn?.addEventListener("click", () => changeFeedbackSlide(-1));
feedbackNextBtn?.addEventListener("click", () => changeFeedbackSlide(1));

menuLinks.forEach((link) => {
  link.addEventListener("click", closeMenu);
});

document.addEventListener("click", (event) => {
  const orderCard = event.target.closest("[data-order-product]");
  const orderOpenElement = event.target.closest("[data-order-open]");
  const productOpenElement = event.target.closest("[data-product-open]");

  if (orderOpenElement) {
    openOrderModal(orderOpenElement);
    return;
  }

  if (orderCard) {
    openProductModal(orderCard);
    return;
  }

  if (productOpenElement) {
    openProductModal(productOpenElement);
  }
});

document.addEventListener("keydown", (event) => {
  const orderCard = event.target.closest("[data-order-product]");

  if ((event.key === "Enter" || event.key === " ") && orderCard) {
    event.preventDefault();
    openProductModal(orderCard);
  }

  if (event.key === "Escape" && activeModal) closeActiveModal();
});

productCloseBtn?.addEventListener("click", () => closeProductModal());
orderCloseBtn?.addEventListener("click", closeOrderModal);

productBackdrop?.addEventListener("click", (event) => {
  if (event.target === productBackdrop) closeProductModal();
});

orderBackdrop?.addEventListener("click", (event) => {
  if (event.target === orderBackdrop) closeOrderModal();
});

orderForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  orderForm.reset();
  closeOrderModal();
});

subscribeForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  subscribeForm.reset();

  if (subscribeMessage) {
    subscribeMessage.textContent = "You have successfully subscribed!";
    setTimeout(() => {
      subscribeMessage.textContent = "";
    }, 4000);
  }
});

window.addEventListener("resize", () => {
  renderFlowersSlider();
  renderFeedbackSlider();
});

const initDynamicContent = async () => {
  await Promise.all([loadFlowers(), loadBouquets({ reset: true }), loadFeedback()]);
};

initDynamicContent();
