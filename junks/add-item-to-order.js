// let editingItemId = null;
// let editingItemType = null;
// let currentOrderItems = [];

import { appState, domElements } from "../public/globals.js";

export function addItemToOrder() {
  domElements.productContainerDOM.addEventListener('click', async (e) => {
    const addEl = e.target.closest('.js-add-to-order-button');
    const replaceEl = e.target.closest('.js-replace-item-button');
    if (!addEl && !replaceEl) return;

    const productId = addEl ? addEl.dataset.productId : replaceEl.dataset.productId;
    appState.editingItemId = productId;
    const orderId = appState.currentOrderId;

    if (!orderId) {
      console.error('No active order found. Please create an order first.');
      return;
    }

    const itemType = addEl ? 'adding' : 'replacement';
    appState.editingItemType = itemType;
    const payload = addEl ? {
      productId,
      quantity: 1,
      itemType
    } : {
      productId,
      itemType 
    }

    try {
      const { data: { order }} = await axios.post(`/api/v1/orders/${orderId}/items`, payload);
      appState.currentOrderItems = order.items;

      if (itemType === 'replacement') {
        appState.editingItemId = null;
        appState.editingItemType = null;
      }

      renderOrderedItems();
      } catch (error) {
        console.log(error);
      }
  });
}

function renderOrderedItems() {
  const itemListContainer = document.querySelector('.js-order-product-list-container');

  itemListContainer.innerHTML = appState.currentOrderItems.map(item => {
    const isEditing = item.productId === appState.editingItemId && item.itemType === appState.editingItemType;

    return `
    <div class="order-product-details-row">
      <div class="order-qty">
        ${isEditing
          ? `<input type="number" class="js-quantity-input quantity-input" value="${item.quantity}" autofocus>` 
          : `${item.quantity}${item.itemType === 'replacement' ? '(r)' : ''}`
        } 
      </div>
      <div class="order-name">
        ${item.productName}
      </div>
      <div class="order-unit-price">
        ${item.unitPrice}
      </div>
      <div class="order-amount">
        ${item.quantity * item.unitPrice}
      </div>
      <div class="order-action">
        ${isEditing
          ? `
            <div class="js-save-item edit-order" data-product-id="${item.productId}" data-item-type="${item.itemType}"  >
              Save
            </div>
          `
          : `
            <div class="js-edit-item edit-order" data-product-id="${item.productId}" data-item-type="${item.itemType}">
              Edit
            </div>
          `
        }
        <div class="js-delete-item delete-order" data-product-id="${item.productId}" data-item-type="${item.itemType}">
          Delete
        </div>
      </div>  
    </div>
    `;
  }).join('');

  const quantityInput = itemListContainer.querySelector('.js-quantity-input');
  if (quantityInput) {
    quantityInput.focus();

    quantityInput.addEventListener('keydown', async (e) => {
      const orderId = appState.currentOrderId;
      if (e.key === 'Enter') {
        try {
          const { data: { order } } = await axios.patch(`/api/v1/orders/${orderId}/items/${appState.editingItemId}?itemType=${appState.editingItemType}`, {
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
}

