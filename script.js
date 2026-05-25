document.querySelectorAll("a[href='#']").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
  });
});