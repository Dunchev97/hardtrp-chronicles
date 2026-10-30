(() => {
  'use strict';
  const C = window.HARDTRP_CATALOG;
  const $ = (s, root = document) => root.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fold = value => String(value).toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const nf = new Intl.NumberFormat('ru-RU');
  const number = n => nf.format(n);
  const date = (value, options = {}) => value ? new Date(value).toLocaleDateString('ru-RU', {day:'numeric', month:'long', year:'numeric', ...options}) : '';
  const shortDate = value => date(value, {month:'short', year:undefined});
  const time = value => value ? value.slice(11,16) : '';
  const initial = value => [...String(value).replace(/[^\p{L}\p{N}]/gu,'')][0] || '·';
  const topics = new Map(C.topics.map(t => [t.id, t]));
  const storage = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem('hardtrp:' + key)) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem('hardtrp:' + key, JSON.stringify(value)); } catch { /* Reading also works with disabled storage. */ } }
  };
  const savedFavorites = storage.get('favorites:v1', []);
  const favorites = new Set((Array.isArray(savedFavorites) ? savedFavorites : []).map(String));
  const availableFavoriteCount = () => [...favorites].filter(id => topics.has(id)).length;
  const progress = storage.get('progress:v1', {});
  let fontSize = Math.max(16, Math.min(24, Number(storage.get('font:v1', 19)) || 19));
  let libraryQuery = '', librarySort = 'recent', libraryMode = 'all';
  let reader = null, routeVersion = 0, searchVersion = 0, toastTimer;
  const PAGE_SIZE = 65;
  const cache = new Map(), pending = new Map();
  window.HARDTRP = {
    receive(id, records) {
      const waiting = pending.get(String(id));
      if (waiting) waiting.resolve(records);
    }
  };
  function loadTopic(id) {
    id = String(id);
    if (cache.has(id)) { const v = cache.get(id); cache.delete(id); cache.set(id,v); return Promise.resolve(v); }
    if (pending.has(id)) return pending.get(id).promise;
    let resolve, reject;
    const promise = new Promise((yes,no) => { resolve=yes; reject=no; });
    pending.set(id, {promise, resolve, reject});
    const script = document.createElement('script');
    script.src = 'data/t-' + encodeURIComponent(id) + '.js';
    script.onerror = () => reject(new Error('Не удалось открыть файл темы. Проверьте, что папка data находится рядом с index.html.'));
    document.head.append(script);
    return promise.then(records => {
      cache.set(id, records);
      while (cache.size > 7) cache.delete(cache.keys().next().value);
      return records;
    }).finally(() => { pending.delete(id); script.remove(); });
  }
  const icons = {
    book:'<path d="M3 4h6a4 4 0 0 1 3 1.4A4 4 0 0 1 15 4h6v15h-6a4 4 0 0 0-3 1.4A4 4 0 0 0 9 19H3z"/><path d="M12 6v14"/>',
    search:'<circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 4.7 4.7"/>',
    star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
    arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
    back:'<path d="M20 12H5m6-6-6 6 6 6"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>',
    leaf:'<path d="M19 3C9 2 3 8 5 16c8 5 16-1 14-13ZM4 21 15 10"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    link:'<path d="m10 14 4-4m-5 7-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0-1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"/>',
    first:'<path d="M4 5v14m16-7H8m5-5-5 5 5 5"/>',
    last:'<path d="M20 5v14M4 12h12m-5-5 5 5-5 5"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.book}</svg>`;
  const crest = `<svg class="crest" viewBox="0 0 48 56" fill="none" aria-hidden="true"><path d="m24 2 21 13v24L24 54 3 39V15Z" stroke="currentColor"/><path d="m24 7 16 11v18L24 48 8 36V18Z" stroke="currentColor" opacity=".45"/><path d="M17 19v19m14-19v19M17 28h14m-7-17v7m0 21v6" stroke="currentColor" stroke-width="1.6"/></svg>`;
  const illustration = `<svg class="hero-art" viewBox="0 0 460 400" fill="none" aria-hidden="true"><defs><radialGradient id="mist"><stop stop-color="#b2945f" stop-opacity=".12"/><stop offset="1" stop-color="#b2945f" stop-opacity="0"/></radialGradient><linearGradient id="stone" x2="0" y2="1"><stop stop-color="#5b5546"/><stop offset="1" stop-color="#171914"/></linearGradient></defs><circle cx="248" cy="195" r="190" fill="url(#mist)"/><g stroke="#aa9265"><circle cx="248" cy="169" r="104" opacity=".18"/><circle cx="248" cy="169" r="119" opacity=".12" stroke-dasharray="1 12"/><path d="M248 23v28m0 238v28M102 169h28m236 0h28m-43-103-19 19M145 66l19 19" opacity=".3"/><path d="m248 38 5 10-5 10-5-10Z" opacity=".7"/></g><path d="M298 67a66 66 0 1 0 38 109A60 60 0 0 1 298 67Z" fill="#aa9773" opacity=".16"/><g fill="url(#stone)" stroke="#8d7b59" stroke-opacity=".48"><path d="M135 337V180l24-12 22 12v157m-50-157h54v-12h-13v-13h-10v13h-13v-13h-10v13h-8z"/><path d="M189 337V155l24-49 23 49v182m-50-182h53m-25-49V75m-12 129h22v133h-22z"/><path d="M244 337V212h61v125m-64-125h68v-13h-13v-12h-11v12h-13v-12h-11v12h-20z"/><path d="M311 337V155l20-40 19 40v182m-44-182h49m-23-40V92"/><path d="M125 337h240l-10 12H111Z"/></g><g stroke="#b9a174" opacity=".37"><path d="M153 199v14m0 22v14m22 24v14m37-105v15m0 26v15m66-10v13m54-67v16m0 21v16M100 359h280M141 368h199"/><path d="M234 337v-44a13 13 0 0 1 26 0v44"/></g><g fill="#c4aa75" opacity=".36"><path d="m93 253 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/><path d="m368 108 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/></g><path d="M51 343c55-15 88 15 141 1s114-18 205 3M76 367c80-10 171 17 291-4" stroke="#9d8a64" stroke-opacity=".14"/></svg>`;

  function shell() {
    $('#app').innerHTML = `<div class="mobile-shade" data-action="close-menu"></div><aside class="sidebar" aria-label="Навигация по хроникам"><a class="brand" href="#">${crest}<span>HARDTRP<small>КНИГА ХРОНИК</small></span></a><div class="sidebar-rule"><span>EST. 2026</span><i>✦</i></div><nav class="primary-nav"><a href="#" data-nav="all">${icon('book')}Все хроники<span>${C.counts.topics}</span></a><a href="#saved" data-nav="saved">${icon('star')}Отложенные<span id="favorite-count">${availableFavoriteCount()}</span></a></nav><div class="contents-label">ОГЛАВЛЕНИЕ <span>↓</span></div><div class="topic-nav" id="topic-nav">${[...C.topics].reverse().map(t => `<a href="#topic=${t.id}" data-topic-nav="${t.id}" title="${esc(t.title)}"><span class="nav-diamond">◇</span><span>${esc(t.title)}</span></a>`).join('')}</div><div class="sidebar-bottom"><span class="status-dot"></span>Истории сохранены<button data-action="about" aria-label="О хрониках">${icon('info')}</button></div></aside><div class="workspace"><header class="topbar"><button class="icon-button mobile-menu" data-action="menu" aria-label="Открыть меню">${icon('menu')}</button><div class="breadcrumb" id="breadcrumb">Библиотека <span>/</span> <b>Все хроники</b></div><button class="top-search" data-action="focus-search">${icon('search')}<span>Найти историю</span><kbd>Ctrl K</kbd></button></header><main id="main" tabindex="-1"></main><footer class="site-footer"><span>HARDTRP <i>✦</i> У каждой истории есть продолжение.</span><button data-action="about">О сохранённых хрониках ${icon('arrow')}</button></footer></div><div class="toast" id="toast" role="status"></div><dialog id="about"><button class="dialog-close icon-button" data-action="close-about" aria-label="Закрыть">${icon('close')}</button><div class="eyebrow">ПАМЯТЬ МИРА</div><h2>Истории остаются.</h2><p>Здесь собраны сохранённые переписки HARDTRP с ${date(C.first)} по ${date(C.last)}. Это исходные тексты участников: без пересказа и дополнений.</p><div class="about-stats"><b>${number(C.counts.topics)}<span>тем</span></b><b>${number(C.counts.messages)}<span>сообщений</span></b><b>${number(C.counts.authors)}<span>имён авторов</span></b></div><p>Сохранены все текстовые сообщения участников, включая команды и внеигровые реплики с «/» и «//». Убраны вложения, пустые и служебные записи и сообщения ботов. Подписи к вложениям сохранены как текст.</p><p>Часть потерявших Telegram-привязку реплик возвращена в темы по содержанию диалогов. Они отмечены знаком ↺. Неоднозначные фрагменты не опубликованы.</p><p class="muted">Закладки, размер шрифта и место чтения сохраняются только в этом браузере. Сайт не отправляет ваши поисковые запросы внешним сервисам.</p><button class="button gold" data-action="close-about">Вернуться к историям ${icon('arrow')}</button></dialog>`;
    document.documentElement.style.setProperty('--reading-size',fontSize+'px');
  }
  function toast(text) { const el=$('#toast'); el.textContent=text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2300); }
  function setNav(mode, id) {
    document.querySelectorAll('[data-nav]').forEach(el=>el.classList.toggle('active', el.dataset.nav===mode));
    document.querySelectorAll('[data-topic-nav]').forEach(el=>el.classList.toggle('active',el.dataset.topicNav===id));
    document.body.classList.remove('menu-open');
  }
  function favoriteButton(t, extra='') { return `<button class="favorite ${favorites.has(t.id)?'selected':''} ${extra}" data-action="favorite" data-id="${t.id}" aria-label="${favorites.has(t.id)?'Убрать из отложенных':'Отложить хронику'}" aria-pressed="${favorites.has(t.id)}">${icon('star')}</button>`; }
  function lastProgress() { return Object.values(progress).filter(p=>topics.has(p.topic)).sort((a,b)=>b.updated-a.updated)[0]; }
  function renderLibrary(saved=false) {
    const nextMode=saved?'saved':'all';
    if(libraryMode!==nextMode)libraryQuery='';
    reader=null; libraryMode=nextMode; setNav(nextMode);
    document.title = saved ? 'Отложенные · HARDTRP' : 'Хроники HARDTRP';
    $('#breadcrumb').innerHTML = `Библиотека <span>/</span> <b>${saved?'Отложенные':'Все хроники'}</b>`;
    const recent=lastProgress();
    $('#main').innerHTML = `${saved?`<section class="saved-intro"><div class="eyebrow">ВАША КОЛЛЕКЦИЯ</div><h1>Отложенные истории</h1><p>Хроники, к которым хочется вернуться.</p></section>`:`<section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="tiny-diamond">◆</span> ХРОНИКИ СЕРВЕРА HARDTRP</div><h1>Истории, которые<br>пережили <em>тьму.</em></h1><p>Голоса героев, дороги и судьбы.<br>Откройте любую хронику — и вернитесь в мир.</p><div class="hero-foot"><span class="archive-seal">${icon('leaf')} СОХРАНЕНО ДО ${C.last.slice(0,10).split('-').reverse().join('.')}</span>${recent?`<a class="continue-link" href="#topic=${recent.topic}&m=${recent.message}">Продолжить чтение ${icon('arrow')}</a>`:''}</div></div>${illustration}</section><section class="metrics" aria-label="Статистика хроник"><div><strong>${number(C.counts.topics)}</strong><span>сохранённых тем</span></div><div><strong>${number(C.counts.messages)}</strong><span>сообщений</span></div><div><strong>${number(C.counts.authors)}</strong><span>имён участников</span></div><div class="metric-period"><span>ЛЕТОПИСЬ МИРА</span><strong>${new Date(C.first).toLocaleDateString('ru-RU',{month:'long'})} — ${new Date(C.last).toLocaleDateString('ru-RU',{month:'long'})} <i>${C.last.slice(0,4)}</i></strong></div></section>`}<section class="library-section"><div class="section-heading"><div><span class="eyebrow">${saved?'БЛИЗКИЕ ИСТОРИИ':'ЛИСТАЙТЕ СТРАНИЦЫ ПРОШЛОГО'}</span><h2>${saved?'Ваши закладки':'Собрание хроник'}<span id="library-count"></span></h2></div><label class="sort-label">Порядок<select id="library-sort" aria-label="Порядок тем"><option value="recent">Сначала новые</option><option value="old">Сначала старые</option><option value="alpha">По названию</option><option value="long">Самые длинные</option></select></label></div><form class="library-search" id="library-form"><label class="search-input">${icon('search')}<input id="catalog-query" type="search" autocomplete="off" value="${esc(libraryQuery)}" placeholder="Название темы, имя участника или фраза из истории" aria-label="Поиск по хроникам"></label><button class="button search-submit" type="submit">Поиск по тексту ${icon('arrow')}</button></form><div class="library-hint" id="library-hint">По названию и участникам — сразу. По всем сообщениям — нажмите Enter.</div><div class="cards" id="cards"></div></section>`;
    $('#cards').classList.toggle('saved-cards',saved);
    $('#favorite-count').textContent=availableFavoriteCount();
    $('#library-sort').value=librarySort; renderCards();
  }
  function renderCards() {
    const q=fold(libraryQuery.trim());
    let list=C.topics.filter(t => (libraryMode!=='saved'||favorites.has(t.id)) && (!q || fold(t.title).includes(q) || t.authors.some(a=>fold(C.authors[a]).includes(q))));
    list.sort((a,b)=>librarySort==='alpha'?a.title.localeCompare(b.title,'ru'):librarySort==='long'?b.count-a.count:librarySort==='old'?a.first.localeCompare(b.first):b.first.localeCompare(a.first));
    const total=libraryMode==='saved'?availableFavoriteCount():C.topics.length;
    const unavailable=libraryMode==='saved'?favorites.size-total:0;
    $('#library-count').textContent=q?`${list.length} из ${total}`:String(total).padStart(2,'0');
    $('#library-hint').innerHTML=q?`Показано ${number(list.length)} из ${number(total)}. <button class="clear-library-filter" data-action="clear-library-filter">Сбросить фильтр ${icon('close')}</button>`:libraryMode==='saved'?`В списке: ${number(total)} ${plural(total,'отложенная тема','отложенные темы','отложенных тем')}.${unavailable?` Ещё ${number(unavailable)} ${plural(unavailable,'закладка ведёт','закладки ведут','закладок ведут')} на темы, которых нет в текущей версии сайта.`:''}`:'По названию и участникам — сразу. По всем сообщениям — нажмите Enter.';
    $('#cards').innerHTML=list.length ? list.map(t=>`<article class="topic-card"><div class="card-top"><span class="card-number">${String(t.number).padStart(3,'0')} <i>/</i> ${esc(t.kind.toLocaleUpperCase('ru'))}</span>${favoriteButton(t)}</div><a class="card-title" href="#topic=${t.id}"><h3>${esc(t.title)}</h3></a><p class="card-excerpt">${esc(t.excerpt)}</p><div class="card-people"><div class="avatar-stack" aria-hidden="true">${t.authors.slice(0,3).map(a=>`<span class="avatar tone-${a%5}">${esc(initial(C.authors[a]))}</span>`).join('')}</div><span>${number(t.authors.length)} ${plural(t.authors.length,'участник','участника','участников')}</span></div><div class="card-bottom"><span>${shortDate(t.first)} <i>·</i> ${number(t.count)} сообщ.</span><a class="read-arrow" href="#topic=${t.id}" aria-label="Читать ${esc(t.title)}">${icon('arrow')}</a></div>${progress[t.id]?'<span class="reading-indicator">Уже открывали</span>':''}</article>`).join('') : `<div class="empty-state">${icon(libraryMode==='saved'?'star':'search')}<h3>${libraryMode==='saved'&&!q?'Пока ни одной закладки':'Ничего не найдено'}</h3><p>${libraryMode==='saved'&&!q?'Отметьте звёздочкой интересную хронику.':'Попробуйте другую фразу или нажмите «Поиск по тексту».'}</p></div>`;
  }
  function plural(n, one, few, many) { const a=n%100,b=n%10; return a>10&&a<20?many:b===1?one:b>1&&b<5?few:many; }
  function highlight(text, query) {
    if(!query) return esc(text);
    const source=fold(text), needle=fold(query); let at=0, found, html='';
    while((found=source.indexOf(needle,at))!==-1) { html+=esc(text.slice(at,found))+'<mark>'+esc(text.slice(found,found+needle.length))+'</mark>'; at=found+needle.length; }
    return html+esc(text.slice(at));
  }
  function filteredRecords() { return reader.records.filter(m=>(reader.author===''||m[2]===Number(reader.author))&&(!reader.query||fold(m[3]).includes(fold(reader.query)))); }
  async function renderReader(params, version) {
    const id=params.get('topic'), topic=topics.get(id);
    if(!topic) { renderLibrary(); toast('Такой темы нет в сохранённых хрониках.'); return; }
    setNav(null,id); $('#breadcrumb').innerHTML=`<a href="#">Библиотека</a><span>/</span><b>Чтение хроники</b>`;
    document.title=topic.title+' · HARDTRP';
    $('#main').innerHTML='<div class="loading-state"><div class="loading-symbol">◇</div>Открываем хронику…</div>';
    try {
      const records=await loadTopic(id); if(version!==routeVersion) return;
      const page=Math.max(1,Number(params.get('p'))||1);
      reader={id,topic,records,page,query:'',author:'',highlight:params.get('find')||'',lookup:new Map(records.map((m,i)=>[m[0],i]))};
      if(params.get('m')) { const at=reader.lookup.get(Number(params.get('m'))); if(at!==undefined)reader.page=Math.floor(at/PAGE_SIZE)+1; }
      $('#main').innerHTML=`<section class="reader-intro" id="reader-top"><a class="back-link" href="#">${icon('back')}Все хроники</a><div class="reader-eyebrow"><span class="eyebrow">ХРОНИКА ${String(topic.number).padStart(3,'0')} <i>✦</i> ${esc(topic.kind.toLocaleUpperCase('ru'))}</span>${favoriteButton(topic,'reader-favorite')}</div><h1>${esc(topic.title)}</h1><div class="reader-meta"><span>${icon('clock')}${date(topic.first)} — ${date(topic.last)}</span><span>${icon('book')}${number(topic.count)} сообщений</span><span>${icon('users')}${topic.authors.length} ${plural(topic.authors.length,'участник','участника','участников')}</span></div></section><section class="reader-tools" aria-label="Настройки чтения"><div class="reader-jumps"><span>ПЕРЕЛИСТНУТЬ ХРОНИКУ</span><div><button class="jump-button" data-action="quest-start">${icon('first')}К началу</button><button class="jump-button" data-action="quest-end">К концу${icon('last')}</button></div></div><label class="reader-search">${icon('search')}<input id="reader-query" type="search" placeholder="Найти в этой хронике" aria-label="Поиск в открытой теме"></label><select id="reader-author" aria-label="Фильтр по автору"><option value="">Все участники</option>${topic.authors.map(a=>`<option value="${a}">${esc(C.authors[a])}</option>`).join('')}</select><div class="font-tools" aria-label="Размер текста"><button data-action="font-down" aria-label="Уменьшить шрифт">А−</button><span id="font-size">${fontSize}</span><button data-action="font-up" aria-label="Увеличить шрифт">А+</button></div></section><section class="reading-paper">${id==='fragments'?'<p class="fragment-notice">Для этих записей не сохранилась надёжная привязка к теме. Они собраны по времени; сообщения разных обсуждений могут чередоваться.</p>':''}<div class="reading-topline"><span>ЗАПИСИ УЧАСТНИКОВ</span><span id="reading-count"></span></div><div id="messages"></div><div id="pagination"></div></section>`;
      renderMessages(false);
      if(params.get('m')) requestAnimationFrame(()=>{ const target=$('#m-'+params.get('m')); if(target){target.scrollIntoView({block:params.get('edge')==='end'?'end':params.get('edge')==='start'?'start':'center'});target.classList.add('target-message');} });
      else window.scrollTo(0,0);
    } catch(error) { if(version===routeVersion)$('#main').innerHTML=`<div class="empty-state"><h2>Не удалось открыть хронику</h2><p>${esc(error.message)}</p><a class="button gold" href="#">Вернуться в библиотеку</a></div>`; }
  }
  function renderMessages(scroll=true) {
    if(!reader) return;
    const filtered=filteredRecords(), pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)); reader.page=Math.max(1,Math.min(reader.page,pages));
    const start=(reader.page-1)*PAGE_SIZE, slice=filtered.slice(start,start+PAGE_SIZE); let day='';
    $('#reading-count').textContent=filtered.length ? `${number(start+1)}–${number(start+slice.length)} из ${number(filtered.length)}` : 'Совпадений нет';
    $('#messages').innerHTML=slice.length ? slice.map(m=>{
      const newDay=m[1].slice(0,10)!==day;day=m[1].slice(0,10);
      const parent=reader.records[reader.lookup.get(m[4])];
      const reply=parent&&parent[0]!==m[0]?`<button class="reply-preview" data-action="reply" data-id="${parent[0]}"><span>↳ ${esc(C.authors[parent[2]])}</span>${esc(parent[3].replace(/\s+/g,' ').slice(0,100))}</button>`:'';
      return `${newDay?`<div class="day-divider"><span>${date(m[1])}</span><i>✦</i></div>`:''}<article class="message" id="m-${m[0]}" data-message="${m[0]}"><div class="message-heading"><span class="message-avatar tone-${m[2]%5}">${esc(initial(C.authors[m[2]]))}</span><span class="message-author tone-text-${m[2]%5}">${esc(C.authors[m[2]])}</span>${m[5]?.method==='context_reviewed'?'<span class="recovery-mark" title="Принадлежность к теме восстановлена по контексту диалога; исходная Telegram-привязка не сохранилась." aria-label="Привязка к теме восстановлена по контексту">↺</span>':''}<time datetime="${esc(m[1])}">${time(m[1])}</time><a class="message-anchor" href="#topic=${reader.id}&m=${m[0]}" aria-label="Ссылка на сообщение ${m[0]}" title="Ссылка на сообщение">#</a></div>${reply}<div class="message-body">${highlight(m[3],reader.query||reader.highlight)}</div></article>`;
    }).join('') : '<div class="empty-state"><h3>Здесь нет таких записей</h3><p>Измените поисковую фразу или выберите другого участника.</p><button class="button" data-action="reset-reader">Сбросить фильтры</button></div>';
    $('#pagination').innerHTML=`<div class="pagination"><button class="button" data-action="page-prev" ${reader.page===1?'disabled':''}>${icon('back')}Назад</button><label>Страница <input id="page-number" type="number" min="1" max="${pages}" value="${reader.page}" aria-label="Номер страницы"> <span>из ${number(pages)}</span></label><button class="button" data-action="page-next" ${reader.page===pages?'disabled':''}>Далее${icon('arrow')}</button></div><div class="reading-note">Место чтения сохраняется автоматически <span>✦</span></div>`;
    if(slice.length)saveProgress(slice[0][0]);
    if(scroll)$('#reader-top').scrollIntoView({block:'start'});
  }
  function saveProgress(id) { if(!reader)return; progress[reader.id]={topic:reader.id,message:id,updated:Date.now()}; storage.set('progress:v1',progress); }
  function snippet(text,q) { const at=fold(text).indexOf(fold(q)),start=Math.max(0,at-100),end=Math.min(text.length,Math.max(at,0)+q.length+200); return (start?'…':'')+text.slice(start,end)+(end<text.length?'…':''); }
  async function renderSearch(query, version) {
    reader=null;setNav(null); const token=++searchVersion;query=query.trim();
    $('#breadcrumb').innerHTML='<a href="#">Библиотека</a><span>/</span><b>Поиск по перепискам</b>';
    document.title='Поиск: '+query+' · HARDTRP';
    $('#main').innerHTML=`<section class="search-page"><a class="back-link" href="#">${icon('back')}Все хроники</a><div class="eyebrow">МЕЖДУ СТРОК</div><h1>Найти в историях</h1><form id="full-search-form" class="library-search"><label class="search-input">${icon('search')}<input id="full-query" type="search" value="${esc(query)}" placeholder="Имя, место или фраза" aria-label="Поиск по всем перепискам"></label><button class="button search-submit" type="submit">Найти ${icon('arrow')}</button></form><div class="search-status" id="search-status" aria-live="polite"></div><div class="search-progress"><i id="search-progress"></i></div><div class="search-results" id="search-results"></div></section>`;
    if(query.length<2) { $('#search-status').textContent='Введите хотя бы два символа.'; $('#full-query').focus();return; }
    const found=[],needle=fold(query);let count=0,done=0;
    for(const topic of [...C.topics].reverse()) {
      if(token!==searchVersion||version!==routeVersion)return;
      try {
        const records=await loadTopic(topic.id);
        for(let i=0;i<records.length;i++) {
          const m=records[i];
          if(fold(m[3]).includes(needle)){count++;if(found.length<300)found.push({topic,m});}
          if(i>0&&i%3500===0) { await new Promise(r=>setTimeout(r,0));if(token!==searchVersion||version!==routeVersion)return; }
        }
      } catch { if(version===routeVersion)$('#search-status').textContent='Часть файлов недоступна. Проверьте целостность папки сайта.';return; }
      if(token!==searchVersion||version!==routeVersion)return;
      done++;$('#search-progress').style.width=(done/C.topics.length*100)+'%';
      $('#search-status').textContent=`Читаем хроники: ${done} из ${C.topics.length} · найдено ${number(count)}`;
      if(done%8===0||done===C.topics.length)$('#search-results').innerHTML=found.map(({topic:t,m})=>`<a class="search-result" href="#topic=${t.id}&m=${m[0]}&find=${encodeURIComponent(query)}"><div class="result-topic">${esc(t.title)}${icon('arrow')}</div><div class="result-meta">${esc(C.authors[m[2]])}<span>·</span>${date(m[1])}</div><p>${highlight(snippet(m[3],query),query)}</p><span class="result-open">Прочитать в контексте →</span></a>`).join('');
      await new Promise(r=>setTimeout(r,0));
    }
    if(version!==routeVersion)return;
    $('#search-status').textContent=count?`Найдено ${number(count)} ${plural(count,'сообщение','сообщения','сообщений')}${count>300?' · показаны первые 300. Уточните фразу для более точного поиска.':''}`:'Совпадений нет. Попробуйте другое имя или более короткую фразу.';
  }
  function route() {
    const version=++routeVersion;searchVersion++;
    const hash=location.hash.slice(1), params=new URLSearchParams(hash);
    if(params.has('topic'))renderReader(params,version);
    else if(params.has('search')){window.scrollTo(0,0);renderSearch(params.get('search')||'',version);}
    else{renderLibrary(hash==='saved');window.scrollTo(0,0);}
  }
  function goSearch(query) { const next='#search='+encodeURIComponent(query.trim()); if(location.hash===next)route();else location.hash=next; }
  function goMessage(id) { location.hash=`topic=${reader.id}&m=${id}`; }
  function paginate(offset) { if(!reader)return;reader.page+=offset;renderMessages();history.replaceState(null,'',`#topic=${reader.id}&p=${reader.page}`); }
  document.addEventListener('click', event=>{
    const target=event.target.closest('[data-action]');if(!target)return;
    const action=target.dataset.action;
    if(action==='favorite') {
      const id=target.dataset.id;favorites.has(id)?favorites.delete(id):favorites.add(id);storage.set('favorites:v1',[...favorites]);$('#favorite-count').textContent=availableFavoriteCount();
      if($('#cards'))renderCards();else if(reader){const el=$('.reader-favorite');if(el)el.outerHTML=favoriteButton(reader.topic,'reader-favorite');}
      toast(favorites.has(id)?'Хроника добавлена в отложенные':'Хроника убрана из отложенных');
    } else if(action==='clear-library-filter') {libraryQuery='';$('#catalog-query').value='';renderCards();$('#catalog-query').focus();}
    else if(action==='about')$('#about').showModal();
    else if(action==='close-about')$('#about').close();
    else if(action==='menu')document.body.classList.toggle('menu-open');
    else if(action==='close-menu')document.body.classList.remove('menu-open');
    else if(action==='focus-search') { if($('#catalog-query'))$('#catalog-query').focus();else if($('#full-query'))$('#full-query').focus();else goSearch(''); }
    else if(action==='font-down'||action==='font-up') {fontSize=Math.max(16,Math.min(24,fontSize+(action==='font-up'?1:-1)));document.documentElement.style.setProperty('--reading-size',fontSize+'px');storage.set('font:v1',fontSize);if($('#font-size'))$('#font-size').textContent=fontSize;}
    else if(action==='quest-start'||action==='quest-end') {
      if(reader&&reader.records.length){const end=action==='quest-end',record=reader.records[end?reader.records.length-1:0];const hash=`#topic=${reader.id}&m=${record[0]}&edge=${end?'end':'start'}`;if(location.hash===hash)route();else location.hash=hash;}
    }
    else if(action==='page-next')paginate(1);
    else if(action==='page-prev')paginate(-1);
    else if(action==='reply')goMessage(target.dataset.id);
    else if(action==='reset-reader') {reader.query='';reader.author='';reader.highlight='';reader.page=1;$('#reader-query').value='';$('#reader-author').value='';renderMessages(false);}
  });
  document.addEventListener('input',event=>{
    if(event.target.id==='catalog-query'){libraryQuery=event.target.value;renderCards();}
    if(event.target.id==='reader-query'&&reader){reader.query=event.target.value.trim();reader.highlight='';reader.page=1;renderMessages(false);}
  });
  document.addEventListener('change',event=>{
    if(event.target.id==='library-sort'){librarySort=event.target.value;renderCards();}
    if(event.target.id==='reader-author'&&reader){reader.author=event.target.value;reader.page=1;renderMessages(false);}
    if(event.target.id==='page-number'&&reader){reader.page=Number(event.target.value)||1;renderMessages();history.replaceState(null,'',`#topic=${reader.id}&p=${reader.page}`);}
  });
  document.addEventListener('submit',event=>{
    if(event.target.id==='library-form'){event.preventDefault();goSearch($('#catalog-query').value);}
    if(event.target.id==='full-search-form'){event.preventDefault();goSearch($('#full-query').value);}
  });
  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$('[data-action="focus-search"]').click();}
    if(event.key==='Escape')document.body.classList.remove('menu-open');
    if(reader&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)&&!$('#about').open){if(event.key==='ArrowRight')paginate(1);if(event.key==='ArrowLeft')paginate(-1);}
  });
  let scrollTimer;
  window.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{
    if(!reader)return;const records=document.querySelectorAll('[data-message]');let closest=null;
    for(const el of records){if(el.getBoundingClientRect().top<170)closest=el;else break;}
    if(closest)saveProgress(Number(closest.dataset.message));
  },220);},{passive:true});
  window.addEventListener('hashchange',route);
  shell();$('#favorite-count').textContent=availableFavoriteCount();route();
})();
