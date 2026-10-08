// ca-work-grid.js — <ca-work-grid>: plays a card's reveal video while the card
// is hovered or focused, and pauses it afterwards. The reveal itself (fade and
// zoom) is pure CSS, so cards without a video need no script at all.

class CaWorkGrid extends HTMLElement {
  connectedCallback() {
    this.querySelectorAll('.ca-wcard').forEach((card) => {
      const video = card.querySelector('.ca-wcard__video');
      if (!video) return;
      const play = () => {
        video.dataset.playing = '1';
        // Chrome stalls play() on preload="none" videos that were hidden at
        // parse until load() runs once.
        if (video.readyState === 0 && !video.dataset.loaded) {
          video.dataset.loaded = '1';
          video.load();
        }
        const attempt = video.play();
        if (attempt && attempt.catch) attempt.catch(() => {});
      };
      const pause = () => {
        delete video.dataset.playing;
        video.pause();
      };
      card.addEventListener('pointerenter', play);
      card.addEventListener('pointerleave', pause);
      card.addEventListener('focusin', play);
      card.addEventListener('focusout', (event) => {
        if (!card.contains(event.relatedTarget)) pause();
      });
    });

    // Warm the first screen of reveal videos as the grid approaches; the rest
    // load on hover (see caWarmVideosNear in ca-custom.js).
    const videos = Array.from(this.querySelectorAll('.ca-wcard__video')).slice(0, 4);
    if (videos.length && window.caWarmVideosNear) window.caWarmVideosNear(this, videos, '100%');
  }
}

if (!customElements.get('ca-work-grid')) {
  customElements.define('ca-work-grid', CaWorkGrid);
}
