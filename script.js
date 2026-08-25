/* =========================================================
   LOF — script.js — JavaScript puro (sem dependências)
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Menu mobile ---------- */
  var toggle = document.querySelector('.menu-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var isOpen = links.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Marca o link ativo pela URL atual ---------- */
  var here = (location.pathname.split('/').pop() || 'index.html');
  document.querySelectorAll('.nav-links a[href]').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href === here || (here === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  /* ---------- Header sombra ao rolar ---------- */
  var navbar = document.querySelector('.navbar');
  if (navbar) {
    var onScroll = function () {
      navbar.style.boxShadow = window.scrollY > 6 ? '0 2px 14px rgba(6,21,41,.08)' : 'none';
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Ano do rodapé ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* =========================================================
     Campo de correntes — animação de partículas em canvas
     Simula linhas de fluxo (streamlines) de correntes oceânicas
     usando um campo vetorial simples baseado em senos/cossenos.
     ========================================================= */
  function initCurrentField(canvas) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var W, H, DPR;
    var particles = [];
    var eddies = [];
    var N = 110;
    var t = 0;

    /* -----------------------------------------------------------
       Campo vetorial da Corrente do Brasil (esquemático):
       - corrente de contorno oeste fluindo para o sul, colada à
         costa (jato mais forte perto da costa, decaindo mar afora)
       - retorno fraco e largo no interior do giro subtropical,
         predominantemente para o norte (balanço de Sverdrup)
       - meandros que crescem com a latitude e vórtices de
         mesoescala que se desprendem ao sul (~ altura de
         Cabo Frio/Cabo de São Tomé), como observado na Corrente
         do Brasil real
       ----------------------------------------------------------- */
    function coastX(y) {
      var yn = y / H;
      var growth = Math.pow(yn, 1.15); // meandros crescem para o sul
      var base = W * 0.12 + W * 0.09 * Math.sin(yn * Math.PI * 1.3 + 0.4);
      var meander = growth * W * 0.075 * Math.sin(yn * 9 - t * 1.0);
      return base + meander;
    }

    function field(x, y) {
      var yn = y / H;
      var eps = 3;
      var cxp = coastX(y + eps);
      var cxm = coastX(y - eps);
      var tx = cxp - cxm, ty = 2 * eps;
      var tlen = Math.hypot(tx, ty) || 1;
      var tux = tx / tlen, tuy = ty / tlen; // tangente à costa, sentido sul

      var d = x - coastX(y); // distância à costa (+ = mar aberto)
      if (d < -6) return null; // dentro do continente — sem corrente

      // jato costeiro: forte junto à costa, decai mar afora
      var jetStrength = Math.exp(-Math.max(d, 0) / (W * 0.15));
      var vx = tux * jetStrength * 1.7;
      var vy = tuy * jetStrength * 1.7;

      // retorno de interior do giro: fraco, largo, sentido norte
      var interior = Math.min(Math.max((d - W * 0.12) / (W * 0.55), 0), 1);
      vy += -0.32 * interior;
      vx += 0.06 * Math.sin(yn * 6 + t * 0.3) * interior;

      // vórtices de mesoescala (anéis quentes/frios) ao sul da zona de instabilidade
      for (var i = 0; i < eddies.length; i++) {
        var e = eddies[i];
        var dx = x - e.x, dy = y - e.y;
        var r2 = dx * dx + dy * dy;
        var r = Math.sqrt(r2) + 1;
        var influence = Math.exp(-r2 / (e.radius * e.radius));
        var rot = e.sign * influence * e.strength;
        vx += (-dy / r) * rot;
        vy += (dx / r) * rot;
      }

      return { vx: vx, vy: vy, jet: jetStrength, interior: interior };
    }

    function seedEddies() {
      eddies = [];
      for (var i = 0; i < 3; i++) spawnEddy(true);
    }

    function spawnEddy(initial) {
      var yn = 0.5 + Math.random() * 0.42; // desprendem-se na metade sul do campo
      var y = yn * H;
      var cx = coastX(y);
      eddies.push({
        x: cx + W * (0.14 + Math.random() * 0.22),
        y: initial ? y : -30,
        radius: W * (0.09 + Math.random() * 0.06),
        strength: 0.55 + Math.random() * 0.5,
        sign: Math.random() > 0.5 ? 1 : -1,
        drift: 0.35 + Math.random() * 0.25
      });
    }

    function stepEddies() {
      for (var i = eddies.length - 1; i >= 0; i--) {
        var e = eddies[i];
        e.y += e.drift;
        e.x += Math.sin(t * 0.6 + i) * 0.06;
        if (e.y - e.radius > H) {
          eddies.splice(i, 1);
          spawnEddy(false);
        }
      }
    }

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function seed() {
      particles = [];
      for (var i = 0; i < N; i++) particles.push(freshParticle());
    }

    function freshParticle() {
      var y = Math.random() * H;
      var cx = coastX(y);
      // concentra partículas perto da costa (jato) com uma franja no interior
      var offshore = Math.pow(Math.random(), 1.8) * W * 0.6;
      return {
        x: Math.min(cx + 8 + offshore, W - 4),
        y: y,
        life: 50 + Math.random() * 140,
        age: Math.random() * 140
      };
    }

    function drawLand() {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (var y = 0; y <= H; y += 6) ctx.lineTo(coastX(y), y);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fillStyle = '#040d1a';
      ctx.fill();
      ctx.strokeStyle = 'rgba(34,184,176,0.3)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    function step() {
      ctx.fillStyle = 'rgba(6,21,41,0.14)';
      ctx.fillRect(0, 0, W, H);
      drawLand();
      stepEddies();

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var v = field(p.x, p.y);

        if (!v) { particles[i] = freshParticle(); continue; }

        var nx = p.x + v.vx;
        var ny = p.y + v.vy;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        var alpha = Math.min(0.85, 0.22 + v.jet * 0.7);
        if (v.interior > 0.15) {
          ctx.strokeStyle = 'rgba(126,163,204,' + (alpha * 0.7) + ')'; // retorno frio de interior
        } else {
          ctx.strokeStyle = 'rgba(34,184,176,' + alpha + ')'; // jato quente da Corrente do Brasil
        }
        ctx.lineWidth = 1;
        ctx.stroke();

        p.x = nx; p.y = ny; p.age++;

        if (p.x < -20 || p.x > W + 20 || p.y < 0 || p.y > H || p.age > p.life) {
          particles[i] = freshParticle();
        }
      }
      t += 0.006;
    }

    resize();
    seedEddies();
    seed();

    if (reduceMotion) {
      // desenha um único frame estático e para
      ctx.fillStyle = '#061529';
      ctx.fillRect(0, 0, W, H);
      for (var k = 0; k < 60; k++) step();
      return;
    }

    var raf;
    function loop() { step(); raf = requestAnimationFrame(loop); }
    loop();

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resize();
        seedEddies();
        seed();
      }, 200);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { cancelAnimationFrame(raf); }
      else { loop(); }
    });
  }

  document.querySelectorAll('[data-current-field]').forEach(initCurrentField);

  /* =========================================================
     Filtro de projetos (projetos.html)
     ========================================================= */
  var filterBtns = document.querySelectorAll('.filter-btn[data-filter]');
  var projectRows = document.querySelectorAll('.project-row[data-tags]');
  if (filterBtns.length && projectRows.length) {
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var f = btn.getAttribute('data-filter');
        projectRows.forEach(function (row) {
          var tags = row.getAttribute('data-tags') || '';
          row.style.display = (f === 'todos' || tags.indexOf(f) > -1) ? '' : 'none';
        });
      });
    });
  }

  /* =========================================================
     Busca de publicações (publicacoes.html)
     ========================================================= */
  var pubSearch = document.getElementById('pub-search-input');
  var pubItems = document.querySelectorAll('.pub-item[data-search]');
  var pubEmpty = document.querySelector('.pub-empty');
  if (pubSearch && pubItems.length) {
    pubSearch.addEventListener('input', function () {
      var q = pubSearch.value.trim().toLowerCase();
      var visible = 0;
      pubItems.forEach(function (item) {
        var haystack = item.getAttribute('data-search').toLowerCase();
        var match = haystack.indexOf(q) > -1;
        item.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      if (pubEmpty) pubEmpty.style.display = visible === 0 ? 'block' : 'none';
    });
  }

  /* =========================================================
     Painel de Contato (drawer sobreposto)
     Abre por cima da página atual — sem navegar para outra URL —
     e fecha devolvendo o usuário exatamente de onde ele saiu
     (a página nunca é trocada, então a rolagem é preservada).
     ========================================================= */
  var drawer = document.getElementById('contact-drawer');
  var backdrop = document.getElementById('drawer-backdrop');
  var drawerClose = document.getElementById('drawer-close');
  var openTriggers = document.querySelectorAll('[data-open-contact]');
  var lastFocused = null;
  var scrollY = 0;

  function openDrawer(e) {
    if (e) e.preventDefault();
    if (!drawer || !backdrop) return;
    lastFocused = document.activeElement;

    scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.classList.add('drawer-locked');

    drawer.classList.add('open');
    backdrop.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    if (drawerClose) drawerClose.focus();

    document.addEventListener('keydown', onKeydown);
  }

  function closeDrawer() {
    if (!drawer || !backdrop) return;
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');

    document.body.classList.remove('drawer-locked');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    window.scrollTo(0, scrollY);

    document.removeEventListener('keydown', onKeydown);
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') closeDrawer();
  }

  openTriggers.forEach(function (trigger) {
    trigger.addEventListener('click', openDrawer);
  });
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);

})();
