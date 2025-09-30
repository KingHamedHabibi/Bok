(function(){
  var dialog = document.getElementById('mbk-dialog');
  if (!dialog) return;

  // Replace nodes to drop any previously attached listeners from inline script
  function byId(id){ return document.getElementById(id); }
  function cloneReplace(el){ if(!el) return el; var nx = el.cloneNode(true); el.replaceWith(nx); return nx; }

  var openBtn = byId('mbk-open-btn') || byId('booked') || (function(){
    var nodes = document.querySelectorAll('button, a');
    for (var i=0;i<nodes.length;i++){ var t=(nodes[i].textContent||'').trim().toLowerCase(); if(t==='mina bokningar') return nodes[i]; }
    return null;
  })();
  if (!openBtn) return;

  // Drop prior listeners (if any) by cloning
  dialog = cloneReplace(dialog);
  openBtn = cloneReplace(openBtn);
  var closeBtn = cloneReplace(byId('close'));
  var manageBtn = cloneReplace(byId('manage'));

  var listEl = byId('mbk-list');
  var emptyEl = byId('mbk-empty');
  var lastFocus = null;

  function readBookings(){
    if (Array.isArray(window.myBookings)) return window.myBookings;
    try {
      var raw = window.localStorage ? localStorage.getItem('my_bookings') : null;
      if (raw) { var parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed; }
    } catch(e){}
    try {
      var rawBdt = window.localStorage ? localStorage.getItem('bdt.bookings.v1') : null;
      if (rawBdt) { var parsedBdt = JSON.parse(rawBdt); if (Array.isArray(parsedBdt)) return parsedBdt; }
    } catch(e2){}
    return [];
  }

  function parseYMD(s){
    var m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(String(s||''));
    if (m) return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
    var d = new Date(s); return isNaN(d.getTime()) ? null : d;
  }
  function formatSv(d){
    try{
      return new Intl.DateTimeFormat('sv-SE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);
    }catch(e){ return d.toLocaleDateString('sv-SE'); }
  }

  function renderList(items){
    listEl.innerHTML='';
    if(!items || !items.length){ emptyEl.hidden=false; return; }
    emptyEl.hidden=true;
    items.forEach(function(b){
      var dateTxt='', timeTxt='', extra='';
      if(b && b.date){ var d=parseYMD(b.date); dateTxt = d ? formatSv(d) : String(b.date); }
      if(b && b.time){ timeTxt = String(b.time); }
      if(b && (b.name||b.service||b.tjanst)) extra = b.name||b.service||b.tjanst;
      if(b && (b.place||b.location||b.plats)) extra = extra ? (extra + ' - ' + (b.place||b.location||b.plats)) : (b.place||b.location||b.plats);

      var item=document.createElement('div');
      item.className='mbk-item';
      var primary=(dateTxt && timeTxt)? (dateTxt + ' - ' + timeTxt) : (dateTxt || timeTxt || '');
      if(primary){ var strong=document.createElement('strong'); strong.textContent=primary; item.appendChild(strong); }
      if(extra){ var small=document.createElement('small'); small.textContent=extra; item.appendChild(small); }
      item.setAttribute('role','listitem');
      listEl.appendChild(item);
    });
  }

  function openModal(){ lastFocus=document.activeElement; renderList(readBookings()); dialog.showModal(); }
  function closeModal(){ dialog.close(); }

  openBtn.addEventListener('click', function(){ openModal(); });
  closeBtn && closeBtn.addEventListener('click', closeModal);
  manageBtn && manageBtn.addEventListener('click', function(){ window.location.href='bokning.html'; });
  dialog.addEventListener('cancel', function(e){ e.preventDefault(); closeModal(); });
  dialog.addEventListener('close', function(){ if(lastFocus && lastFocus.focus) setTimeout(function(){ lastFocus.focus(); },0); });
  dialog.addEventListener('click', function(e){ if(e.target === dialog) closeModal(); });
})();
