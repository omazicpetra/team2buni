/* Small, framework-free state layer. Local storage is a presentation convenience,
   never authentication. Server-side membership and records are required to launch. */
(function (root) {
  'use strict';
  const storageKey = 'guild-inside-the-blend-v1';
  const initial = () => ({ version: 1, name: 'You', selected: [], note: '', watched: false, locked: false, vote: null, posts: [], replies: {}, likes: [], questions: [], questionVotes: [], revealed: false, bonus: false, reducedMotion: false });
  function normalise(raw, data) {
    const s = initial();
    if (!raw || raw.version !== 1) return s;
    s.name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 28) : 'You';
    s.selected = [...new Set(Array.isArray(raw.selected) ? raw.selected : [])].filter(v => data.flavours.includes(v)).slice(0, 3);
    s.note = typeof raw.note === 'string' ? raw.note.slice(0, 300) : '';
    for (const key of ['watched','locked','revealed','bonus','reducedMotion']) s[key] = raw[key] === true;
    s.locked = s.locked && s.selected.length > 0;
    s.revealed = s.locked && s.revealed;
    s.vote = data.poll.some(p => p.id === raw.vote) ? raw.vote : null;
    for (const key of ['likes','questionVotes']) s[key] = Array.isArray(raw[key]) ? [...new Set(raw[key].filter(v => typeof v === 'string'))].slice(0, 200) : [];
    for (const key of ['posts','questions']) s[key] = Array.isArray(raw[key]) ? raw[key].filter(v => v && typeof v.id === 'string' && typeof v.text === 'string' && typeof v.name === 'string').slice(0, 100).map(v => ({...v, text: v.text.slice(0,500), name: v.name.slice(0,28)})) : [];
    if (raw.replies && typeof raw.replies === 'object' && !Array.isArray(raw.replies)) {
      for (const [id, replies] of Object.entries(raw.replies).slice(0,100)) {
        if (!/^[a-z0-9-]+$/i.test(id) || !Array.isArray(replies)) continue;
        s.replies[id] = replies.filter(r => r && typeof r.text === 'string' && typeof r.name === 'string').slice(0,100).map(r=>({name:r.name.slice(0,28),text:r.text.slice(0,300)}));
      }
    }
    return s;
  }
  function toggleFlavour(s, flavour, data) {
    if (s.locked || !data.flavours.includes(flavour)) return false;
    if (s.selected.includes(flavour)) { s.selected = s.selected.filter(f => f !== flavour); return true; }
    if (s.selected.length >= 3) return false;
    s.selected.push(flavour); return true;
  }
  function result(s, data) {
    if (!s.locked || !s.revealed) return { points: 0, notes: [] };
    const notes = s.selected.map(name => ({name, points: data.answer.exact.includes(name) ? 2 : data.answer.family.includes(name) ? 1 : 0}));
    return {points: notes.reduce((sum, n) => sum+n.points,0), notes};
  }
  function ranking(s, data) {
    return [...data.members, { id: 'you', name: s.name, initials: 'YOU', points: 6 + result(s,data).points }].sort((a,b)=>b.points-a.points || (a.id==='you'?1:b.id==='you'?-1:a.name.localeCompare(b.name)));
  }
  function pollResults(s, data) {
    const total = data.poll.reduce((n,p)=>n+p.votes,0)+(s.vote?1:0);
    return data.poll.map(p=>({...p, percentage: Math.round(100*(p.votes+(s.vote===p.id?1:0))/total)}));
  }
  root.GuildCore = {storageKey, initial, normalise, toggleFlavour, result, ranking, pollResults};
})(typeof window !== 'undefined' ? window : globalThis);
