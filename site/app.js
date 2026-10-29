(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const keys = {completed:'contractors-course:completed:v1',resume:'contractors-course:resume:v1',known:'contractors-course:known:v1'};
  const read = (key,fallback) => {
    try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  };
  const save = (key,value) => {
    try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch { return false; }
  };
  const readSet = (key) => {
    const value = read(key,[]);
    return new Set(Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []);
  };
  let toastTimer;
  function toast(message) {
    const element = $('.toast');
    clearTimeout(toastTimer);
    element.textContent = message;
    element.hidden = false;
    toastTimer = setTimeout(() => { element.hidden = true; },3000);
  }
  async function data(name) {
    const response = await fetch('/data/' + name + '.json');
    if (!response.ok) throw new Error('Unable to load ' + name);
    return response.json();
  }
  const page = document.body.dataset.page;
  $$('[data-nav]').forEach((link) => {
    if (link.dataset.nav === page || (page === 'lesson' && link.dataset.nav === 'dashboard')) link.setAttribute('aria-current','page');
  });
  const menu = $('.menu-toggle');
  menu?.addEventListener('click',() => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded',String(open));
    menu.setAttribute('aria-label',open ? 'Close navigation' : 'Open navigation');
    $('#mobile-nav').hidden = !open;
  });
  document.addEventListener('keydown',(event) => {
    if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') {
      menu.click();
      menu.focus();
    }
  });
  async function initializeLibrary() {
    const catalog = await data('catalog');
    const validIds = new Set(catalog.map((lesson) => lesson.id));
    let completed = new Set([...readSet(keys.completed)].filter((id) => validIds.has(id)));
    const current = $('[data-current-lesson]')?.dataset.currentLesson;
    if (current && validIds.has(current)) {
      save(keys.resume,current);
      $('[data-sidebar-lesson="' + current + '"]')?.setAttribute('aria-current','page');
    }
    function renderProgress() {
      $$('[data-lesson-id]').forEach((card) => card.classList.toggle('is-complete',completed.has(card.dataset.lessonId)));
      const count = $('[data-progress-count]');
      if (count) count.textContent = completed.size + ' of ' + catalog.length + ' completed';
      const bar = $('[role="progressbar"]');
      if (bar) {
        bar.setAttribute('aria-valuenow',String(completed.size));
        bar.setAttribute('aria-valuemax',String(catalog.length));
        $('.progress-fill').style.width = (completed.size / catalog.length * 100) + '%';
      }
      const completeButton = $('[data-complete]');
      if (completeButton) {
        const done = completed.has(current);
        completeButton.setAttribute('aria-pressed',String(done));
        completeButton.textContent = done ? 'Completed ✓' : 'Mark complete ✓';
        completeButton.classList.toggle('button-dark',done);
        completeButton.classList.toggle('button-light',!done);
      }
      const resume = $('[data-resume]');
      if (resume) {
        const previous = read(keys.resume,null);
        const target = catalog.find((lesson) => lesson.id === previous && !completed.has(lesson.id)) || catalog.find((lesson) => !completed.has(lesson.id)) || catalog[0];
        resume.href = target.path;
        resume.textContent = (completed.size || previous ? 'Continue learning' : 'Start the first chapter') + ' ↗';
      }
    }
    renderProgress();
    $('[data-complete]')?.addEventListener('click',() => {
      const wasComplete = completed.has(current);
      if (wasComplete) completed.delete(current); else completed.add(current);
      const persisted = save(keys.completed,[...completed]);
      renderProgress();
      toast(persisted ? (wasComplete ? 'Chapter marked as incomplete.' : 'Chapter complete. Keep building your knowledge.') : 'Progress updated for this visit. This browser could not save it.');
    });
    window.addEventListener('storage',(event) => {
      if (event.key === keys.completed) {
        completed = new Set([...readSet(keys.completed)].filter((id) => validIds.has(id)));
        renderProgress();
      }
    });
    const library = $('[data-library]');
    if (!library) return;
    let filter = library.dataset.initialFilter || 'all';
    const search = $('[data-search]');
    function applyFilters() {
      const query = (search?.value || '').trim().toLowerCase();
      let visible = 0;
      $$('[data-lesson-id]').forEach((card) => {
        const match = (filter === 'all' || card.dataset.track === filter) && (card.dataset.title + ' ' + card.dataset.track).includes(query);
        card.hidden = !match;
        if (match) visible++;
      });
      $('[data-no-results]').hidden = visible > 0;
      library.hidden = visible === 0;
    }
    $$('[data-filter]').forEach((button) => button.addEventListener('click',() => {
      filter = button.dataset.filter;
      $$('[data-filter]').forEach((item) => item.setAttribute('aria-pressed',String(item === button)));
      applyFilters();
    }));
    search?.addEventListener('input',applyFilters);
    applyFilters();
  }
  async function initializeCards() {
    const source = await data('flashcards');
    const validIds = new Set(source.map((card) => card.id));
    const known = new Set([...readSet(keys.known)].filter((id) => validIds.has(id)));
    let filter = 'all';
    let cards = [...source];
    let index = 0;
    let flipped = false;
    const cardButton = $('[data-flashcard]');
    function render() {
      const card = cards[index];
      cardButton.classList.toggle('is-flipped',flipped);
      cardButton.setAttribute('aria-pressed',String(flipped));
      cardButton.setAttribute('aria-label',flipped ? 'Flashcard answer. Show question' : 'Flashcard question. Show answer');
      $('[data-card-side]').textContent = flipped ? 'ANSWER' : 'QUESTION';
      $('[data-card-content]').innerHTML = flipped ? card.answer : card.question;
      $('[data-card-hint]').textContent = flipped ? 'Click to return to the question' : 'Click to reveal the answer';
      $('[data-card-position]').textContent = 'Card ' + (index + 1) + ' of ' + cards.length;
      $('[data-card-type]').textContent = card.type;
      const learned = known.has(card.id);
      $('[data-known]').textContent = learned ? 'Learned ✓' : 'Got it ✓';
      $('[data-known]').setAttribute('aria-pressed',String(learned));
      $('[data-learned-count]').textContent = cards.filter((item) => known.has(item.id)).length + ' of ' + cards.length + ' marked as learned';
    }
    function move(direction) { index = (index + direction + cards.length) % cards.length; flipped = false; render(); }
    cardButton.addEventListener('click',() => { flipped = !flipped; render(); });
    $('[data-next]').addEventListener('click',() => move(1));
    $('[data-previous]').addEventListener('click',() => move(-1));
    $('[data-known]').addEventListener('click',() => {
      const id = cards[index].id;
      const learned = known.has(id);
      if (learned) known.delete(id); else known.add(id);
      const persisted = save(keys.known,[...known]);
      render();
      toast(persisted ? (learned ? 'Card returned to review.' : 'Card marked as learned.') : 'This browser could not save your review progress.');
    });
    $('[data-shuffle]').addEventListener('click',() => {
      for (let i = cards.length - 1;i > 0;i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i],cards[j]] = [cards[j],cards[i]];
      }
      index = 0;
      flipped = false;
      render();
      toast('Cards shuffled. A fresh starting point.');
    });
    $$('[data-card-filter]').forEach((button) => button.addEventListener('click',() => {
      filter = button.dataset.cardFilter;
      cards = source.filter((card) => filter === 'all' || card.type === filter);
      index = 0;
      flipped = false;
      $$('[data-card-filter]').forEach((item) => item.setAttribute('aria-pressed',String(item === button)));
      render();
    }));
    document.addEventListener('keydown',(event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    });
    render();
  }
  if (page === 'dashboard' || page === 'lesson') initializeLibrary().catch(() => toast('Study progress could not load. Reload the page to try again.'));
  if (page === 'flash-cards') initializeCards().catch(() => {
    $('[data-card-content]').textContent = 'The flashcards could not load. Please reload the page.';
    $$('[data-next],[data-previous],[data-known],[data-shuffle],[data-card-filter]').forEach((button) => { button.disabled = true; });
  });
})();
