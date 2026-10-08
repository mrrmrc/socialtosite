import React, { useLayoutEffect, useRef, useState } from 'react';

const interviewGroups = [
  { id: 'identity', title: 'Identità e offerta', icon: '◎', description: 'Racconta cosa fai e cosa rende unica la tua attività.', fields: [['activity_type', 'La tua attività'], ['offer_summary', 'Prodotti e servizi offerti'], ['differentiators', 'Cosa ti distingue', false, true]] },
  { id: 'audience', title: 'Persone e bisogni', icon: '◉', description: 'A chi ti rivolgi e quali domande vuoi aiutare a risolvere?', fields: [['primary_audience', 'Pubblico principale'], ['secondary_audience', 'Pubblico secondario'], ['customer_needs', 'Bisogni e domande dei clienti'], ['geographic_area', 'Territori di riferimento']] },
  { id: 'goals', title: 'Obiettivi e priorità', icon: '↗', description: 'Definisci la direzione dei tuoi contenuti e del tuo sito.', fields: [['primary_goal', 'Obiettivo principale'], ['desired_action', 'Cosa vorresti che facessero i visitatori'], ['priority_services', 'Servizi e prodotti prioritari', true, true]] },
  { id: 'voice', title: 'La tua voce', icon: '✧', description: 'Come vuoi parlare alle persone che ti seguono?', fields: [['tone_of_voice', 'Tono di voce', false, true]] },
];
const socialGroups = [
  { id: 'identity', title: 'Ritratto dai social', icon: '◎', description: 'La lettura complessiva di LIA: rivedila e rendila fedele a te.', fields: [['summary', 'Sintesi dell’attività', false, true], ['activity_type', 'Tipo di attività'], ['tone', 'Tono osservato']] },
  { id: 'audience', title: 'Persone e territori', icon: '◉', description: 'Le persone e i luoghi che emergono dai contenuti acquisiti.', fields: [['audiences', 'Pubblici individuati', true], ['locations', 'Luoghi citati', true]] },
  { id: 'content', title: 'Temi e contenuti', icon: '▤', description: 'Gli argomenti ricorrenti che caratterizzano la tua presenza social.', fields: [['topics', 'Argomenti ricorrenti', true, true]] },
  { id: 'goals', title: 'Obiettivi e offerta', icon: '↗', description: 'Sono deduzioni di LIA: correggi ciò che non corrisponde alle tue intenzioni.', fields: [['goals', 'Obiettivi dedotti', true], ['offers', 'Servizi e prodotti individuati', true]] },
];

function fieldText(value, list) {
  if (!list) return String(value || '');
  return Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : item?.name || item?.title || item?.description || '').filter(Boolean).join('\n') : '';
}

function ReadingTextarea({ value, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const textarea = ref.current;
    const resize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.ceil(textarea.scrollHeight) + 4}px`;
    };
    resize();
    let previousWidth = textarea.parentElement.clientWidth;
    const observer = new ResizeObserver(() => {
      const width = textarea.parentElement.clientWidth;
      if (width !== previousWidth) { previousWidth = width; resize(); }
    });
    observer.observe(textarea.parentElement);
    return () => observer.disconnect();
  }, [value]);
  return <textarea ref={ref} rows={4} value={value} {...props} />;
}

export function ProfileReviewPanel({ social = false, value = {}, onChange, onSave, busy = false }) {
  const [listDrafts, setListDrafts] = useState({});
  const [activeGroup, setActiveGroup] = useState('identity');
  const groups = social ? socialGroups : interviewGroups;
  const group = groups.find(item => item.id === activeGroup) || groups[0];
  const textFor = ([key, , list]) => list ? listDrafts[key] ?? fieldText(value[key], true) : fieldText(value[key], false);
  const completed = fields => fields.filter(field => textFor(field).trim()).length;
  const fields = groups.flatMap(item => item.fields);
  const filled = completed(fields);
  return <section className="card profile-review-panel profile-reading-workspace">
    <header className="profile-reading-heading">
      <div><span className="profile-reading-eyebrow">{social ? 'LA LETTURA DI LIA' : 'IL TUO RACCONTO'}</span><h2>{social ? 'Cosa emerge dai tuoi social' : 'Le tue risposte a LIA'}</h2><p>{social ? 'Le ipotesi di LIA, organizzate per argomento. Le tue correzioni hanno priorità sulle deduzioni automatiche.' : 'Un argomento alla volta, con tutto lo spazio per leggere e modificare le tue risposte.'}</p></div>
      <div className="profile-reading-progress"><strong>{filled}<span> / {fields.length}</span></strong><span>{social ? 'informazioni presenti' : 'risposte compilate'}</span><progress max={fields.length} value={filled} aria-label={social ? 'Informazioni presenti' : 'Risposte compilate'} /></div>
    </header>
    <div className="profile-reading-body">
      <nav className="profile-reading-nav" aria-label={social ? 'Argomenti dell’analisi social' : 'Argomenti dell’intervista'}>{groups.map(item => <button key={item.id} type="button" aria-pressed={group.id === item.id} onClick={() => setActiveGroup(item.id)}><span className="profile-reading-icon" aria-hidden="true">{item.icon}</span><span><strong>{item.title}</strong><small>{completed(item.fields)} di {item.fields.length} {social ? 'informazioni' : 'risposte'}</small></span><span className="profile-reading-arrow" aria-hidden="true">→</span></button>)}</nav>
      <section className="profile-reading-content" aria-labelledby={`profile-group-${social ? 'social' : 'interview'}`}>
        <header><span className="profile-reading-eyebrow">{social ? 'DA RIVEDERE CON TE' : 'LE TUE INFORMAZIONI'}</span><h3 id={`profile-group-${social ? 'social' : 'interview'}`}>{group.title}</h3><p>{group.description}</p></header>
        <div className="profile-reading-fields">{group.fields.map(field => {
          const [key, label, list, wide] = field;
          return <label key={key} className={wide ? 'is-wide' : ''}><span className="profile-reading-field-title">{label}<small>{textFor(field).trim() ? (social ? 'Da verificare' : 'Compilata') : 'Da completare'}</small></span>{list && <span className="profile-reading-field-help">Una voce per riga</span>}<ReadingTextarea value={textFor(field)} placeholder={social ? 'Aggiungi o correggi le informazioni…' : 'Scrivi qui la tua risposta…'} onChange={event => { const text = event.target.value; if (list) setListDrafts(previous => ({ ...previous, [key]: text })); onChange(key, list ? text.split('\n').map(item => item.trim()).filter(Boolean) : text); }} /></label>;
        })}</div>
        <div className="profile-reading-pagination">{groups.indexOf(group) > 0 && <button type="button" className="btn btn-outline" onClick={() => setActiveGroup(groups[groups.indexOf(group) - 1].id)}>← Argomento precedente</button>}{groups.indexOf(group) < groups.length - 1 && <button type="button" className="btn btn-outline" onClick={() => setActiveGroup(groups[groups.indexOf(group) + 1].id)}>Prossimo argomento →</button>}</div>
      </section>
    </div>
    <footer className="profile-reading-save"><p>{social ? 'Salva tutte le correzioni, anche quelle negli altri argomenti.' : 'Salva tutte le risposte, anche quelle negli altri argomenti.'}</p><button type="button" className="btn btn-primary" disabled={busy} onClick={onSave}>{busy ? 'Salvataggio…' : social ? 'Salva le mie correzioni' : 'Salva le mie risposte'}</button></footer>
  </section>;
}
