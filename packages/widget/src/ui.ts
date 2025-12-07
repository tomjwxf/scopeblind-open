export class WidgetUI {
  private badge: HTMLElement | null = null;
  private modal: HTMLElement | null = null;

  constructor() {
    this.injectStyles();
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .sb-badge {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #000;
        color: #fff;
        padding: 8px 12px;
        border-radius: 20px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 12px;
        z-index: 9999;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        gap: 6px;
        transition: transform 0.2s;
      }
      .sb-badge:hover {
        transform: translateY(-2px);
      }
      .sb-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
      }
      .sb-modal-overlay.visible {
        opacity: 1;
        pointer-events: auto;
      }
      .sb-modal {
        background: #fff;
        padding: 24px;
        border-radius: 12px;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        font-family: system-ui, -apple-system, sans-serif;
        transform: scale(0.9);
        transition: transform 0.2s;
      }
      .sb-modal-overlay.visible .sb-modal {
        transform: scale(1);
      }
      .sb-modal h2 {
        margin: 0 0 12px;
        font-size: 20px;
        font-weight: 600;
      }
      .sb-modal p {
        margin: 0 0 20px;
        color: #666;
        line-height: 1.5;
      }
      .sb-btn {
        display: block;
        width: 100%;
        padding: 10px;
        background: #000;
        color: #fff;
        border: none;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
        text-align: center;
        text-decoration: none;
      }
      .sb-btn:hover {
        background: #333;
      }
      .sb-close {
        position: absolute;
        top: 12px;
        right: 12px;
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #999;
      }
    `;
    document.head.appendChild(style);
  }

  showBadge() {
    if (this.badge) return;

    this.badge = document.createElement('div');
    this.badge.className = 'sb-badge';
    this.badge.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      Powered by ScopeBlind
    `;
    this.badge.onclick = () => window.open('https://scopeblind.com', '_blank');
    document.body.appendChild(this.badge);
  }

  showQuotaExceeded() {
    if (!this.modal) {
      this.createModal();
    }
    this.modal?.classList.add('visible');
  }

  private createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'sb-modal-overlay';
    this.modal.innerHTML = `
      <div class="sb-modal">
        <button class="sb-close">&times;</button>
        <h2>Trial Limit Reached</h2>
        <p>You've used your free trial actions. Verify your status to unlock more, or sign up for unlimited access.</p>
        <a href="https://scopeblind.com/verify" target="_blank" class="sb-btn">Verify Status</a>
      </div>
    `;

    this.modal?.querySelector('.sb-close')?.addEventListener('click', () => {
      this.modal?.classList.remove('visible');
    });

    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.modal?.classList.remove('visible');
      }
    });

    document.body.appendChild(this.modal);
  }
}
