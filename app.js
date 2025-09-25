(function(){
  function isLoggedIn(){
    try { return localStorage.getItem('bdtLoggedIn') === '1'; } catch(e) { return false; }
  }
  function setLoggedIn(flag){
    try {
      if(flag) localStorage.setItem('bdtLoggedIn', '1');
      else localStorage.removeItem('bdtLoggedIn');
    } catch(e){}
  }
  function applyUI(){
    const logged = isLoggedIn();
    document.documentElement.classList.toggle('is-logged-in', logged);

    document.querySelectorAll('[data-auth]')?.forEach(el => {
      const want = el.getAttribute('data-auth');
      const show = (want === 'user' && logged) || (want === 'guest' && !logged);
      el.style.display = show ? '' : 'none';
    });

    const loginBtn = document.getElementById('inloggning');
    if(loginBtn) loginBtn.style.display = logged ? 'none' : '';

    let logoutBtn = document.getElementById('logout');
    if(logged){
      if(!logoutBtn){
        logoutBtn = document.createElement('button');
        logoutBtn.id = 'logout';
        logoutBtn.textContent = 'Logga ut';
        logoutBtn.className = 'bdt-session-logout';
        (loginBtn?.parentElement || document.body).appendChild(logoutBtn);
      }
    } else {
      if(logoutBtn) logoutBtn.remove();
    }
  }


  document.addEventListener('click', (e)=>{
    const el = e.target.closest('#logout, [data-action="logout"]');
    if(!el) return;
    e.preventDefault();
    setLoggedIn(false);
    applyUI();
    // Optionally redirect to homepage root
    try { if(location.pathname.includes('login')) location.href = 'index.html'; } catch(e){}
  });

  // Expose small API if needed
  window.BDTSESSION = { isLoggedIn, setLoggedIn, applyUI };

  document.addEventListener('DOMContentLoaded', applyUI);
})();
