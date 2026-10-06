// ca-work-grid.js — <ca-work-grid>: plays a card's reveal video while the card
// is hovered or focused, and pauses it afterwards. The reveal itself (fade and
// zoom) is pure CSS, so cards without a video need no script at all.

class CaWorkGrid extends HTMLElement {
  connectedCallback() {
    this.querySelectorAll('.ca-wcard').forEach((card) => {
      const video = card.querySelector('.ca-wcard__video');
      if (!video) return;
      const play = () => {
        const attempt = video.play();
        if (attempt && attempt.catch) attempt.catch(() => {});
      };
      const pause = () => video.pause();
      card.addEventListener('pointerenter', play);
      card.addEventListener('pointerleave', pause);
      card.addEventListener('focusin', play);
      card.addEventListener('focusout', (event) => {
        if (!card.contains(event.relatedTarget)) pause();
      });
    });
  }
}

if (!customElements.get('ca-work-grid')) {
  customElements.define('ca-work-grid', CaWorkGrid);
}
