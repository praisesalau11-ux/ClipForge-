const menu = document.getElementById("menu");
const links = document.getElementById("links");

menu.onclick = () => {
  const open = links.classList.toggle("open");
  menu.setAttribute("aria-expanded", open);
};
links.querySelectorAll("a").forEach((a) => {
  a.onclick = () => {
    links.classList.remove("open");
    menu.setAttribute("aria-expanded", "false");
  };
});
document.getElementById("year").textContent = new Date().getFullYear();