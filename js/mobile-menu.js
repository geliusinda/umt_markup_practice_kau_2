const openBtn = document.querySelector("[data-menu-open]");
const closeBtn = document.querySelector("[data-menu-close]");
const menu = document.querySelector("[data-menu]");
const menuLinks = document.querySelectorAll(".mobile-menu-link");

const productBackdrop = document.querySelector("[data-product-modal]");
const productModal = document.querySelector(".product-modal");
const productCloseBtn = document.querySelector("[data-product-close]");
const orderBackdrop = document.querySelector("[data-order-modal]");
const orderModal = document.querySelector(".order-modal");
const orderCloseBtn = document.querySelector("[data-order-close]");
const orderForm = document.querySelector(".modal-form");
const subscribeForm = document.querySelector(".subscribe-form");

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

const body = document.body;
const html = document.documentElement;

const API_URL = "http://localhost:3000";
const PER_PAGE = 15;
const END_MESSAGE = "We're sorry, but you've reached the end of search results.";

let scrollPosition = 0;
let activeModal = null;
let bouquetsPage = 1;
let loadedBouquets = 0;
let totalBouquets = 0;
let localDbCache = null;
let bouquetLightbox = null;

const defaultProduct = {
  title: "Spring Elegance",
  price: "$35",
  description:
    "Each stem is carefully selected to create a bouquet that radiates freshness, elegance, and the gentle charm of spring. Whether you’re celebrating a birthday, sending love, or simply brightening someone’s day, this arrangement is sure to bring warm smiles and lasting impressions.",
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

const showEndMessage = () => {
  if (!bouquetsStatus) return;
  bouquetsStatus.innerHTML = `<p class="end-message">${END_MESSAGE}</p>`;
};

const hideLoadMore = () => {
  loadMoreBtn?.classList.add("is-hidden");
  loadMoreBtn?.setAttribute("hidden", "");
};

const showLoadMore = () => {
  loadMoreBtn?.classList.remove("is-hidden");
  loadMoreBtn?.removeAttribute("hidden");
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
    Number(data?.items) ||
    Number(data?.total) ||
    Number(data?.totalItems) ||
    Number(headers?.["x-total-count"]) ||
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

    return normalizePagination({
      data: response.data,
      headers: response.headers,
      page,
      perPage,
    });
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

const createImageMarkup = ({ image, image2x, alt }) => {
  const fullImage = image2x || image;

  return `
    <a class="gallery-lightbox" href="${escapeHTML(fullImage)}">
      <img
        alt="${escapeHTML(alt)}"
        src="${escapeHTML(image)}"
        srcset="${escapeHTML(image)} 1x, ${escapeHTML(fullImage)} 2x"
      />
    </a>
  `;
};

const createFlowerMarkup = (item) => `
  <li class="flowers-item" data-product-open role="button" tabindex="0">
    ${createImageMarkup(item)}
    <h3 class="flowers-title">${escapeHTML(item.title)}</h3>
    <p class="flowers-text">${escapeHTML(item.description)}</p>
    <p class="flowers-price">${escapeHTML(item.price)}</p>
  </li>
`;

const createBouquetMarkup = (item) => `
  <li class="bouquets-item" data-product-open role="button" tabindex="0">
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

  if (!append) {
    list.innerHTML = "";
  }

  list.insertAdjacentHTML("beforeend", markup);
};

const initLightbox = () => {
  if (!window.SimpleLightbox) return;

  bouquetLightbox = new SimpleLightbox(".gallery-lightbox", {
    captionsData: "alt",
    captionDelay: 250,
  });
};

const refreshLightbox = () => {
  bouquetLightbox?.refresh();
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

const loadSection = async ({ resource, list, status, createMarkup }) => {
  showLoader(status);

  try {
    const items = await getData(resource);

    if (!Array.isArray(items) || items.length === 0) {
      renderItems(list, [], createMarkup);
      if (status) {
        status.innerHTML = '<p class="error-message">No items to show yet.</p>';
      }
      return;
    }

    renderItems(list, items, createMarkup);
    clearStatus(status);
    refreshLightbox();
  } catch (error) {
    renderItems(list, [], createMarkup);
    showError(status);
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
    const { items, total } = await getPaginatedData(
      "bouquets",
      bouquetsPage,
      PER_PAGE,
    );

    if (!Array.isArray(items) || items.length === 0) {
      hideLoadMore();
      if (loadedBouquets > 0 || bouquetsPage > 1) {
        showEndMessage();
      } else if (bouquetsStatus) {
        bouquetsStatus.innerHTML = '<p class="error-message">No bouquets to show yet.</p>';
      }
      return;
    }

    renderItems(bouquetsList, items, createBouquetMarkup, {
      append: !reset,
    });

    refreshLightbox();
    clearStatus(bouquetsStatus);

    loadedBouquets += items.length;
    totalBouquets = total;

    if (loadedBouquets >= totalBouquets || items.length < PER_PAGE) {
      hideLoadMore();
      showEndMessage();
    } else {
      showLoadMore();
    }

    if (!reset) {
      scrollAfterLoad();
    }

    bouquetsPage += 1;
  } catch (error) {
    showError(bouquetsStatus);
  } finally {
    setLoadMoreLoading(false);
  }
};

const initDynamicContent = async () => {
  initLightbox();

  await Promise.all([
    loadSection({
      resource: "flowers",
      list: flowersList,
      status: flowersStatus,
      createMarkup: createFlowerMarkup,
    }),
    loadBouquets({ reset: true }),
    loadSection({
      resource: "feedback",
      list: feedbackList,
      status: feedbackStatus,
      createMarkup: createFeedbackMarkup,
    }),
  ]);
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
  const card = element.closest(".flowers-item, .bouquets-item");

  if (!card) return defaultProduct;

  const image = card.querySelector("img");
  const title =
    card.querySelector("h3")?.textContent.trim() || defaultProduct.title;
  const price =
    card.querySelector(".flowers-price, span")?.textContent.trim() ||
    defaultProduct.price;
  const description =
    card.querySelector(".flowers-text, p")?.textContent.trim() ||
    defaultProduct.description;

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

  if (!activeModal) {
    unlockPage();
  }
};

const openMenu = () => {
  if (!menu) return;

  menu.classList.add("is-open");
  lockPage();
};

const openProductModal = (element) => {
  if (!productBackdrop || !productModal) return;

  if (menu?.classList.contains("is-open")) {
    menu.classList.remove("is-open");
  }

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

const openOrderModal = () => {
  if (!orderBackdrop || !orderModal) return;

  if (menu?.classList.contains("is-open")) {
    menu.classList.remove("is-open");
  }

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

  if (!menu?.classList.contains("is-open")) {
    unlockPage();
  }
};

const closeActiveModal = () => {
  if (activeModal === productBackdrop) {
    closeProductModal();
  }

  if (activeModal === orderBackdrop) {
    closeOrderModal();
  }
};

openBtn?.addEventListener("click", openMenu);
closeBtn?.addEventListener("click", closeMenu);
loadMoreBtn?.addEventListener("click", () => loadBouquets());

menuLinks.forEach((link) => {
  link.addEventListener("click", closeMenu);
});

document.addEventListener("click", (event) => {
  const lightboxLink = event.target.closest(".gallery-lightbox");

  if (lightboxLink) {
    if (!window.SimpleLightbox || !bouquetLightbox) {
      event.preventDefault();
      openProductModal(lightboxLink);
    }

    return;
  }

  const productOpenElement = event.target.closest("[data-product-open]");
  const orderOpenElement = event.target.closest("[data-order-open]");

  if (productOpenElement) {
    openProductModal(productOpenElement);
    return;
  }

  if (orderOpenElement) {
    openOrderModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.closest("[data-product-open]") &&
    !event.target.closest(".gallery-lightbox")
  ) {
    event.preventDefault();
    openProductModal(event.target.closest("[data-product-open]"));
  }

  if (event.key === "Escape" && activeModal) {
    closeActiveModal();
  }
});

productCloseBtn?.addEventListener("click", () => closeProductModal());
orderCloseBtn?.addEventListener("click", closeOrderModal);

productBackdrop?.addEventListener("click", (event) => {
  if (event.target === productBackdrop) {
    closeProductModal();
  }
});

orderBackdrop?.addEventListener("click", (event) => {
  if (event.target === orderBackdrop) {
    closeOrderModal();
  }
});

orderForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  orderForm.reset();
  closeOrderModal();
});

subscribeForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  subscribeForm.reset();
});

initDynamicContent();
