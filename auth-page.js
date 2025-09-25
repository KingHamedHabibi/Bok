// ===== Standalone Login Page Auth (auto-open + redirect) =====
(function(){
  const overlay = document.querySelector('.bdt-auth-overlay');
  const closeBtn = document.getElementById('bdtAuthClose');
  const tabs = document.querySelectorAll('.bdt-auth-tab');
  const forms = {
    login: document.getElementById('bdtLoginForm'),
    register: document.getElementById('bdtRegisterForm'),
  };

  function openModal(){ overlay?.classList.add('is-open'); }
  function closeModal(){ overlay?.classList.remove('is-open'); }

  // Auto-open on page load
  document.addEventListener('DOMContentLoaded', openModal);
  closeBtn?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', (e)=>{ if(e.target === overlay) closeModal(); });
  window.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeModal(); });

  // Tab switching
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabs.forEach(b => b.classList.toggle('is-active', b === btn));
      Object.entries(forms).forEach(([name, el]) => el.classList.toggle('is-hidden', name !== target));
    });
  });

  // Success handlers: set flag + redirect to homepage
  function goHome(){
    try { localStorage.setItem('bdtLoggedIn', '1'); } catch(e) {}
    const dest = new URLSearchParams(location.search).get('redirect') || 'index.html';
    location.href = dest;
  }

  forms.login?.addEventListener('submit', (e) => {
    e.preventDefault();
    // TODO: replace with real auth; for now accept any input
    goHome();
  });

  forms.register?.addEventListener('submit', (e) => {
    e.preventDefault();
    const p1 = document.getElementById('bdtRegPassword').value;
    const p2 = document.getElementById('bdtRegPassword2').value;
    if(p1 !== p2){
      alert('Lösenorden matchar inte.');
      return;
    }
    goHome();
  });
})();
