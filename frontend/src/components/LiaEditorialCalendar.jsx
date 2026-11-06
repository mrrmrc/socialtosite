import React, { useState } from 'react';
import './LiaEditorialCalendar.css';

const CHANNELS={site:'Sito web',instagram:'Instagram',facebook:'Facebook',linkedin:'LinkedIn',tiktok:'TikTok',x:'X'};
const STATES={todo:'Da fare',in_progress:'In lavorazione',in_review:'Da revisionare',approved:'Approvata',done:'Completata'};
const civil=value=>new Date(`${value}T12:00:00`);
const key=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const add=(date,days)=>{const next=new Date(date);next.setDate(next.getDate()+days);return next};
const monday=date=>add(date,-((date.getDay()+6)%7));
const valid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(civil(value).getTime())&&key(civil(value))===value;
const today=()=>{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const part=type=>parts.find(item=>item.type===type).value;return `${part('year')}-${part('month')}-${part('day')}`};
const label=(date,options)=>date.toLocaleDateString('it-IT',options);

function CalendarTask({task,onOpen}) {
  return <button type="button" className={`lec-task is-${task.status}`} onClick={()=>onOpen(task.id)} aria-label={`Apri attività: ${task.title}`}><span>{task.time||'Orario da definire'} · {CHANNELS[task.channel]||'Canale da definire'}</span><strong>{task.title}</strong><small>{[task.format,STATES[task.status]||'Da fare'].filter(Boolean).join(' · ')}</small></button>;
}

export function LiaEditorialCalendar({tasks=[],onOpen,onGenerate,disabled=false}) {
  const dated=tasks.filter(task=>valid(task.date));
  const first=[...dated].sort((a,b)=>a.date.localeCompare(b.date))[0]?.date||today();
  const [anchor,setAnchor]=useState(first);
  const [selected,setSelected]=useState(first);
  const [view,setView]=useState('week');
  const [channel,setChannel]=useState('all');
  const [status,setStatus]=useState('all');
  const filtered=dated.filter(task=>(channel==='all'||task.channel===channel)&&(status==='all'||task.status===status)).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99')||a.title.localeCompare(b.title));
  const current=civil(anchor);
  const monthStart=new Date(current.getFullYear(),current.getMonth(),1,12);
  const weekStart=monday(current);
  const monthDays=new Date(current.getFullYear(),current.getMonth()+1,0,12).getDate();
  const start=view==='week'?weekStart:monday(monthStart);
  const count=view==='week'?7:Math.ceil((((monthStart.getDay()+6)%7)+monthDays)/7)*7;
  const days=Array.from({length:count},(_,index)=>add(start,index));
  const inDay=date=>filtered.filter(task=>task.date===key(date));
  const title=view==='week'?`${label(weekStart,{day:'numeric',month:'short'})} – ${label(add(weekStart,6),{day:'numeric',month:'short',year:'numeric'})}`:label(monthStart,{month:'long',year:'numeric'});
  const move=direction=>{const next=view==='week'?add(current,direction*7):new Date(current.getFullYear(),current.getMonth()+direction,1,12);setAnchor(key(next));setSelected(key(next))};
  const jump=date=>{setAnchor(date);setSelected(date)};
  return <section className="lia-editorial-calendar" aria-labelledby="lia-editorial-calendar-title"><header><div><span className="lw-eyebrow">COSA FACCIAMO E QUANDO</span><h3 id="lia-editorial-calendar-title">Il calendario editoriale</h3></div><div className="lec-view" aria-label="Vista calendario"><button type="button" aria-pressed={view==='week'} onClick={()=>{setAnchor(selected);setView('week')}}>Settimana</button><button type="button" aria-pressed={view==='month'} onClick={()=>setView('month')}>Mese</button></div></header>
    <div className="lec-navigation"><button type="button" aria-label={view==='week'?'Settimana precedente':'Mese precedente'} onClick={()=>move(-1)}>←</button><strong aria-live="polite">{title}</strong><button type="button" aria-label={view==='week'?'Settimana successiva':'Mese successivo'} onClick={()=>move(1)}>→</button><button type="button" onClick={()=>jump(today())}>Oggi</button><button type="button" onClick={()=>jump(first)}>Torna al piano</button></div>
    <div className="lec-filters"><label>Filtra per canale<select aria-label="Filtra per canale" value={channel} onChange={event=>setChannel(event.target.value)}><option value="all">Tutti i canali</option>{Object.entries(CHANNELS).map(([value,name])=><option value={value} key={value}>{name}</option>)}</select></label><label>Filtra per stato<select aria-label="Filtra per stato" value={status} onChange={event=>setStatus(event.target.value)}><option value="all">Tutti gli stati</option>{Object.entries(STATES).map(([value,name])=><option value={value} key={value}>{name}</option>)}</select></label></div>
    <p className="lec-notice">Date e orari proposti · Europe/Rome. Il calendario organizza il lavoro; le pubblicazioni richiedono una conferma separata.</p>
    {!tasks.length?<div className="lec-empty"><p>Il calendario è pronto. LIA può proporre i primi articoli e post per la tua attività.</p><button type="button" className="lw-primary" disabled={disabled} onClick={onGenerate}>Prepara il calendario con LIA</button></div>:<>
      {view==='month'&&<div className="lec-weekdays" aria-hidden="true">{['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(day=><span key={day}>{day}</span>)}</div>}
      <div className={`lec-days is-${view}`} aria-label={view==='week'?'Attività della settimana':'Giorni del mese'}>{days.map(date=>{const day=key(date);const items=inDay(date);return <section key={day} data-calendar-day={day} className={`lec-day${date.getMonth()!==current.getMonth()?' is-outside':''}${day===today()?' is-today':''}${day===selected?' is-selected':''}`}><h4>{view==='week'?label(date,{weekday:'short',day:'numeric',month:'short'}):<button type="button" aria-label={`Mostra giorno: ${label(date,{day:'numeric',month:'long',year:'numeric'})}, ${items.length} attività`} aria-pressed={day===selected} onClick={()=>setSelected(day)}>{date.getDate()}<span>{items.length>0?`${items.length} att.`:''}</span></button>}</h4><div className="lec-day-tasks">{items.length?items.slice(0,view==='month'?3:items.length).map(task=><CalendarTask key={task.id} task={task} onOpen={onOpen}/>):view==='week'?<p>Nessuna attività</p>:null}{view==='month'&&items.length>3&&<button type="button" className="lec-more" onClick={()=>setSelected(day)}>Altre {items.length-3} attività</button>}</div></section>})}</div>
      {filtered.length>0&&!days.some(date=>inDay(date).length>0)&&<p className="lec-empty">Nessuna attività in questo periodo con i filtri selezionati.</p>}
      {filtered.length===0&&<p className="lec-empty">Nessuna attività corrisponde ai filtri selezionati.</p>}
      {view==='month'&&<section className="lec-selected-day" aria-label="Attività del giorno selezionato"><h4>{label(civil(selected),{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h4>{inDay(civil(selected)).length?inDay(civil(selected)).map(task=><CalendarTask key={task.id} task={task} onOpen={onOpen}/>):<p>Nessuna attività per questo giorno con i filtri selezionati.</p>}</section>}
    </>}
  </section>;
}
