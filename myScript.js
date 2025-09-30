
document.addEventListener('DOMContentLoaded', function () {
  var toggleBtn = document.querySelector('.menu-toggle');
  var navLinks = document.querySelector('.nav-links');
  if (!toggleBtn || !navLinks) return;

  toggleBtn.addEventListener('click', function () {
    var isOpen = navLinks.classList.toggle('is-open');
    toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
});


document.addEventListener('DOMContentLoaded', function () {

  
  var searchBar = document.querySelector('.search-bar');
  var searchToggle = document.querySelector('.search-toggle');
  var firstInput = searchBar ? searchBar.querySelector('input') : null;
  if (!searchBar || !searchToggle) return;

  searchToggle.addEventListener('click', function () {
    var open = searchBar.classList.toggle('is-open');
    searchToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && firstInput) firstInput.focus();
  });
});

const booking = document.getElementById("boka");
const boka = document.getElementById("book");
const login = document.getElementById("inloggning");

if (booking) {
  booking.addEventListener('click', function () {
    window.location.href = "bokning.html";
  });
}

if (boka) {
  boka.addEventListener('click', function () {
    window.location.href = "bokning.html";
  });
}

if (login) {
  login.addEventListener('click', function () {
    window.location.href = "login.html";
  });
}
