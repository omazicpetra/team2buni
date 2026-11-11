/* The complete interface: routes, interactions, dialogs and motion.
   Works by opening index.html directly. No build step, framework or API keys. */
(function () {
  'use strict';
  const D = window.GuildData, C = window.GuildCore;
  const $ = (selector, context = document) => context.querySelector(selector);
  const main = $('#main'), dialog = $('#dialog'), dialogContent = $('#dialog-content');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths = {
    check: '<path d="m5 12 4 4L19 6"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    lock: '<rect x="5" y="10" width="14" height="11"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="10" width="14" height="11"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    down: '<path d="m5 9 7 7 7-7"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    close: '<path d="m5 5 14 14M19 5 5 19"/>',
    calendar: '<rect x="4" y="5" width="16" height="16"/><path d="M4 10h16M8 3v5M16 3v5"/>',
    heart: '<path d="M12 20 4 12C-2 5 7 0 12 7c5-7 14-2 8 5z"/>',
    comment: '<path d="M4 4h16v13H9l-5 4z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    flavour: '<path d="M12 3 21 12 12 21 3 12z"/>',
    paper: '<path d="M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h6"/>',
    reset: '<path d="M4 7v6h6M4 12a8 8 0 1 1 2 6"/>',
    print: '<path d="M7 8V3h10v5M7 17H3V8h18v9h-4M7 14h10v7H7z"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    external: '<path d="M14 3h7v7M21 3l-9 9M10 5H3v16h16v-7"/>',
    minus: '<path d="M5 12h14"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.flavour}</svg>`;
  const avatar = (name = 'YOU', gold = false) => `<span class="avatar${gold ? ' gold' : ''}">${esc(name)}</span>`;
  const initials = name => name === 'You' ? 'YOU' : name.trim().split(/\s+/).map(n=>n[0]).slice(0,2).join('').toUpperCase();
  let storageOK = true, state;
  try { state = C.normalise(JSON.parse(localStorage.getItem(C.storageKey)), D); }
  catch (_) { state = C.initial(); }
  let currentRoute = '', toastTimer, openReplies = new Set(), showAllMembers = false;
  function save() {
    try { localStorage.setItem(C.storageKey, JSON.stringify(state)); }
    catch (_) { storageOK = false; $('#storage-warning').hidden = false; }
  }
  function syncSettings() {
    document.documentElement.classList.toggle('reduce-motion', state.reducedMotion);
    $('#header-avatar').textContent = initials(state.name);
  }
  function toast(text) {
    clearTimeout(toastTimer);
    $('#toast').textContent = text; $('#toast').classList.add('show');
    toastTimer = setTimeout(()=>$('#toast').classList.remove('show'),4200);
  }
  function button(text, action, options = '') { return `<button class="cta ${options}" data-action="${action}">${text}</button>`; }
  function routeLink(route, label, css = '') { return `<a href="#${route}" class="${css}">${label}</a>`; }
  function closeDialog() { if(dialog.open) dialog.close(); }
  function openDialog(title, content, css = '') {
    dialog.className = css;
    dialogContent.innerHTML = `<div class="dialog-inner"><div class="dialog-top"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close" aria-label="Close dialog">${icon('close')}</button></div>${content}</div>`;
    if (!dialog.open) dialog.showModal();
  }
  dialog.addEventListener('close', () => { if (!dialog.open) dialogContent.innerHTML = ''; });
  dialog.addEventListener('click', e => {
    if (e.target === dialog) { const r=dialog.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(); }
  });
  function go(route) {
    closeDialog();
    if ((route==='community'||route==='leaderboard')&&!state.locked) {
      toast('Lock in a flavour guess to join the community.'); route='guess';
    }
    if (location.hash === '#'+route) render(true); else location.hash = route;
  }
  function steps(page) {
    return `<nav class="steps" aria-label="Your unboxing journey">
      <button class="step ${page==='watch'?'active':state.watched?'done':''}" data-route="watch" ${page==='watch'?'aria-current="step"':''}><span class="step-square">${icon(state.watched?'check':'play')}</span>Watch</button>
      <span class="step-line ${state.watched?'done':''}" aria-hidden="true"></span>
      <button class="step ${page==='guess'?'active':state.locked?'done':''}" data-route="guess" ${page==='guess'?'aria-current="step"':''}><span class="step-square">${icon(state.locked?'check':'flavour')}</span>Guess</button>
      <span class="step-line ${state.locked?'done':''}" aria-hidden="true"></span>
      <button class="step ${state.locked?'done':''}" data-route="community" aria-label="${state.locked?'Join the community':'Community — unlock by guessing'}"><span class="step-square">${icon(state.locked?'check':'lock')}</span>Community</button>
    </nav>`;
  }
  function pointTiles() { return `<div class="point-grid"><div class="point-tile"><strong>2 pts</strong><span>Exact flavour</span></div><div class="point-tile"><strong>1 pt</strong><span>Right flavour family</span></div></div>`; }
  function tabs(page) { return `<nav class="community-tabs" aria-label="Member area">${routeLink('community','Community',page==='community'?'active':'')}${routeLink('leaderboard','Leaderboard',page==='leaderboard'?'active':'')}</nav>`; }
  function watchPage() {
    return `${steps('watch')}<section class="hero watch-hero"><p class="eyebrow">November mystery flavour · From your box</p><h1>How we crafted this month’s secret.</h1><p class="lead">You scanned the code in your box. Watch the founders explain how this month’s flavour came to life, then taste it and make your guess.</p></section>
    <div class="split stagger"><section style="--i:1"><div class="video-wrap"><button class="video-poster" data-action="video" data-tilt aria-label="Play Moersleutel’s brewers video"><img src="assets/brewers-video.jpg" alt="Moersleutel brewers Rowan and Mark discussing the anniversary beers" width="1280" height="720" fetchpriority="high"><span class="video-label">Founders’ note · November</span><span class="play-button">${icon('play')}</span></button></div><div class="video-foot"><p class="caption">A closer look at the people, ingredients and little decisions behind the beer.</p><button class="text-button" data-action="story">Read the story</button></div><p class="caption">Reference clip: Moersleutel’s brewers Rowan &amp; Mark. A dedicated founder film would replace this in the final experience.</p></section>
    <aside class="watch-side" style="--i:2"><div class="panel hints-panel"><h2>Listen for the hints</h2>${D.hints.map(h=>`<details class="hint"><summary><span class="hint-mark">${icon('plus')}</span><span>${esc(h.title)}</span>${icon('down')}</summary><p><small>Sample mystery hint</small>${esc(h.detail)}</p></details>`).join('')}</div><div class="watch-action">${button(`${state.locked?'See my locked-in guess':'I’ve tasted it, make my guess'}${icon('chevron')}`,'guess','full')}<p class="locked-note">${icon(state.locked?'unlock':'lock')}<span>${state.locked?'Your guess is saved. The Guild community is open to you.':'The community, leaderboard and founder Q&A unlock once you’ve guessed.'}</span></p></div></aside></div>`;
  }
  function guessPage() {
    return `${steps('guess')}<section class="hero"><h1>${state.locked?'Your guess is in.':'What’s hiding under the tape?'}</h1><p class="lead">${state.locked?'The best part is comparing notes. Join the Guild while we wait for the shared reveal.':'Pick up to three flavours you can taste. Close counts: the right flavour family earns points too.'}</p></section>
    <div class="split stagger"><section class="panel" style="--i:1"><div class="field-header"><h2 class="eyebrow">Flavour notes</h2><span class="selection-count" id="selection-count" aria-live="polite">${state.selected.length} of 3 picked</span></div><div class="flavours" role="group" aria-label="Choose up to three flavours">${D.flavours.map(f=>`<button class="flavour" data-flavour="${esc(f)}" aria-pressed="${state.selected.includes(f)}" ${state.locked?'disabled':''}>${state.selected.includes(f)?icon('check'):''}${esc(f)}</button>`).join('')}</div><div class="field"><label for="tasting-note" class="eyebrow">In your own words <span>(optional)</span></label><textarea id="tasting-note" placeholder="Anything else you taste or smell?" maxlength="300" ${state.locked?'readonly':''}>${esc(state.note)}</textarea></div><p class="helper">${state.locked?'Your selection is locked until the reveal.':'Trust your palate. There’s no need to be an expert.'}</p></section>
    <aside class="panel outline guess-summary" style="--i:2"><p class="eyebrow">Your guess</p><h2 id="guess-title">${state.selected.length?esc(state.selected.join(' · ')):'<span class="empty-guess">Your palate, your call.</span>'}</h2>${pointTiles()}<div class="reveal-note">${icon('calendar')}<p><strong>Reveal: ${D.revealLabel}.</strong> The whole Guild finds out together.</p></div>${state.locked?button(`Join the community ${icon('chevron')}`,'community','full'):`<button id="lock-guess" class="cta full" data-action="confirm-guess" ${state.selected.length?'':'disabled'}>${icon('lock')} Lock in my guess</button>`}<p class="helper">${state.locked?'Saved on this device.':'Guessing unlocks the Guild community, the leaderboard and the founder Q&A.'}</p></aside></div><button class="back-link" data-route="watch">${icon('back')} Back to the founders’ note</button>`;
  }
  function goalPanel(compact=false) {
    const progress=state.bonus?80:64;
    return `<section class="panel goal-panel"><p class="eyebrow">Guild goal</p><h2>${state.bonus?'We did it. The bonus is unlocked.':compact?'A little curiosity goes a long way.':'When 80% of us have guessed, the founders release a bonus clip to everyone.'}</h2>${compact&&!state.bonus?'<p class="section-copy">At 80% guessed, a bonus clip opens for the whole Guild.</p>':''}<div class="progress" role="progressbar" aria-label="Guild participation" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><div class="progress-fill" style="--progress:${progress}%"></div><span class="target" aria-hidden="true"></span></div><div class="progress-label"><span>${progress}% of the Guild has guessed</span><span class="target-label">80% GOAL</span></div>${state.bonus?`<button class="text-button" style="margin-top:18px" data-action="bonus-video">${icon('play')} Watch the bonus</button>`:''}</section>`;
  }
  function miniBoard() {
    const ranking=C.ranking(state,D),you=ranking.findIndex(m=>m.id==='you');
    const row=(m,i)=>`<button class="mini-rank${m.id==='you'?' you':''}" data-member="${m.id}" aria-label="${esc(m.name)}, rank ${i+1}, ${m.points} points"><span class="rank-number">${i+1}</span>${avatar(m.id==='you'?initials(state.name):m.initials,m.id==='you')}<span>${m.id==='you'?'Your score':esc(m.name)}</span><strong>${m.points}</strong></button>`;
    return `<section class="panel outline mini-board"><h2>Top guessers</h2><p class="caption">Sharpest palates this season</p>${ranking.slice(0,5).filter(m=>m.id!=='you').map(m=>row(m,ranking.indexOf(m))).join('')}${row(ranking[you],you)}<button class="text-button" data-route="leaderboard">Open the full dashboard ${icon('chevron')}</button></section>`;
  }
  function poll() {
    return `<section class="content-section"><h2>Shape the next box</h2><p class="section-copy">Vote on the flavour you’d love the founders to brew next.</p><div class="poll-options" role="group" aria-label="Vote for the next flavour">${C.pollResults(state,D).map(p=>`<button class="poll-option" data-vote="${p.id}" aria-pressed="${state.vote===p.id}" style="--percent:${p.percentage}%"><span>${esc(p.name)}${state.vote===p.id?' <span class="vote-mark">· Your vote</span>':''}</span><strong>${p.percentage}%</strong></button>`).join('')}</div><p class="poll-confirmation" aria-live="polite">${state.vote?'Your vote is in. Select another flavour to change it.':'One member, one vote. Pick your favourite.'}</p></section>`;
  }
  function allPosts() { return [...state.posts,...D.posts]; }
  function postMarkup(p) {
    const replies=[...(p.replies||[]),...(state.replies[p.id]||[])], liked=state.likes.includes(p.id), open=openReplies.has(p.id);
    return `<article class="post" id="post-${esc(p.id)}"><div class="post-top">${avatar(p.own?initials(p.name):p.initials,p.own)}<div class="post-body"><div class="post-meta"><strong>${esc(p.name)}</strong><time>${p.own?'Just now':esc(p.time)}</time></div><p class="post-text">${esc(p.text)}</p><div class="post-actions"><button data-replies="${esc(p.id)}" aria-expanded="${open}" aria-controls="replies-${esc(p.id)}">${replies.length} ${replies.length===1?'reply':'replies'}</button><button class="${liked?'liked':''}" data-like="${esc(p.id)}" aria-pressed="${liked}" aria-label="${liked?'Unlike':'Like'} ${esc(p.name)}’s post">${icon('heart')}<span>${(p.likes||0)+(liked?1:0)}</span></button></div></div></div><div class="replies" id="replies-${esc(p.id)}" ${open?'':'hidden'}>${replies.map(r=>`<div class="reply"><strong>${esc(r.name)}</strong><p>${esc(r.text)}</p></div>`).join('')}<form class="inline-form" data-form="reply" data-post-id="${esc(p.id)}"><input type="text" name="reply" maxlength="300" placeholder="Add a reply…" aria-label="Reply to ${esc(p.name)}" required><button class="cta" type="submit">Reply</button></form></div></article>`;
  }
  function conversation() {
    return `<section class="conversation" id="conversation"><h2>Conversation</h2><div id="posts">${allPosts().map(postMarkup).join('')}</div><form class="compose" data-form="post"><label for="new-post">Say something to the Guild</label><textarea id="new-post" name="post" maxlength="500" placeholder="What caught your attention?" required></textarea><div class="compose-bottom"><span>Keep flavour reveals for the shared reveal.</span><button class="cta" type="submit">Post to the Guild</button></div></form></section>`;
  }
  function communityPage() {
    const result=C.result(state,D);
    return `<div class="page-heading"><div><p class="eyebrow">November box</p><h1>The Guild community</h1></div>${tabs('community')}</div><div class="status-banner"><span class="check-box">${icon('check')}</span><div><strong>Guess locked in: ${esc(state.selected.join(' · '))}</strong><p>${state.revealed?`The secret is out. You earned ${result.points} ${result.points===1?'point':'points'} this edition.`:`Community unlocked. The reveal is on ${D.revealLabel}.`}</p></div><button class="text-button" data-action="${state.revealed?'results':'saved-guess'}">${state.revealed?'See the reveal':'View guess'}</button></div><div class="split stagger"><div style="--i:1">${goalPanel()}${poll()}${conversation()}</div><aside class="sidebar-stack" style="--i:2">${miniBoard()}<section class="qa-invite"><p class="eyebrow">At the brewers’ bench</p><h3>Ask the founders</h3><p>Curious about the blend? Add your question, or vote for one you’d like the team to answer.</p>${button('Join the Q&A','qa','secondary full')}</section><p class="caption">Members, participation and scores shown here are sample content for the project.</p></aside></div>`;
  }
  function historyPanel() {
    const result=C.result(state,D);
    return `<section class="panel outline history-panel"><h2>Your recent editions</h2><div class="history-grid">${D.history.map((h,i)=>`<button class="history-box" data-history="${i}">${icon(h.result==='Exact'?'check':h.result==='Close'?'minus':'close')}<div><span>${h.edition}</span><strong>${h.result}</strong></div></button>`).join('')}<button class="history-box current" data-action="${state.revealed?'results':'saved-guess'}">${icon(state.revealed?'check':'clock')}<div><span>November</span><strong>${state.revealed?`+${result.points} points`:'Reveal 29 Nov'}</strong></div></button></div></section>`;
  }
  function leaderboardPage() {
    const ranks=C.ranking(state,D),you=ranks.findIndex(m=>m.id==='you');
    function rank(m,i){return `<button class="rank-row${m.id==='you'?' you':''}${i>2?' muted-rank':''}" data-member="${m.id}" aria-label="${esc(m.name)}, rank ${i+1}, ${m.points} points"><span class="rank-number">${i+1}</span>${avatar(m.id==='you'?initials(state.name):m.initials,m.id==='you')}<span><span class="rank-name">${m.id==='you'?'Your score':esc(m.name)}</span><span class="progress"><span class="progress-fill" style="--progress:${100*m.points/17}%;display:block"></span></span></span><strong class="rank-points">${m.points}</strong></button>`;}
    return `<div class="page-heading"><div><p class="eyebrow">The Guild · Dashboard</p><h1>Sharpest palates this season</h1></div>${tabs('leaderboard')}</div><p class="lead board-description">Points from every mystery flavour. The ranking resets each quarter, so anyone can climb back in.</p><div class="split stagger"><section class="full-board" style="--i:1"><h2 class="eyebrow">Correct guesses · Points this quarter</h2>${(showAllMembers?ranks:ranks.slice(0,6)).filter(m=>m.id!=='you').map(m=>rank(m,ranks.indexOf(m))).join('')}<button class="board-more" data-action="toggle-board">${showAllMembers?'Show top six':'See all members'} ${icon('down')}</button>${rank(ranks[you],you)}<p class="caption">Illustrative season totals. Points reward flavour guesses, never how much someone drinks.</p></section><aside class="sidebar-stack" style="--i:2"><section class="panel"><h2>How points work</h2>${pointTiles()}<p class="helper">Up to 2 points per selected note. New points are added once, at the shared reveal.</p></section>${historyPanel()}${goalPanel(true)}</aside></div>`;
  }
  function setupTilt() {
    if (state.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover: hover)').matches) return;
    document.querySelectorAll('[data-tilt]').forEach(el=>{
      el.addEventListener('pointermove',e=>{const r=el.getBoundingClientRect();el.style.setProperty('--rx',`${-(e.clientY-r.top-r.height/2)/r.height*3}deg`);el.style.setProperty('--ry',`${(e.clientX-r.left-r.width/2)/r.width*3}deg`);});
      el.addEventListener('pointerleave',()=>{el.style.setProperty('--rx','0deg');el.style.setProperty('--ry','0deg');});
    });
  }
  function render(navigate=false) {
    let route=location.hash.slice(1).split('?')[0]||'watch';
    if (!['watch','guess','community','leaderboard'].includes(route)) route='watch';
    if((route==='community'||route==='leaderboard')&&!state.locked){history.replaceState(null,'','#guess');route='guess';toast('Make a guess to unlock this part of the Guild.');}
    currentRoute=route;
    const pages={watch:watchPage,guess:guessPage,community:communityPage,leaderboard:leaderboardPage};
    const update=()=>{
      main.innerHTML=`<div class="route-view">${pages[route]()}</div>`;
      document.title=({watch:'The founders’ note',guess:'Your flavour guess',community:'The Guild community',leaderboard:'The leaderboard'})[route]+' · The Guild';
      syncSettings();setupTilt();
      if(navigate){window.scrollTo({top:0,behavior:'instant'});main.focus({preventScroll:true});}
    };
    // Synchronous route updates keep quick clicks reliable. CSS handles the
    // fade/slide entrance without putting a screenshot layer over controls.
    update();
  }
  function openVideo(type='main') {
    state.watched=true;save();
    const videoId=type==='qa'?D.founderQaVideoId:D.videoId;
    const title=type==='qa'?'A conversation with Pim & Rowan':type==='bonus'?'Inside the barrel room':'From the brewers’ bench';
    openDialog(title,`<div class="video-embed"><iframe title="${title}" src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0${type==='bonus'?'&start=1098':''}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><p class="caption">${type==='qa'?'Official Moersleutel Q&A with co-founder Pim and head brewer Rowan.':'Official Moersleutel reference video with brewers Rowan and Mark. This is a stand-in for the proposed exclusive founder film; the sample mystery hints are not from this recording.'}</p><div class="dialog-actions"><a class="cta secondary" href="https://www.youtube.com/watch?v=${videoId}${type==='bonus'?'&t=1098s':''}" target="_blank" rel="noopener noreferrer">Open on YouTube ${icon('external')}</a>${button(state.locked?'Return to the community':'Make my guess',state.locked?'community':'guess')}</div>`,'video-dialog');
  }
  function openMenu() {
    openDialog('Inside the Guild',`<p class="eyebrow">November edition</p><nav class="menu-links" aria-label="Main navigation">${routeLink('watch','The founders’ note '+icon('play'))}${routeLink('guess','Your flavour guess '+icon('flavour'))}${routeLink('community','The community '+icon(state.locked?'comment':'lock'))}${routeLink('leaderboard','The leaderboard '+icon(state.locked?'chevron':'lock'))}<button data-action="insert">The paper in your box ${icon('paper')}</button><button data-action="profile">Your member profile ${avatar(initials(state.name),true)}</button><a href="https://moersleutel.com/guild/" target="_blank" rel="noopener noreferrer">About The Guild ${icon('external')}</a><a href="https://moersleutel.com/shop/" target="_blank" rel="noopener noreferrer">Moersleutel shop ${icon('external')}</a></nav><button class="text-button" data-action="demo">Presentation controls</button>`);
  }
  function openStory() {
    openDialog('A story in every box',`<p class="eyebrow">The idea behind the experience</p><p class="dialog-copy">Moersleutel began with four brothers in Alkmaar in 2016. Their engineering mindset still shapes how they experiment, refine recipes and build their own brewing equipment.</p><p class="dialog-copy">For this concept, an exclusive founder film brings that process to the moment you open your Guild box. One flavour stays a mystery. Listen for the details, make your own judgement, then compare notes with the community.</p><p class="helper">The November recipe and clues are illustrative. The official reference clip is a conversation with brewers Rowan and Mark, not a recording of this proposed mystery.</p><div class="dialog-actions">${button('Watch the reference clip','video')}${button('Make my guess','guess','secondary')}</div>`);
  }
  function openProfile() {
    const ranks=C.ranking(state,D),rank=ranks.findIndex(m=>m.id==='you')+1;
    openDialog('Your place in the Guild',`<div class="profile-summary">${avatar(initials(state.name),true)}<div><h3>${esc(state.name)}</h3><p>Rank ${rank} · ${6+C.result(state,D).points} points this season</p></div></div><form data-form="profile"><div class="field"><label class="eyebrow" for="display-name">Your display name</label><input type="text" id="display-name" name="name" value="${esc(state.name)}" maxlength="28" required autocomplete="off"></div><label class="toggle-row" for="reduce-motion">Reduce animations<input type="checkbox" id="reduce-motion" ${state.reducedMotion?'checked':''}></label><p class="helper">This presentation uses a sample member profile. Your changes stay in this browser.</p><div class="dialog-actions"><button class="cta" type="submit">Save profile</button></div></form>`);
  }
  function openDemo() {
    openDialog('Presentation controls',`<p class="dialog-copy">Walk through the full experience without waiting for the reveal date.</p><button class="demo-button" data-action="insert">${icon('paper')}<span>Show the paper insert<small>Working QR and peelable tape</small></span></button><button class="demo-button" data-action="demo-reveal" ${state.locked?'':'disabled'}>${icon('eye')}<span>${state.revealed?'Hide the shared reveal':'Show the shared reveal'}<small>${state.locked?'Updates your result and the leaderboard':'Lock in a guess first'}</small></span></button><button class="demo-button" data-action="demo-bonus">${icon('play')}<span>${state.bonus?'Return Guild goal to 64%':'Reach the 80% Guild goal'}<small>Demonstrate the community bonus</small></span></button><button class="demo-button" data-action="reset-confirm">${icon('reset')}<span>Restart the experience<small>Clear this browser’s sample guesses, votes and posts</small></span></button><p class="helper">A working front-end prototype. Members, messages and totals are sample data; changes are stored on this device. No real account is connected.</p>`);
  }
  function openQa() {
    if(!state.locked){go('guess');toast('Make your guess first to join the founders’ Q&A.');return;}
    const qs=[...state.questions,...D.questions];
    openDialog('Ask the founders',`<p class="dialog-copy">What would you ask the people behind the beer? Add a question, or support one already on the bench.</p><div>${qs.map(q=>`<article class="qa-question"><button class="upvote" data-question-vote="${esc(q.id)}" aria-pressed="${state.questionVotes.includes(q.id)}" aria-label="Support question: ${esc(q.text)}">${icon('down')}<span>${(q.votes||0)+(state.questionVotes.includes(q.id)?1:0)}</span></button><div><p>${esc(q.text)}</p><small>${esc(q.name)}</small></div></article>`).join('')}</div><form class="qa-form" data-form="question"><label for="new-question">Your question</label><textarea id="new-question" name="question" maxlength="300" placeholder="Something you’ve always wondered about…" required></textarea><button class="cta" type="submit">Add my question</button></form><p class="helper">Questions are saved locally for this presentation. They are not sent to Moersleutel.</p><button class="text-button" style="margin-top:18px" data-action="qa-video">Watch Moersleutel’s real founder Q&A</button>`);
  }
  function openSavedGuess() {
    openDialog('Your flavour guess',`<p class="eyebrow">November edition · Locked in</p><h3>${esc(state.selected.join(' · '))}</h3>${state.note?`<p class="dialog-copy">${esc(state.note)}</p>`:''}${pointTiles()}<div class="reveal-note">${icon('calendar')}<p>We reveal the mystery together on <strong>${D.revealLabel}.</strong></p></div><div class="dialog-actions">${button('Back to the community','community')}</div>`);
  }
  function openResults() {
    if(!state.revealed){openSavedGuess();return;}
    const result=C.result(state,D);
    openDialog('The secret is out.',`<p class="eyebrow">November reveal · Sample recipe</p><h3>${esc(D.answer.name)}</h3><p class="dialog-copy">A dark, rounded sweetness with a gently warming finish. Here’s how your notes matched the sample blend.</p>${result.notes.map(n=>`<div class="answer-line"><span>${esc(n.name)}</span><strong>${n.points===2?'Exact · 2 pts':n.points===1?'Flavour family · 1 pt':'A different note · 0 pts'}</strong></div>`).join('')}<div class="score-card"><p>${result.points?'A little curiosity paid off.':'Every palate notices something different.'}<br>Your season score is now ${6+result.points}.</p><strong>+${result.points} pts</strong></div><div class="dialog-actions">${button('See the leaderboard','leaderboard')}${button('Compare notes','community','secondary')}</div>`);
  }
  function openInsert() {
    openDialog('The paper in your box',`<div class="paper-scene"><article class="paper" data-tilt><div class="paper-head"><div class="brand"><span>MOERSLEUTEL</span><small>BEER ENGINEERS</small></div><p class="eyebrow">The Guild ·<br>November box</p></div><h3>Don’t open the bottles just yet.</h3><p>One flavour in this box is a secret. Scan the code, hear its story, then taste it and make your guess.</p><div class="paper-qr"><a href="#watch" aria-label="Open the Guild experience"><img src="assets/guild-qr.svg" alt="QR code linking to this Guild experience" width="124" height="124"></a><div><strong>Step inside<br>the Guild.</strong><p>No app needed.<br>Your phone camera is enough.</p></div></div><div class="tape-area"><p class="eyebrow">This edition’s mystery flavour</p><div class="secret-label">${esc(D.answer.name)}</div><button class="tape" data-action="peel" aria-label="Peel the mystery flavour tape">Guess first · Then peel</button></div><div class="paper-steps"><span>${icon('paper')}Scan</span><span>${icon('play')}Watch</span><span>${icon('flavour')}Taste</span><span>${icon('check')}Guess</span></div></article></div><div class="insert-actions">${button('Open the experience','watch')}${button(`${icon('print')} Print insert`,'print','secondary')}</div><p class="helper">Sample insert. Print, then cover the flavour with an opaque strip. The QR opens this private demo; access requires the owner’s sign-in.</p>`,'insert-dialog');
    setupTilt();
  }
  function openMember(id) {
    const ranking=C.ranking(state,D),i=ranking.findIndex(m=>m.id===id),m=ranking[i]; if(!m)return;
    if(id==='you'){openProfile();return;}
    openDialog(esc(m.name),`<div class="profile-summary">${avatar(m.initials)}<div><h3>${m.points} points</h3><p>Rank ${i+1} this season</p></div></div><p class="dialog-copy" style="margin-top:20px">Part of the Guild’s flavour conversation. This member and score are sample content for the project.</p><div class="dialog-actions">${button('Back to the leaderboard','leaderboard')}</div>`);
  }
  const searchPages=[
    {title:'The founders’ note',description:'Watch the video and find the mystery hints',route:'watch',terms:'story film brewers ingredients watch video'},
    {title:'Your flavour guess',description:'Pick up to three notes from your box',route:'guess',terms:'taste flavours honey citrus coffee chocolate tape'},
    {title:'The Guild community',description:'Vote for the next box and compare notes',route:'community',terms:'conversation replies comments voting poll'},
    {title:'The leaderboard',description:'Season rankings and your recent editions',route:'leaderboard',terms:'score points rank dashboard history'},
    {title:'Ask the founders',description:'Questions from the Guild',action:'qa',terms:'question answer q&a founder'},
    {title:'The paper insert',description:'QR code and the hidden flavour',action:'insert',terms:'scan print paper box tape'}
  ];
  function searchMarkup(query='') {
    const q=query.toLowerCase().trim(),list=searchPages.filter(p=>(p.title+' '+p.description+' '+p.terms).toLowerCase().includes(q));
    return list.length?list.map(p=>`<button class="search-result" ${p.route?`data-route="${p.route}"`:`data-action="${p.action}"`}><div><strong>${p.title}</strong><span>${p.description}</span></div>${icon('chevron')}</button>`).join(''):'<p class="dialog-copy">No matches. Try “flavour”, “community” or “points”.</p>';
  }
  const actions={
    menu:openMenu,close:closeDialog,video:()=>openVideo(),'qa-video':()=>openVideo('qa'),'bonus-video':()=>openVideo('bonus'),story:openStory,
    profile:openProfile,demo:openDemo,qa:openQa,insert:openInsert,'saved-guess':openSavedGuess,results:openResults,
    watch:()=>go('watch'),guess:()=>{state.watched=true;save();go('guess');},community:()=>go('community'),leaderboard:()=>go('leaderboard'),
    search:()=>{openDialog('Find your way around',`<label class="eyebrow" for="guild-search">Search the Guild</label><input id="guild-search" type="search" autocomplete="off" placeholder="Try flavours, community, points…"><div id="search-results" class="search-results">${searchMarkup()}</div>`);$('#guild-search').focus();},
    'confirm-guess':()=>{
      if(!state.selected.length||state.locked)return;
      openDialog('Ready to lock it in?',`<p class="eyebrow">Your November guess</p><h3>${esc(state.selected.join(' · '))}</h3><p class="dialog-copy">Your selection stays locked until the shared reveal. Once it’s in, you can join the conversation, shape the next box and ask the founders a question.</p><div class="dialog-actions">${button(`${icon('lock')} Lock in & join`,'lock-confirmed')}${button('Keep tasting notes','close','secondary')}</div>`);
    },
    'lock-confirmed':()=>{
      if(state.locked||!state.selected.length)return;
      state.locked=true;state.watched=true;save();go('community');toast('Your guess is locked in. Welcome to the conversation.');
    },
    'toggle-board':()=>{showAllMembers=!showAllMembers;render();},
    'demo-reveal':()=>{if(!state.locked)return;state.revealed=!state.revealed;save();closeDialog();render();if(state.revealed)openResults();else toast('The November reveal is hidden again.');},
    'demo-bonus':()=>{state.bonus=!state.bonus;save();closeDialog();render();toast(state.bonus?'The Guild reached 80%. The bonus is unlocked.':'The sample Guild goal is back to 64%.');},
    'reset-confirm':()=>openDialog('Start fresh?',`<p class="dialog-copy">This clears your sample guess, votes, messages and profile in this browser. The original sample members and content will remain.</p><div class="dialog-actions">${button('Restart experience','reset')}${button('Keep my progress','close','secondary')}</div>`),
    reset:()=>{state=C.initial();openReplies.clear();showAllMembers=false;save();go('watch');toast('Ready for a fresh unboxing.');},
    peel:()=>{if(!state.locked){toast('Guess first. The tape is ready to peel once your guess is locked in.');return;}$('.tape',dialog)?.classList.add('peeled');$('.tape-area',dialog)?.classList.add('is-peeled');toast('A little secret, revealed. Scores update at the shared reveal.');},
    print:()=>window.print()
  };
  document.addEventListener('click',e=>{
    const b=e.target.closest('button,a');if(!b||b.disabled)return;
    if(b.matches('a[href="#main"]')){e.preventDefault();main.focus();return;}
    if(b.matches('a[href^="#"]')){e.preventDefault();go(b.getAttribute('href').slice(1));return;}
    if(b.dataset.route){go(b.dataset.route);return;}
    if(b.dataset.action){actions[b.dataset.action]?.();return;}
    if(b.dataset.flavour){
      const changed=C.toggleFlavour(state,b.dataset.flavour,D);
      if(!changed){toast('Three notes is the limit. Deselect one to try another.');b.classList.add('shake');setTimeout(()=>b.classList.remove('shake'),450);return;}
      save();
      document.querySelectorAll('[data-flavour]').forEach(el=>{const selected=state.selected.includes(el.dataset.flavour);el.setAttribute('aria-pressed',String(selected));el.innerHTML=(selected?icon('check'):'')+esc(el.dataset.flavour);});
      $('#selection-count').textContent=`${state.selected.length} of 3 picked`;
      $('#guess-title').innerHTML=state.selected.length?esc(state.selected.join(' · ')):'<span class="empty-guess">Your palate, your call.</span>';
      $('#lock-guess').disabled=!state.selected.length;
    }
    if(b.dataset.vote&&state.locked){
      state.vote=b.dataset.vote;save();
      for(const p of C.pollResults(state,D)){const el=$(`[data-vote="${p.id}"]`);el.style.setProperty('--percent',p.percentage+'%');el.setAttribute('aria-pressed',String(p.id===state.vote));el.innerHTML=`<span>${esc(p.name)}${p.id===state.vote?' <span class="vote-mark">· Your vote</span>':''}</span><strong>${p.percentage}%</strong>`;}
      $('.poll-confirmation').textContent='Your vote is in. Select another flavour to change it.';
    }
    if(b.dataset.replies){const id=b.dataset.replies;openReplies.has(id)?openReplies.delete(id):openReplies.add(id);b.setAttribute('aria-expanded',String(openReplies.has(id)));$('#replies-'+id).hidden=!openReplies.has(id);}
    if(b.dataset.like&&state.locked){const id=b.dataset.like,p=allPosts().find(p=>p.id===id);if(!p)return;state.likes.includes(id)?state.likes=state.likes.filter(v=>v!==id):state.likes.push(id);save();const liked=state.likes.includes(id);b.classList.toggle('liked',liked);b.setAttribute('aria-pressed',String(liked));b.setAttribute('aria-label',(liked?'Unlike':'Like')+' '+p.name+'’s post');$('span',b).textContent=(p.likes||0)+(liked?1:0);}
    if(b.dataset.member){openMember(b.dataset.member);}
    if(b.dataset.history){const h=D.history[Number(b.dataset.history)];if(h)openDialog(h.edition+' edition',`<p class="eyebrow">Your tasting history · Sample</p><h3>${esc(h.note)}</h3><p class="dialog-copy">${h.result==='Exact'?'An exact match.':h.result==='Close'?'You found the right flavour family.':'A different note this time.'} This note earned ${h.points} ${h.points===1?'point':'points'}.</p><div class="dialog-actions">${button('Back to my dashboard','leaderboard')}</div>`);}
    if(b.dataset.questionVote&&state.locked){const id=b.dataset.questionVote;state.questionVotes.includes(id)?state.questionVotes=state.questionVotes.filter(v=>v!==id):state.questionVotes.push(id);save();const q=[...D.questions,...state.questions].find(q=>q.id===id);b.setAttribute('aria-pressed',String(state.questionVotes.includes(id)));$('span',b).textContent=(q?.votes||0)+(state.questionVotes.includes(id)?1:0);}
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='tasting-note'&&!state.locked){state.note=e.target.value.slice(0,300);save();}
    if(e.target.id==='guild-search')$('#search-results').innerHTML=searchMarkup(e.target.value);
  });
  document.addEventListener('change',e=>{if(e.target.id==='reduce-motion'){state.reducedMotion=e.target.checked;save();syncSettings();}});
  document.addEventListener('submit',e=>{
    const form=e.target,kind=form.dataset.form;if(!kind)return;e.preventDefault();
    const values=new FormData(form);
    const id=prefix=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
    if(kind==='profile'){const name=String(values.get('name')||'').trim().slice(0,28);if(!name){toast('Add a display name first.');return;}state.name=name;save();closeDialog();render();toast('Your profile is saved.');return;}
    if(!state.locked){toast('Lock in your guess first.');return;}
    if(kind==='post'){const text=String(values.get('post')||'').trim().slice(0,500);if(!text){toast('Write a message first.');return;}state.posts.unshift({id:id('post'),name:state.name,text,own:true,likes:0,replies:[]});save();$('#posts').innerHTML=allPosts().map(postMarkup).join('');form.reset();toast('Added to the demo conversation.');}
    if(kind==='reply'){const text=String(values.get('reply')||'').trim().slice(0,300),postId=form.dataset.postId;if(!text){toast('Write a reply first.');return;}if(!allPosts().some(p=>p.id===postId))return;(state.replies[postId]??=[]).push({name:state.name,text});openReplies.add(postId);save();$('#post-'+postId).outerHTML=postMarkup(allPosts().find(p=>p.id===postId));toast('Your reply has been added.');}
    if(kind==='question'){const text=String(values.get('question')||'').trim().slice(0,300);if(!text){toast('Write your question first.');return;}state.questions.unshift({id:id('question'),name:state.name,text,votes:0});save();openQa();toast('Your question is on the demo bench.');}
  });
  window.addEventListener('hashchange',()=>render(true));
  save();syncSettings();render();
})();
