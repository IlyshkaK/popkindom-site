document.querySelectorAll("a[href='#']").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
  });
});

const burgerBtn = document.getElementById("burgerBtn");
const mobileMenu = document.getElementById("mobileMenu");

if (burgerBtn && mobileMenu) {
  burgerBtn.addEventListener("click", () => {
    burgerBtn.classList.toggle("open");
    mobileMenu.classList.toggle("open");
  });
}