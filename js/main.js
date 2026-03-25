/* ========================================
   IPO Auto - Main JavaScript
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ---------- Purchase success toast ----------
  const params = new URLSearchParams(window.location.search);
  if (params.get('purchase') === 'success') {
    // URLからクエリパラメータを除去
    window.history.replaceState({}, '', window.location.pathname);

    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 10l4 4 6-6" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>ご購入ありがとうございます！ライセンスキーをメールでお送りしました。</span>
    `;
    document.body.appendChild(toast);

    // アニメーション表示
    requestAnimationFrame(() => toast.classList.add('show'));

    // 5秒後に非表示
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, 5000);
  }

  // ---------- Header scroll effect ----------
  const header = document.getElementById('header');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    if (currentScroll > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    lastScroll = currentScroll;
  }, { passive: true });

  // ---------- Mobile menu ----------
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileNav = document.getElementById('mobileNav');

  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
      mobileMenuBtn.classList.toggle('active');
    });

    // Close mobile menu on link click
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        mobileMenuBtn.classList.remove('active');
      });
    });
  }

  // ---------- Scroll animations (Intersection Observer) ----------
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
  });

  // ---------- Counter animation ----------
  function animateCounters() {
    const counters = document.querySelectorAll('[data-count]');
    counters.forEach(counter => {
      if (counter.dataset.animated) return;

      const target = parseInt(counter.dataset.count, 10);
      const duration = 2000;
      const start = performance.now();

      function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);

        counter.textContent = current.toLocaleString();

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          counter.textContent = target.toLocaleString();
        }
      }

      counter.dataset.animated = 'true';
      requestAnimationFrame(update);
    });
  }

  // Trigger counter animation when stats section is visible
  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounters();
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) {
    statsObserver.observe(heroStats);
  }

  // ---------- FAQ accordion ----------
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');

      // Close all
      document.querySelectorAll('.faq-item').forEach(el => {
        el.classList.remove('open');
      });

      // Toggle current
      if (!isOpen) {
        item.classList.add('open');
      }
    });
  });

  // ---------- Smooth scroll for anchor links ----------
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // ---------- All modals: close on overlay click / Escape ----------
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });

  // ---------- Particles ----------
  function createParticles() {
    const container = document.getElementById('heroParticles');
    if (!container) return;

    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.classList.add('particle');

      const x = Math.random() * 100;
      const y = 50 + Math.random() * 50;
      const size = 2 + Math.random() * 4;
      const duration = 4 + Math.random() * 8;
      const delay = Math.random() * 6;

      particle.style.left = `${x}%`;
      particle.style.top = `${y}%`;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.animationDuration = `${duration}s`;
      particle.style.animationDelay = `${delay}s`;

      // Random color between primary and accent
      const colors = [
        'rgba(79, 70, 229, 0.3)',
        'rgba(124, 58, 237, 0.3)',
        'rgba(99, 102, 241, 0.2)',
        'rgba(139, 92, 246, 0.2)',
      ];
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];

      container.appendChild(particle);
    }
  }

  createParticles();

  // ---------- Typing effect for hero (optional enhancement) ----------
});

// ---------- Trial form handler (global) ----------
const WORKER_URL = 'https://ipo-auto-trial.darkground96.workers.dev';

async function handleTrialSubmit() {
  const form = document.getElementById('trialForm');
  const success = document.getElementById('trialSuccess');
  const btn = document.getElementById('trialSubmitBtn');
  const email = document.getElementById('trialEmail').value;
  const note = document.querySelector('.modal-note');

  btn.innerHTML = '<span>送信中...</span>';
  btn.disabled = true;

  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      throw new Error('送信に失敗しました');
    }

    form.style.display = 'none';
    if (note) note.style.display = 'none';
    success.style.display = 'block';
  } catch (e) {
    btn.innerHTML = '<span>ダウンロードリンクを受け取る</span>';
    btn.disabled = false;
    alert('送信に失敗しました。もう一度お試しください。');
  }
}

// ---------- Contact form handler (global) ----------
async function handleContactSubmit() {
  const form = document.getElementById('contactForm');
  const success = document.getElementById('contactSuccess');
  const btn = document.getElementById('contactSubmitBtn');
  const name = document.getElementById('contactName').value;
  const email = document.getElementById('contactEmail').value;
  const message = document.getElementById('contactMessage').value;

  btn.innerHTML = '<span>送信中...</span>';
  btn.disabled = true;

  try {
    const res = await fetch(WORKER_URL + '/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, message }),
    });

    if (!res.ok) throw new Error();

    form.style.display = 'none';
    success.style.display = 'block';
  } catch (e) {
    btn.innerHTML = '<span>送信する</span>';
    btn.disabled = false;
    alert('送信に失敗しました。お手数ですが darkground96@gmail.com まで直接ご連絡ください。');
  }
}
