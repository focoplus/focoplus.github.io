/* Foco+ · perfil compartido
   Cada módulo carga este archivo ANTES que su propio código. Hace dos cosas:
   1) Guarda los datos del módulo bajo el perfil elegido en el menú (p:<perfil>:<clave>),
      así cada persona tiene su propio progreso sin cambiar el código del módulo.
   2) Agrega arriba un botón para volver al menú de Foco+. */
(function () {
  var sc = document.currentScript;
  var modulo = (sc && sc.getAttribute('data-modulo')) || '';
  var store = window.localStorage;
  var SP = Storage.prototype, g = SP.getItem, s = SP.setItem, r = SP.removeItem;
  var perfil = null;
  try {
    var cur = g.call(store, 'fp.cur');
    var lista = JSON.parse(g.call(store, 'fp.profiles') || '[]');
    for (var i = 0; i < lista.length; i++) if (lista[i].id === cur) perfil = lista[i];
  } catch (e) {}

  var prefijo = 'p:' + (perfil ? perfil.id : '_sin-perfil') + ':';
  function clave(k) { k = String(k); return k.indexOf('fp.') === 0 ? k : prefijo + k; }
  SP.getItem = function (k) { return this === store ? g.call(this, clave(k)) : g.call(this, k); };
  SP.setItem = function (k, v) { return this === store ? s.call(this, clave(k), v) : s.call(this, k, v); };
  SP.removeItem = function (k) { return this === store ? r.call(this, clave(k)) : r.call(this, k); };

  // Sin perfil elegido: volver al menú para elegir uno
  if (!perfil) { document.documentElement.style.visibility = 'hidden'; location.replace('../'); return; }
  window.FOCO_PERFIL = perfil;

  // Inglés tiene sus propios "jugadores": se reemplazan por el perfil de Foco+
  if (modulo === 'english') {
    var P = { cur: 'main', list: [] };
    try { var prev = JSON.parse(g.call(store, prefijo + 'focoEnglishProfiles') || 'null'); if (prev) P = prev; } catch (e) {}
    P.cur = 'main';
    P.list = [{ id: 'main', name: perfil.name, c: perfil.c || 0, age: perfil.age }];
    try { s.call(store, prefijo + 'focoEnglishProfiles', JSON.stringify(P)); } catch (e) {}
    // El botón "cambiar jugador" de Inglés ahora lleva al menú de perfiles de Foco+
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('#who')) { e.preventDefault(); e.stopPropagation(); location.href = '../'; }
    }, true);
  }

  // Barra para volver al menú
  function barra() {
    var css = document.createElement('style');
    css.textContent =
      '.fp-bar{display:flex;align-items:center;gap:10px;padding:10px 0 4px;width:min(560px,calc(100vw - 32px));margin:0 auto;font:700 15px/1.2 "Atkinson Hyperlegible",system-ui,sans-serif}' +
      '.fp-bar a{display:inline-flex;align-items:center;gap:6px;padding:7px 12px 7px 8px;border-radius:99px;text-decoration:none;color:inherit;' +
      'background:color-mix(in srgb,currentColor 8%,transparent);border:1px solid color-mix(in srgb,currentColor 18%,transparent)}' +
      '.fp-bar a svg{width:18px;height:18px}.fp-bar span{opacity:.7;margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';
    document.head.appendChild(css);
    var d = document.createElement('div');
    d.className = 'fp-bar';
    d.innerHTML = '<a href="../" aria-label="Volver al menú de Foco+"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>Foco+</a>';
    var n = document.createElement('span'); n.textContent = (function(x){x=String(x||'').trim();return x.charAt(0).toUpperCase()+x.slice(1)})(perfil.name); d.appendChild(n);
    document.body.insertBefore(d, document.body.firstChild);
  }
  if (document.body) barra(); else document.addEventListener('DOMContentLoaded', barra);

  // iPhone/iPad: evitar que la pantalla se agrande sola al tocar un campo de texto
  // (el zoom con dos dedos sigue funcionando; en Android no se toca nada)
  var esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  function sinZoom() { var m = document.querySelector('meta[name=viewport]'); if (m && m.content.indexOf('maximum-scale') < 0) m.content += ',maximum-scale=1'; }
  if (esIOS) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sinZoom); else sinZoom(); }

  // Finanzas: protegido con un PIN personal de 4 números
  if (modulo === 'finanzas') candado(perfil, store, g, s, r, prefijo);

  // Recordatorio en el calendario: se ofrece una sola vez, al tercer día de uso del módulo
  if (recInfo()[modulo]) recordatorio(modulo, perfil, store, g, s);
})();

/* ================= PIN de Finanzas =================
   El PIN se guarda cifrado (hash), nunca como número. Mientras está bloqueado,
   el contenido del módulo queda oculto. Se vuelve a bloquear al salir de la app
   por más de 1 minuto. */
function candado(perfil, store, g, s, r, prefijo) {
  var KPIN = 'fp.pin.' + perfil.id, KFAIL = 'fp.pinfail.' + perfil.id;
  var root = document.documentElement;
  root.classList.add('fp-locked');
  var css = document.createElement('style');
  css.textContent =
    'html.fp-locked{overflow:hidden}html.fp-locked body>*:not(#fp-lock){visibility:hidden!important}' +
    '#fp-lock{position:fixed;inset:0;z-index:2147483000;background:#16213A;color:#F3F5F4;display:flex;flex-direction:column;align-items:center;' +
    'justify-content:center;gap:18px;padding:calc(20px + env(safe-area-inset-top,0px)) 20px calc(20px + env(safe-area-inset-bottom,0px));' +
    'font:400 17px/1.4 "Atkinson Hyperlegible",system-ui,sans-serif;text-align:center;overflow:auto}' +
    'html:not(.fp-locked) #fp-lock{display:none}' +
    '#fp-lock .ic{width:64px;height:64px;border-radius:18px;background:#B7791F;display:grid;place-items:center}#fp-lock .ic svg{width:34px;height:34px}' +
    '#fp-lock h1{margin:0;font:800 26px/1.15 "Bricolage Grotesque",system-ui,sans-serif;letter-spacing:-.01em}' +
    '#fp-lock p{margin:0;max-width:300px;color:#C2CBD4;font-size:16px}#fp-lock p.err{color:#FF9C8F;font-weight:700;min-height:22px}' +
    '#fp-lock .dots{display:flex;gap:16px}#fp-lock .dots i{width:16px;height:16px;border-radius:50%;border:2px solid #C2CBD4}' +
    '#fp-lock .dots i.on{background:#F5BF2A;border-color:#F5BF2A}#fp-lock .dots.shake{animation:fpshake .35s}' +
    '@keyframes fpshake{20%,60%{transform:translateX(-10px)}40%,80%{transform:translateX(10px)}}' +
    '#fp-lock .pad{display:grid;grid-template-columns:repeat(3,76px);gap:14px}' +
    '#fp-lock .pad button{height:76px;border-radius:50%;border:0;background:rgba(255,255,255,.09);color:inherit;font:800 28px "Bricolage Grotesque",system-ui,sans-serif;cursor:pointer}' +
    '#fp-lock .pad button:active{background:rgba(255,255,255,.22)}#fp-lock .pad button:disabled{opacity:.35}' +
    '#fp-lock .pad .x{background:none;font-size:15px;font-family:inherit;font-weight:700}' +
    '#fp-lock .links{display:flex;gap:18px;flex-wrap:wrap;justify-content:center}' +
    '#fp-lock .links a,#fp-lock .links button{color:#7FD8CB;background:none;border:0;font-weight:700;font-size:15px;font-family:inherit;text-decoration:underline;cursor:pointer;padding:6px}' +
    '#fp-lock .warn{background:rgba(255,156,143,.12);border:1px solid #FF9C8F;border-radius:14px;padding:14px;max-width:320px;display:grid;gap:10px}' +
    '#fp-lock .warn p{color:#F3F5F4}#fp-lock .btn{min-height:50px;border-radius:14px;border:0;font:800 17px "Bricolage Grotesque",system-ui,sans-serif;cursor:pointer;padding:0 18px}' +
    '#fp-lock .btn.rojo{background:#E8746A;color:#2A0C08}#fp-lock .btn.gris{background:rgba(255,255,255,.12);color:#F3F5F4}';
  document.head.appendChild(css);

  var lock, modo = '', buf = '', primero = '', aviso = '', esperando = 0;
  var tienePin = function () { return !!g.call(store, KPIN); };

  function hash(pin) {
    var txt = 'foco+|' + perfil.id + '|' + pin;
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)).then(function (b) {
        return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      });
    }
    var h = 5381; for (var i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0;
    return Promise.resolve('d' + (h >>> 0).toString(16));
  }
  function fallos() { try { return JSON.parse(g.call(store, KFAIL) || '{"n":0,"hasta":0}'); } catch (e) { return { n: 0, hasta: 0 }; } }
  function setFallos(f) { try { s.call(store, KFAIL, JSON.stringify(f)); } catch (e) {} }

  var TXT = {
    crear: ['Crea tu PIN', 'Elige 4 números para proteger tus finanzas. Te lo pediremos cada vez que entres.'],
    confirmar: ['Repite tu PIN', 'Escríbelo otra vez para confirmar.'],
    entrar: ['Foco Finanzas', 'Hola, ' + perfil.name + '. Ingresa tu PIN.'],
    actual: ['Cambiar PIN', 'Primero ingresa tu PIN actual.']
  };

  function pintar() {
    if (!lock) return;
    if (modo === 'olvide') {
      lock.innerHTML = icono() + '<h1>¿Olvidaste tu PIN?</h1>' +
        '<div class="warn"><p>Para crear un PIN nuevo hay que <b>borrar los datos de Finanzas de ' + escapar(perfil.name) + '</b>. ' +
        'Los demás módulos no se tocan. Si tienes un respaldo, después puedes restaurarlo desde el menú.</p>' +
        '<button class="btn rojo" data-k="reset">Borrar y crear PIN nuevo</button><button class="btn gris" data-k="volver">Cancelar</button></div>';
      return;
    }
    var t = TXT[modo];
    var bloqueado = esperando > 0;
    var dots = ''; for (var i = 0; i < 4; i++) dots += '<i class="' + (i < buf.length ? 'on' : '') + '"></i>';
    var keys = ''; ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(function (k) { keys += '<button data-k="' + k + '"' + (bloqueado ? ' disabled' : '') + '>' + k + '</button>'; });
    keys += '<span></span><button data-k="0"' + (bloqueado ? ' disabled' : '') + '>0</button><button class="x" data-k="del" aria-label="Borrar">Borrar</button>';
    var links = '<a href="../">Volver a Foco+</a>';
    if (modo === 'entrar') links += '<button data-k="olvide">Olvidé mi PIN</button><button data-k="cambiar">Cambiar PIN</button>';
    if (modo === 'actual' || modo === 'confirmar') links += '<button data-k="cancelar">Cancelar</button>';
    lock.innerHTML = icono() + '<h1>' + t[0] + '</h1><p>' + escapar(t[1]) + '</p>' +
      '<div class="dots" aria-label="' + buf.length + ' de 4 números">' + dots + '</div>' +
      '<p class="err" role="alert">' + escapar(bloqueado ? 'Demasiados intentos. Espera ' + esperando + ' s.' : aviso) + '</p>' +
      '<div class="pad">' + keys + '</div><div class="links">' + links + '</div>';
  }
  function icono() { return '<div class="ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div>'; }
  function escapar(x) { return String(x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function sacudir(msg) { aviso = msg; buf = ''; pintar(); var d = lock.querySelector('.dots'); if (d) { d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); } if (navigator.vibrate) navigator.vibrate(120); }
  function abrir() { root.classList.remove('fp-locked'); buf = ''; aviso = ''; }
  function bloquear() { modo = tienePin() ? 'entrar' : 'crear'; buf = ''; primero = ''; aviso = ''; root.classList.add('fp-locked'); pintar(); }

  function cuentaRegresiva() {
    var f = fallos(); esperando = Math.max(0, Math.ceil((f.hasta - Date.now()) / 1000));
    pintar(); if (esperando > 0) setTimeout(cuentaRegresiva, 1000);
  }

  function completo() {
    var pin = buf;
    if (modo === 'crear') { primero = pin; modo = 'confirmar'; buf = ''; aviso = ''; pintar(); return; }
    if (modo === 'confirmar') {
      if (pin !== primero) { modo = 'crear'; primero = ''; sacudir('No coinciden. Inténtalo de nuevo.'); return; }
      hash(pin).then(function (h) { s.call(store, KPIN, h); setFallos({ n: 0, hasta: 0 }); abrir(); });
      return;
    }
    hash(pin).then(function (h) {
      if (h === g.call(store, KPIN)) {
        setFallos({ n: 0, hasta: 0 });
        if (modo === 'actual') { modo = 'crear'; buf = ''; aviso = ''; TXT.crear[0] = 'Elige tu PIN nuevo'; pintar(); }
        else abrir();
      } else {
        var f = fallos(); f.n++;
        if (f.n >= 5) { f.hasta = Date.now() + 30000 * (f.n - 4); setFallos(f); buf = ''; aviso = ''; cuentaRegresiva(); return; }
        setFallos(f); sacudir('PIN incorrecto.');
      }
    });
  }

  function tecla(k) {
    if (esperando > 0 && /^\d$|del/.test(k)) return;
    if (/^\d$/.test(k)) { if (buf.length < 4) { buf += k; aviso = ''; pintar(); if (buf.length === 4) setTimeout(completo, 120); } return; }
    if (k === 'del') { buf = buf.slice(0, -1); pintar(); return; }
    if (k === 'olvide') { modo = 'olvide'; pintar(); return; }
    if (k === 'cambiar') { modo = 'actual'; buf = ''; aviso = ''; pintar(); return; }
    if (k === 'cancelar' || k === 'volver') { bloquear(); return; }
    if (k === 'reset') {
      // borra solo los datos de Finanzas de este perfil y su PIN
      r.call(store, prefijo + 'foco-plata-v1'); r.call(store, prefijo + 'foco-plata-view');
      r.call(store, KPIN); r.call(store, KFAIL);
      location.reload();
    }
  }

  function montar() {
    lock = document.createElement('div'); lock.id = 'fp-lock'; lock.setAttribute('role', 'dialog'); lock.setAttribute('aria-modal', 'true');
    document.body.appendChild(lock);
    lock.addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (b) { e.preventDefault(); tecla(b.getAttribute('data-k')); } });
    document.addEventListener('keydown', function (e) {
      if (!root.classList.contains('fp-locked')) return;
      if (/^\d$/.test(e.key)) { e.preventDefault(); tecla(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); tecla('del'); }
    }, true);
    bloquear(); cuentaRegresiva();
  }
  if (document.body) montar(); else document.addEventListener('DOMContentLoaded', montar);

  // Se vuelve a bloquear si sales de la app por más de 1 minuto
  var oculto = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) oculto = Date.now();
    else if (oculto && Date.now() - oculto > 60000 && !root.classList.contains('fp-locked')) bloquear();
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted) bloquear(); });
}

/* ================= Recordatorio en el calendario =================
   Una PWA no puede avisar de forma confiable con la app cerrada; el calendario del teléfono sí.
   - Se ofrece UNA vez por módulo, en una línea chica abajo, el tercer día distinto que se usa.
   - "No, gracias" la oculta para siempre. Siempre queda un enlace discreto al final de la página.
   - Android: abre Google Calendar con el evento listo. iPhone y otros: archivo .ics (Calendario lo abre).
   Nada se envía a internet desde Foco+. */
function recInfo() { return {
  english:   { t: 'Inglés',    min: 10 },
  lectura:   { t: 'Lectura',   min: 20 },
  ejercicio: { t: 'Ejercicio', min: 30 },
  foco:      { t: 'Foco',      min: 25 },
  sql:       { t: 'SQL',       min: 10 },
  memoria:   { t: 'Memoria',   min: 5 }
}; }
function recordatorio(modulo, perfil, store, g, s) {
  var K = 'fp.cal.' + perfil.id + '.' + modulo, st = {};
  try { st = JSON.parse(g.call(store, K) || '{}') || {}; } catch (e) {}
  var hoy = new Date().toLocaleDateString('en-CA');
  st.days = st.days || [];
  if (st.days.indexOf(hoy) < 0 && st.days.length < 3) st.days.push(hoy);
  function guardar() { try { s.call(store, K, JSON.stringify(st)); } catch (e) {} }
  guardar();
  var info = recInfo()[modulo];
  var oscuro = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  var C = oscuro ? { bg: '#1B2334', ink: '#F2F4F8', mu: '#A7B0C2', line: '#2E3A54', ac: '#4FB6DA', bgp: '#121826' }
                 : { bg: '#FFFFFF', ink: '#14202B', mu: '#566573', line: '#D9E1E7', ac: '#0F7FA6', bgp: '#F3F6F8' };
  var css = document.createElement('style');
  css.textContent =
    '.fp-cal{position:fixed;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:9998;max-width:540px;margin:0 auto;background:' + C.bg + ';color:' + C.ink + ';border:1px solid ' + C.line + ';border-radius:16px;padding:10px 12px;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,.28);font:14px/1.3 system-ui,sans-serif}' +
    '.fp-cal span{flex:1}.fp-cal button{background:none;border:0;font:inherit;padding:8px 6px;cursor:pointer;white-space:nowrap}' +
    '.fp-cal .si{color:' + C.ac + ';font-weight:800}.fp-cal .no{color:' + C.mu + '}' +
    '.fp-calk{display:block;margin:28px auto 8px;background:none;border:0;color:' + C.mu + ';font:600 13px system-ui,sans-serif;text-decoration:underline;cursor:pointer}' +
    '.fp-cs{position:fixed;inset:0;z-index:9999;background:rgba(5,10,18,.55);display:flex;align-items:flex-end;justify-content:center}' +
    '.fp-cs .in{background:' + C.bgp + ';color:' + C.ink + ';width:min(600px,100vw);border-radius:24px 24px 0 0;padding:20px 16px calc(22px + env(safe-area-inset-bottom));display:grid;gap:12px;font:15px/1.4 system-ui,sans-serif;max-height:90vh;overflow:auto}' +
    '.fp-cs h3{margin:0;font-size:22px}.fp-cs p{margin:0;color:' + C.mu + '}.fp-cs .lb{font:800 12px system-ui;letter-spacing:.08em;text-transform:uppercase;color:' + C.mu + '}' +
    '.fp-cs .ds{display:flex;gap:6px}.fp-cs .ds button{flex:1;padding:11px 0;border-radius:12px;font:800 15px system-ui;border:1px solid ' + C.line + ';background:' + C.bg + ';color:' + C.mu + '}' +
    '.fp-cs .ds button[aria-pressed=true]{background:' + C.ac + ';border-color:' + C.ac + ';color:' + (oscuro ? '#08131C' : '#fff') + '}' +
    '.fp-cs input,.fp-cs select{font:800 20px system-ui;padding:10px;border-radius:12px;border:1px solid ' + C.line + ';background:' + C.bg + ';color:' + C.ink + ';width:100%}' +
    '.fp-cs .r{display:flex;gap:10px}.fp-cs .r>div{flex:1;display:grid;gap:6px}' +
    '.fp-cs .go{border:0;border-radius:16px;padding:15px;font:800 17px system-ui;background:' + C.ac + ';color:' + (oscuro ? '#08131C' : '#fff') + ';cursor:pointer}' +
    '.fp-cs .sec{border:1px solid ' + C.line + ';background:transparent;color:' + C.ink + ';border-radius:16px;padding:13px;font:700 15px system-ui;cursor:pointer}' +
    '.fp-cs .x{background:none;border:0;color:' + C.mu + ';font:600 14px system-ui;text-decoration:underline;cursor:pointer}';
  function listo(fn) { if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn); }
  listo(function () {
    document.head.appendChild(css);
    // Enlace permanente y discreto al final de la página
    var k = document.createElement('button'); k.className = 'fp-calk'; k.type = 'button';
    k.textContent = 'Recordatorio en mi calendario'; k.onclick = hoja;
    document.body.appendChild(k);
    // Ofrecimiento único
    if (st.days.length >= 3 && !st.r) setTimeout(function () {
      var d = document.createElement('div'); d.className = 'fp-cal'; d.setAttribute('role', 'status');
      d.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="' + C.ac + '" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>' +
        '<span>¿Quieres que tu calendario te lo recuerde?</span><button class="si" type="button">Sí</button><button class="no" type="button">No, gracias</button>';
      d.querySelector('.si').onclick = function () { st.r = 'si'; guardar(); d.remove(); hoja(); };
      d.querySelector('.no').onclick = function () { st.r = 'no'; guardar(); d.remove(); };
      document.body.appendChild(d);
    }, 2500);
  });
  function hoja() {
    var dias = [1, 2, 3, 4, 5], L = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    var w = document.createElement('div'); w.className = 'fp-cs';
    w.innerHTML = '<div class="in" role="dialog" aria-modal="true" aria-label="Recordatorio en el calendario">' +
      '<h3>Recordatorio en mi calendario</h3><p>Elige un momento fijo del día. Tu calendario te avisa aunque Foco+ esté cerrado.</p>' +
      '<div class="lb">Días</div><div class="ds">' + L.map(function (x, i) { var n = i + 1; return '<button type="button" data-d="' + n + '" aria-pressed="' + (dias.indexOf(n) >= 0) + '" aria-label="' + ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'][i] + '">' + x + '</button>'; }).join('') + '</div>' +
      '<div class="r"><div><span class="lb">Hora</span><input type="time" id="fpc-h" value="08:30"></div>' +
      '<div><span class="lb">Duración</span><select id="fpc-m">' + [5, 10, 15, 20, 25, 30, 45, 60].map(function (m) { return '<option value="' + m + '"' + (m === info.min ? ' selected' : '') + '>' + m + ' min</option>'; }).join('') + '</select></div></div>' +
      '<button class="go" type="button" id="fpc-go">Agregar al calendario</button>' +
      (esAndroid() ? '<button class="sec" type="button" id="fpc-ics">Prefiero descargar el archivo (.ics)</button>' : '') +
      '<p style="text-align:center;font-size:13px">Se abre tu calendario con el evento listo. Foco+ no envía nada a internet.</p>' +
      '<button class="x" type="button" id="fpc-x">Cerrar</button></div>';
    document.body.appendChild(w);
    w.onclick = function (e) {
      if (e.target === w || e.target.id === 'fpc-x') return w.remove();
      var b = e.target.closest && e.target.closest('[data-d]');
      if (b) { var n = +b.dataset.d, i = dias.indexOf(n); if (i >= 0) { if (dias.length > 1) dias.splice(i, 1); } else dias.push(n); b.setAttribute('aria-pressed', dias.indexOf(n) >= 0); return; }
      if (e.target.id === 'fpc-go' || e.target.id === 'fpc-ics') {
        var h = (document.getElementById('fpc-h').value || '08:30').split(':'), m = +document.getElementById('fpc-m').value || info.min;
        var ev = evento(info.t, dias.slice().sort(), +h[0], +h[1], m);
        if (esAndroid() && e.target.id === 'fpc-go') window.open(ev.google, '_blank');
        else descargarICS(ev.ics, 'foco-' + modulo + '.ics');
        st.r = 'si'; guardar(); w.remove();
      }
    };
  }
}
function esAndroid() { return /android/i.test(navigator.userAgent); }
function evento(titulo, dias, hh, mm, min) {
  var BY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  var d = new Date(); d.setSeconds(0, 0); d.setHours(hh, mm);
  // primer día elegido desde hoy (si hoy ya pasó la hora, desde mañana)
  for (var i = 0; i < 8; i++) { var dow = ((d.getDay() + 6) % 7) + 1; if (dias.indexOf(dow) >= 0 && d > new Date()) break; d.setDate(d.getDate() + 1); d.setHours(hh, mm); }
  var fin = new Date(d.getTime() + min * 60000);
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  var f = function (x) { return x.getFullYear() + p(x.getMonth() + 1) + p(x.getDate()) + 'T' + p(x.getHours()) + p(x.getMinutes()) + '00'; };
  var rr = 'RRULE:FREQ=WEEKLY;BYDAY=' + dias.map(function (n) { return BY[n - 1]; }).join(',');
  var txt = titulo + ' · ' + min + ' min (Foco+)', det = 'Abre Foco+ y haz ' + min + ' min de ' + titulo.toLowerCase() + '. Aunque sea un poco, cuenta.';
  var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var google = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(txt) +
    '&details=' + encodeURIComponent(det) + '&dates=' + f(d) + '/' + f(fin) + (tz ? '&ctz=' + encodeURIComponent(tz) : '') + '&recur=' + encodeURIComponent(rr);
  var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Foco+//ES', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    'UID:' + Date.now() + '-' + Math.random().toString(36).slice(2) + '@focoplus', 'DTSTAMP:' + f(new Date()), 'DTSTART:' + f(d), 'DTEND:' + f(fin), rr,
    'SUMMARY:' + txt, 'DESCRIPTION:' + det, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + txt, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return { google: google, ics: ics };
}
function descargarICS(txt, nombre) {
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  if (ios) { location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(txt); return; }
  var url = URL.createObjectURL(new Blob([txt], { type: 'text/calendar' }));
  var a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
}
