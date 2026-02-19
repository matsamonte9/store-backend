export function errorModal(response) {
  const html = `
    <div class="js-modal-overlay modal-overlay">
      <div class="warning-modal-content-container">
        <div class="modal-content">
          <div class="modal-header">
            <div></div>
            <div class="js-modal-close-button modal-close-button">X</div>
          </div>

          <div class="modal-body">
            <div class="warning-modal-body">
              <div class="error-logo-container logo-container">
                <img src="./error-logo.png" class="warning-logo">
              </div>
              <div class="warning-title">
                Error
              </div>
              <div class="warning-subtitle">
                ${response}
              </div>
            </div>
          </div>
          
          <div class="warning-modal-footer">
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  const overlayDOM = document.querySelector('.js-modal-overlay');
  const closeButton = overlayDOM.querySelector('.js-modal-close-button');

  setTimeout(() => {
    overlayDOM.remove();
  }, 3000);

  closeButton.addEventListener('click', () => overlayDOM.remove());
}