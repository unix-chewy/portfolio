/* Portfolio JavaScript */

// ============================================
/* GSAP SPRING ANIMATION (Apple-style)        */
/* ============================================ */

const wrapper = document.getElementById("cardsWrapper");
const cards = wrapper ? wrapper.querySelectorAll(".card") : [];

// GSAP spring animation for fluid carousel motion
gsap.to(wrapper, {
  x: -50,
  duration: 2.5,
  ease: "power1.inOut",
  repeat: -1,
  yoyo: true
});

// ============================================
/* HORIZONTAL CARD STREAM CLICK HANDLER       */
/* ============================================ */

const gallery = document.querySelector(".card-stream-container");

if (!gallery) {
  console.log("Card stream gallery not found");
} else {
  let downX = 0, downY = 0;

  gallery.addEventListener("pointerdown", (e) => {
    downX = e.clientX;
    downY = e.clientY;
  });

  gallery.addEventListener("click", (e) => {
    // Ignore clicks from within navigation controls (if any)
    if (e.target.closest(".nav-links") || e.target.closest(".footer-links")) return;

    // Ignore drags/swipes (movement since pointerdown)
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 10) return;

    const cardElements = gallery.querySelectorAll(".card");
    
    // Find the card closest to the horizontal center that is visible
    const centerX = window.innerWidth / 2;
    let best = null, bestDist = Infinity;

    cardElements.forEach((card) => {
      const opacity = parseFloat(card.style.opacity || 1);
      
      // Skip hidden or mid-transition cards (opacity < 0.75)
      if (opacity < 0.75) return;
      
      const r = card.getBoundingClientRect();
      const dist = Math.abs(r.left + r.width / 2 - centerX);
      
      if (dist < bestDist) {
        bestDist = dist;
        best = card;
      }
    });

    if (!best) return;
    
    const url = best.dataset.url;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  });

  // Keyboard navigation (optional: arrow keys pause/resume)
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      gsap.to(wrapper, { x: (wrapper.x || 0) - window.innerWidth * 0.5, duration: 1 });
    } else if (e.key === "ArrowRight") {
      gsap.to(wrapper, { x: (wrapper.x || 0) + window.innerWidth * 0.5, duration: 1 });
    }
  });
}

console.log("Portfolio scripts loaded");