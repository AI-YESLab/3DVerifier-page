'use strict';
const $ = id => document.getElementById(id);
const state = { gallery: [], galleryIndex: 0, tasks: [], taskIndex: 0, results: null, identityTimer: null, n21Group: false };
const json = async name => { const r = await fetch(`data/${name}.json`); if (!r.ok) throw new Error(`${name}: ${r.status}`); return r.json(); };

// The image dialog uses the same original asset, never a generated replacement.
function enlarge(src, caption, alt) {
  $('lightbox-image').src = src; $('lightbox-image').alt = alt || caption;
  $('lightbox-caption').textContent = caption; $('lightbox-original').href = src;
  $('lightbox').showModal();
}
document.querySelectorAll('[data-lightbox]').forEach(button => button.addEventListener('click', () => enlarge(button.dataset.lightbox, button.dataset.caption)));
$('lightbox-close').addEventListener('click', () => $('lightbox').close());
$('lightbox').addEventListener('click', e => { if (e.target === $('lightbox')) { const b = e.target.getBoundingClientRect(); if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) e.target.close(); }});

function setIdentityView(value) {
  const i = Number(value); $('identity-view').value = String(i); $('view-number').textContent = `${i + 1} / 8`;
  $('identity-source').src = `assets/identity-a-${i}.webp`; $('identity-edited').src = `assets/identity-b-${i}.webp`;
  $('identity-source').alt = `Source face, original view ${i + 1} of 8`;
  $('identity-edited').alt = `Edited face, corresponding view ${i + 1} of 8`;
}
function stopIdentity() { clearInterval(state.identityTimer); state.identityTimer = null; $('identity-toggle').textContent = 'Rotate views'; $('identity-toggle').setAttribute('aria-pressed', 'false'); }
$('identity-view').addEventListener('input', e => { stopIdentity(); setIdentityView(e.target.value); });
$('identity-toggle').addEventListener('click', () => {
  if (state.identityTimer) return stopIdentity();
  pauseOtherMedia();
  $('identity-toggle').textContent = 'Pause'; $('identity-toggle').setAttribute('aria-pressed', 'true');
  state.identityTimer = setInterval(() => setIdentityView((Number($('identity-view').value) + 1) % 8), 900);
});

function tabKeyboard(tablist) {
  tablist.addEventListener('keydown', e => {
    const tabs = [...tablist.querySelectorAll('[role=tab]')]; const i = tabs.indexOf(document.activeElement);
    if (i < 0 || !['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(e.key)) return;
    e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (['ArrowLeft','ArrowUp'].includes(e.key) ? -1 : 1) + tabs.length) % tabs.length;
    tabs[next].focus(); tabs[next].click();
  });
}
function chooseTab(list, selected) { list.querySelectorAll('[role=tab]').forEach(t => { const active = t === selected; t.setAttribute('aria-selected', String(active)); t.tabIndex = active ? 0 : -1; }); }
function renderTasks(tasks) {
  state.tasks = tasks;
  tasks.forEach((task, i) => {
    const button = document.createElement('button'); button.className = 'task-button'; button.id = `task-tab-${i}`;
    button.setAttribute('role','tab'); button.setAttribute('aria-controls','task-panel'); button.setAttribute('aria-selected',String(i === 0)); button.tabIndex = i ? -1 : 0;
    const img = document.createElement('img'); img.src = task.image; img.alt = ''; img.loading = 'lazy';
    const label = document.createElement('span'); label.textContent = task.name;
    button.append(img,label); button.addEventListener('click', () => showTask(i)); $('task-buttons').append(button);
  }); showTask(0); tabKeyboard($('task-buttons'));
  startAutoRotation($('benchmark'), () => showTask((state.taskIndex + 1) % state.tasks.length));
}
function showTask(index) {
  state.taskIndex = index;
  const task = state.tasks[index], button = $(`task-tab-${index}`);
  chooseTab($('task-buttons'),button); $('task-panel').setAttribute('aria-labelledby',button.id);
  $('task-name').textContent = task.name; $('task-count').textContent = `${task.count} EXAMPLES`;
  $('task-image').src = task.image; $('task-image').alt = `${task.name} example: ${task.claim}`;
  $('task-claim').innerHTML = highlightClaim(task.claim); $('task-answer').textContent = task.answer ? 'True' : 'False';
  $('task-answer').className = task.answer ? 'correct' : 'incorrect'; $('task-explanation').textContent = task.explanation;
}
// Give every case a full reading interval after interaction or returning to view.
function startAutoRotation(region, advance) {
  const delay = 6000;
  let timer = null, visible = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const paused = () => !visible || document.hidden || reducedMotion.matches || $('lightbox').open || region.matches(':hover') || !!region.querySelector(':focus-visible');
  function restart() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!paused()) advance();
      restart();
    },delay);
  }
  for (const event of ['pointerenter','pointerleave','pointerup','click','keydown','focusin','focusout']) region.addEventListener(event,restart);
  document.addEventListener('visibilitychange',restart);
  $('lightbox').addEventListener('close',restart);
  reducedMotion.addEventListener('change',restart);
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    restart();
  },{threshold:0.1});
  observer.observe(region);
}
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const highlightClaim = value => escapeHTML(value).replace(/highlighted region/gi, '<span class="claim-highlight">$&</span>');
function fieldLabel(name) {
  const file = name === 'Requirement' ? 'requirement.png' : `${name.toLowerCase()}.svg`;
  return `<span class="field-label"><img src="assets/icons/${file}" alt="" width="18" height="18">${name}</span>`;
}
function responseMarkup(name, icon, answer, explanation, correct) {
  return `<div class="example-response"><h4><img src="assets/icons/${icon}.svg" alt="" width="24" height="24">${name}</h4><div class="answer-field">${fieldLabel('Answer')}<strong class="${correct ? 'correct' : 'incorrect'}">${escapeHTML(answer)}<span class="judgment-mark" role="img" aria-label="${correct ? 'Correct' : 'Incorrect'} judgment">${correct ? '✓' : '✕'}</span></strong></div><div class="explanation-field">${fieldLabel('Explanation')}<p>${escapeHTML(explanation)}</p></div></div>`;
}
function renderCarousel(gallery) {
  state.gallery = gallery;
  const track = $('carousel-track');
  gallery.forEach((item,i) => {
    const slide = document.createElement('article');
    slide.className = 'failure-slide'; slide.id = `failure-${item.id}`;
    slide.setAttribute('role','group'); slide.setAttribute('aria-roledescription','slide');
    slide.setAttribute('aria-label',`${i + 1} of ${gallery.length}: ${item.task}`);
    slide.innerHTML = `<div class="failure-slide-heading"><span class="case-index">${String(i + 1).padStart(2,'0')}</span><h3>${escapeHTML(item.task)}</h3><p>${escapeHTML(item.title)}</p></div><div class="failure-slide-grid"><button class="failure-evidence" aria-label="Enlarge ${escapeHTML(item.task)} evidence"><img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.task + ' evidence. ' + item.human_explanation)}" loading="eager"><span>View evidence full size ↗</span></button><div class="failure-slide-copy"><div class="requirement-field">${fieldLabel('Requirement')}<p>${highlightClaim(item.claim)}</p></div><div class="response-pair">${responseMarkup('GPT-6 Astra','astra',item.model_answer,item.model_explanation,false)}${responseMarkup('Human reference','human',item.human_answer,item.human_explanation,true)}</div></div></div>`;
    slide.querySelector('.failure-evidence').addEventListener('click', () => enlarge(item.image,`${item.task} — ${item.source}. ${item.reference}`,`${item.task} evidence`));
    track.append(slide);
    const dot = document.createElement('button'); dot.type = 'button';
    dot.setAttribute('aria-label',`Go to case ${i + 1}: ${item.task}`); dot.setAttribute('aria-controls',slide.id);
    dot.addEventListener('click',() => showCase(i)); $('carousel-dots').append(dot);
  });
  showCase(0,false);
  startAutoRotation($('failure-carousel'), () => showCase(state.galleryIndex + 1,false));
}
function showCase(index, announce = true) {
  if (!state.gallery.length) return;
  const total = state.gallery.length;
  const next = (index + total) % total;
  const track = $('carousel-track');
  const slides = [...track.children];
  if (slides[state.galleryIndex]?.contains(document.activeElement)) $('carousel-viewport').focus({preventScroll:true});
  // Wrap without travelling backwards through every intermediate case.
  track.style.transition = Math.abs(next - state.galleryIndex) > 1 ? 'none' : '';
  state.galleryIndex = next;
  track.style.transform = `translateX(-${next * 100}%)`;
  slides.forEach((slide,i) => { slide.inert = i !== next; slide.setAttribute('aria-hidden',String(i !== next)); });
  [...$('carousel-dots').children].forEach((dot,i) => dot.setAttribute('aria-pressed',String(i === next)));
  $('gallery-count').textContent = `${String(next + 1).padStart(2,'0')} / ${String(total).padStart(2,'0')}`;
  if (announce) $('carousel-announcement').textContent = `Case ${next + 1} of ${total}: ${state.gallery[next].task}. ${state.gallery[next].title}`;
}
for (const [id,delta] of [['gallery-prev',-1],['gallery-next',1]]) $(id).addEventListener('click', () => showCase(state.galleryIndex + delta));
$('failure-carousel').addEventListener('keydown',e => {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
  e.preventDefault();
  showCase(e.key === 'Home' ? 0 : e.key === 'End' ? state.gallery.length - 1 : state.galleryIndex + (e.key === 'ArrowLeft' ? -1 : 1));
});
let swipeStart = null, suppressSwipeClick = false;
$('carousel-viewport').addEventListener('pointerdown',e => {
  suppressSwipeClick = false;
  if (e.pointerType === 'touch' || e.pointerType === 'pen') swipeStart = {x:e.clientX,y:e.clientY,id:e.pointerId};
});
$('carousel-viewport').addEventListener('pointerup',e => {
  if (!swipeStart || e.pointerId !== swipeStart.id) return;
  const dx = e.clientX - swipeStart.x, dy = e.clientY - swipeStart.y; swipeStart = null;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) { suppressSwipeClick = true; showCase(state.galleryIndex + (dx < 0 ? 1 : -1)); }
});
$('carousel-viewport').addEventListener('pointercancel',() => { swipeStart = null; });
$('carousel-viewport').addEventListener('click',e => { if (suppressSwipeClick) { e.preventDefault(); e.stopPropagation(); suppressSwipeClick = false; } },true);

function bar(name,value,kind) {
  const row = document.createElement('div'); row.className = 'bar-row';
  const label = document.createElement('span'); label.className = 'bar-label'; label.textContent = name;
  const track = document.createElement('div'); track.className = 'bar-track'; track.setAttribute('aria-hidden','true');
  const fill = document.createElement('div'); fill.className = `bar-fill ${kind || ''}`; fill.style.width = `${value}%`; track.append(fill);
  const score = document.createElement('span'); score.className = 'bar-value'; score.textContent = value.toFixed(1) + '%';
  row.append(label,track,score); return row;
}
function renderRanking(metric) {
  if (!state.results) return;
  const sorted = [...state.results.models].sort((a,b) => b[metric] - a[metric]); $('ranking-chart').replaceChildren();
  if (metric === 'overall') $('ranking-chart').append(bar('Human',state.results.human.overall,'human'));
  sorted.forEach(m => $('ranking-chart').append(bar(m.name,m[metric],m.name === 'GPT-6 Astra' ? 'astra' : '')));
  const descriptions = {overall:'Overall accuracy (OA): mean task-level balanced accuracy.',explanation:'ExpOA additionally checks the reference-semantic validity of rejection explanations.',triplet:'All three linked answers must be correct: true anchor, Spec-CF, and Cand-CF. 615 complete triplets.',expTriplet:'All three linked answers must be correct and both negative explanations must pass. 615 complete triplets.'};
  $('metric-description').textContent = descriptions[metric];
}
$('metric-select').addEventListener('change',e => renderRanking(e.target.value));
function renderSelection(metric) {
  if (!state.results) return;
  $('selection-chart').replaceChildren();
  state.results.selection.forEach(m => $('selection-chart').append(bar(m.name,m[metric],m.name === 'GPT-6 Astra' ? 'astra' : m.name === 'Human oracle' ? 'oracle' : '')));
  $('selection-title').textContent = metric === 'full' ? 'Full factual success' : 'Strict full success';
  $('selection-description').textContent = metric === 'full' ? 'All seven factual requirements satisfied.' : 'All seven facts, no severe defects, and source fidelity.';
}
document.querySelectorAll('[data-selection]').forEach(b => b.addEventListener('click', () => { chooseTab(b.parentElement,b); $('selection-chart').setAttribute('aria-labelledby',b.id); renderSelection(b.dataset.selection); }));
tabKeyboard($('full-tab').parentElement);
function renderResults(data) {
  state.results = data; renderRanking('overall'); renderSelection('full');
  const human = document.createElement('tr'); ['Human',data.human.overall.toFixed(1),'—','—','—'].forEach(v => {const td = document.createElement('td');td.textContent=v;human.append(td);}); $('results-table').append(human);
  data.models.forEach(m => { const row = document.createElement('tr'); [m.name,...['overall','explanation','triplet','expTriplet'].map(k => m[k].toFixed(1))].forEach(v => {const td = document.createElement('td');td.textContent=v;row.append(td);}); $('results-table').append(row); });
}

// Only one demo group moves at a time; the N21 trio is one synchronized comparison.
const n21Videos = [...document.querySelectorAll('.n21-video')];
function pauseOtherMedia(except) {
  document.querySelectorAll('video').forEach(v => { if (v !== except && !(state.n21Group && n21Videos.includes(except) && n21Videos.includes(v))) v.pause(); });
}
function resetN21Button() { $('n21-play').innerHTML = '<span aria-hidden="true">▷</span> Rotate all three'; $('n21-play').setAttribute('aria-pressed','false'); }
function stopN21() { state.n21Group = false; n21Videos.forEach(v => v.pause()); resetN21Button(); }
document.querySelectorAll('video').forEach(video => video.addEventListener('play', () => { stopIdentity(); if (!n21Videos.includes(video)) stopN21(); pauseOtherMedia(video); }));
$('n21-play').addEventListener('click',async () => {
  if (state.n21Group) return stopN21();
  pauseOtherMedia(); stopIdentity(); state.n21Group = true;
  n21Videos.forEach(v => { v.currentTime = 0; v.playbackRate = 1; });
  try { await Promise.all(n21Videos.map(v => v.play())); $('n21-play').textContent = 'Ⅱ Pause comparison'; $('n21-play').setAttribute('aria-pressed','true'); }
  catch { stopN21(); $('n21-play').textContent = 'Retry playback'; }
});
n21Videos.forEach(v => v.addEventListener('pause', () => { if (state.n21Group) stopN21(); }));
document.addEventListener('visibilitychange', () => { if (document.hidden) { stopIdentity(); stopN21(); pauseOtherMedia(); } });
const mediaVisibility = new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) { if (entry.target.id === 'identity-toggle') stopIdentity(); else if (entry.target.classList.contains('n21-video')) { if (window.innerWidth > 680) stopN21(); else entry.target.pause(); } else entry.target.pause(); }
}),{threshold:0});
for (const video of document.querySelectorAll('video')) mediaVisibility.observe(video); mediaVisibility.observe($('identity-toggle'));
const sections = [...document.querySelectorAll('main>section[id]')];
const navObserver = new IntersectionObserver(entries => { for (const e of entries) if(e.isIntersecting){document.querySelectorAll('.nav-links a').forEach(a=>{if(a.hash===`#${e.target.id}`) a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});} },{rootMargin:'-10% 0px -65% 0px'});
sections.forEach(s=>navObserver.observe(s));

Promise.all([json('tasks'),json('gallery'),json('results'),json('site')]).then(([tasks,gallery,results,site]) => {
 site.authors.forEach((author,i)=>{if(author.url){const span=document.querySelectorAll('.authors > span')[i];const a=document.createElement('a');a.href=author.url;a.target='_blank';a.rel='noopener';a.textContent=author.name;span.firstChild.replaceWith(a);}});
 renderTasks(tasks); renderCarousel(gallery); renderResults(results);
 for (const key of ['code','benchmark','training']) { const url=site.links[key]; if(url){const old=document.querySelector(`[data-resource="${key}"]`);const a=document.createElement('a');a.href=url;a.textContent=key==='training'?'Email the authors to request access ↗':'Open resource ↗';if(!url.startsWith('mailto:')){a.target='_blank';a.rel='noopener';}old.replaceWith(a);const hero=document.querySelector(`[data-hero-resource="${key}"]`);if(hero){hero.href=url;hero.target='_blank';hero.rel='noopener';hero.querySelector('.button-note')?.remove();}}}
}).catch(err=>{console.error(err);const p=document.createElement('p');p.className='load-error wrap';p.textContent='Interactive data could not be loaded. Please reload the page or open the paper PDF.';document.querySelector('main').prepend(p);});
