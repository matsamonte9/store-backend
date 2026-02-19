import { successModal } from "../public/modules/shared/success-modal.js";
import { errorModal } from "../public/modules/shared/error-modal.js";
import { appState, domElements } from "../public/globals.js";
import { showProducts } from "../public/modules/inventory/products.js";

export function deleteModal() {
  domElements.productContainerDOM.addEventListener('click', (e) => {
    const el = e.target;
    const productId = el.dataset.productId;

    if (el.classList.contains('js-delete-action')) {
      const html = `
        <div class="js-modal-overlay modal-overlay">
          <div class="warning-modal-content-container">
            <div class="modal-content">
              <div class="modal-header">
              </div>

              <div class="modal-body">
                <div class="warning-modal-body">
                  <div class="warning-logo-container logo-container">
                    <img src="./warning-delete-logo.png" class="warning-logo">
                  </div>
                  <div class="warning-title">
                    Delete
                  </div>
                  <div class="warning-subtitle">
                    Are you sure you would like to do this?
                  </div>
                </div>
              </div>
              
              <div class="warning-modal-footer">
                <div class="js-cancel-button cancel-button">
                  Cancel
                </div>
                <div class="js-confirm-button confirm-button">
                  Confirm
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', html);

      const overlayDOM = document.querySelector('.js-modal-overlay');
      const closeButton = document.querySelector('.js-cancel-button');
      const confirmButton = document.querySelector('.js-confirm-button');

      overlayDOM.addEventListener('click', (e) => {
        if (e.target === overlayDOM || e.target === closeButton) {
          overlayDOM.remove();
        }
      });

      confirmButton.addEventListener('click', async () => {
        try {
          const response = await axios.delete(`/api/v1/products/${productId}`);
          await showProducts(appState.currentName, appState.currentSort, appState.currentFilter, appState.currentLimit, appState.currentPage);
          overlayDOM.remove();
          successModal(response.data.msg);
        } catch (error) {
          overlayDOM.remove();
          errorModal(error.response.data.msg);
        }
      });
    }
  });
}

