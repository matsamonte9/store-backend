import { appState } from "../public/globals.js";
import { showProducts } from "../public/modules/inventory/products.js";

export function createOrderHTML() {
  const createOrderButton = document.querySelector('.js-create-order-button');

  createOrderButton.addEventListener('click', async () => {
    const createOrderGrid = document.querySelector('.js-create-order');
    const bodyContainer = document.querySelector('.js-body-container');
    const createOrderContainer = document.querySelector('.js-create-order-container');

    if (appState.creatingOrder) {
      try {
        const { data } = await axios.delete(`/api/v1/orders/${appState.currentOrderId}`);

        appState.creatingOrder = false;
        appState.currentOrderId = null;
        showProducts();
        bodyContainer.classList.remove('creating-order');
        createOrderGrid.classList.remove('create-order');
        createOrderContainer.classList.add('hidden');
        createOrderButton.innerHTML = `
          <div class="add-product">
            Create Order
          </div>
          <span class="material-symbols-outlined add-product-icon">
            add
          </span>
        `;
        createOrderButton.classList.replace('cancel-order-button', 'add-product-button');
      } catch (error) {
        console.log(error);
      }

      return;
    }

    const html = `
      <div class="create-order-header-container">
        <div class="create-order-header-title">
          Order List
        </div>
        <div class="create-order-header-indicator product-expired-container">
          Draft
        </div>
      </div>
      <div class="create-order-details">
        <div class="create-order-details-name">
          <div>
            Supplier's Name: 
          </div>
          <input type="text" class="js-input-supplier-name create-order-details-name-input">
        </div>
      </div>
      <div class="create-order-details">
        <input type="hidden" class="js-order-type" value="personal">
        <div class="js-service-button create-order-details-service-dropdown">
          <div class="create-order-details-service-button">
            <div class="js-service-text service-text">
              Personal
            </div>
            <span class="material-symbols-outlined">
              keyboard_arrow_down
            </span>
          </div>
          <div class="js-service-modal service-modal hidden">
            
          </div>
        </div>
        
        <div class="js-service-button create-order-details-service-dropdown">
          <input type="date" class="js-create-order-delivery-date-input create-order-details-service-button">
        </div>
      </div>
      <div class="order-product-details-title-container">
        <div class="order-product-details-title">
          Qty
        </div>
        <div class="order-product-details-title">
          Name
        </div>
        <div class="order-product-details-title">
          Price
        </div>
        <div class="order-product-details-title">
          Total
        </div>
        <div class="order-product-details-title">
        </div>
      </div>
      <div class="js-order-product-list-container order-products-list-container">
        <!-- Items -->
      </div>
      <div class="create-order-footer-container">
        <div class="js-finalize-order add-button">
          Save Orders
        </div>
      </div>
    `;

    const createOrderBtnHTML = `
      <div class="add-product">
        Cancel Order
      </div>
      <span class="material-symbols-outlined add-product-icon">
        close
      </span>
    `;

    try {
      const { data: { newOrder: { _id: orderId } } } = await axios.post('/api/v1/orders');

      appState.currentOrderId = orderId;
      
      appState.creatingOrder = true;
      showProducts();
      bodyContainer.classList.add('creating-order');
      createOrderGrid.classList.add('create-order');
      createOrderButton.innerHTML = createOrderBtnHTML;
      createOrderButton.classList.replace('add-product-button', 'cancel-order-button');
      createOrderContainer.innerHTML = html;
      editItem();
      saveItem();
      deleteItem();
      serviceModal();
      createOrderContainer.classList.remove('hidden');
      saveOrder();
    } catch (error) {
      console.log(error);
    }
  });
}

function serviceModal() {
  const serviceDOM = document.querySelector('.js-service-button');
  const serviceModalDOM = document.querySelector('.js-service-modal');

  serviceDOM.addEventListener('click', () => {
    const isHidden = serviceModalDOM.classList.contains('hidden');

    const html = `
      <div class="option option-divider" data-service="personal"> 
        Personal
      </div>
      <div class="option option-divider" data-service="delivery"> 
        Delivery 
      </div>
      <div class="option option-divider" data-service="pickup"> 
        Pick Up
      </div>
    `;

    if (isHidden) {
      serviceModalDOM.classList.remove('hidden');
      serviceModalDOM.innerHTML = html;
    } else {
      serviceModalDOM.classList.add('hidden');
    }

    serviceModalDOM.addEventListener('click', (e) => {
      if (e.target.classList.contains('option')) {
        const service = e.target.dataset.service;
        const serviceText = document.querySelector('.js-service-text');
        const orderTypeInput = document.querySelector('.js-order-type');

        serviceText.textContent = 
          service === 'personal' ? 'Personal'  :
          service === 'delivery' ? 'Delivery' :
          service === 'pickup' ? 'Pick Up' :
          'Personal'

        orderTypeInput.value = service;
      }
    });
  });
}

function saveOrder() {
  const saveOrderButton = document.querySelector('.js-finalize-order');
  const supplierNameInputDOM = document.querySelector('.js-input-supplier-name');
  const createOrderGrid = document.querySelector('.js-create-order');
  const bodyContainer = document.querySelector('.js-body-container');
  const createOrderContainer = document.querySelector('.js-create-order-container');
  const createOrderButton = document.querySelector('.js-create-order-button');

  saveOrderButton.addEventListener('click', async () => {
    try {
      const orderId = appState.currentOrderId;
      const supplierName = supplierNameInputDOM.value.trim();
      const orderType = document.querySelector('.js-order-type').value;
      const deliveryDate = document.querySelector('.js-create-order-delivery-date-input').value;

      const { data } = await axios.patch(`/api/v1/orders/${orderId}`,{ 
        supplierName,
        orderType,
        deliveryDate,
      });
      console.log(data.msg);
      bodyContainer.classList.remove('creating-order');
      createOrderGrid.classList.remove('create-order');
      createOrderContainer.classList.add('hidden');
      createOrderButton.innerHTML = `
        <div class="add-product">
          Create Order
        </div>
        <span class="material-symbols-outlined add-product-icon">
          add
        </span>
      `;
      createOrderButton.classList.replace('cancel-order-button', 'add-product-button');
      appState.creatingOrder = false;
      appState.currentOrderId = null;
    } catch (error) {
      console.log(error);
    }
  });
}

function editItem() {
  const itemListContainer = document.querySelector('.js-order-product-list-container');

  itemListContainer.addEventListener('click', async (e) => {
    const el = e.target;

    if (el.classList.contains('js-edit-item')) {
      const productId = el.dataset.productId;
      const itemType = el.dataset.itemType;
      const item = appState.currentOrderItems.find(i => i.productId === productId && i.itemType === itemType);
  
      appState.editingItemId = productId;
      appState.editingItemType = item.itemType;

      renderOrderedItems();
    }
  });
}

function saveItem() {
  const itemListContainer = document.querySelector('.js-order-product-list-container');
  const orderId = appState.currentOrderId;

  itemListContainer.addEventListener('click', async (e) => {
    const el = e.target;

    if (el.classList.contains('js-save-item')) {
      const row = el.closest('.order-product-details-row');
      const quantityInput = row.querySelector('.js-quantity-input');
      const productId = el.dataset.productId;
      const itemType = el.dataset.itemType;

      try {
        const { data: { order } } = await axios.patch(`/api/v1/orders/${orderId}/items/${productId}?itemType=${itemType}`, {
          quantity: quantityInput.value,
        });
        appState.editingItemId = null;
        appState.editingItemType = null;
        appState.currentOrderItems = order.items;
        renderOrderedItems();
      } catch (error) {
        console.log(error);
      }
    }
  });
}

function deleteItem() {
  const itemListContainer = document.querySelector('.js-order-product-list-container');
  const orderId = appState.currentOrderId;

  itemListContainer.addEventListener('click', async (e) => {
    const el = e.target;

    if (el.classList.contains('js-delete-item')) {
      const productId = el.dataset.productId;
      const itemType = el.dataset.itemType;

      try {
        const { data: { order, msg}} = await axios.delete(`/api/v1/orders/${orderId}/items/${productId}?itemType=${itemType}`);
        appState.currentOrderItems = order.items;
        renderOrderedItems();
        console.log(msg);
      } catch (error) {
        console.log(error);
      }
    }
  });
}