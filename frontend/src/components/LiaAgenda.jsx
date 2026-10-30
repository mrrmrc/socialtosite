import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';
import { InterfaceIcon as Icon } from './InterfaceIcon';
import './LiaAgenda.css';

export const LIA_ROLES = [
  {id:'editorial',label:'Caporedattrice',icon:'pen',detail:'Priorità, articoli e qualità',prompt:'Agisci come la mia caporedattrice. Parti dal profilo e dai contenuti disponibili: scegli una priorità editoriale concreta, spiega perché viene prima e accompagnami fino a una bozza o revisione.'},
  {id:'social',label:'Social media manager',icon:'layers',detail:'Messaggi adatti a ogni canale',prompt:'Agisci come la mia social media manager. Proponi un messaggio coerente con la mia attività e prepara una bozza social completa, adattata a un canale. Usa ciò che sai e chiedi solo un dettaglio indispensabile se manca.'},
  {id:'seo',label:'SEO specialist',icon:'search',detail:'Titoli, pagine e ricerche',prompt:'Agisci come la mia SEO specialist. Dai dati e dai contenuti disponibili individua un intervento prioritario su titoli, intenti di ricerca o collegamenti. Proponi un miglioramento concreto, distinguendo raccomandazioni e risultati misurati.'},
  {id:'geo',label:'GEO specialist',icon:'orbit',detail:'Identità chiara e risposte utili',prompt:'Agisci come la mia GEO specialist. Aiutami a rendere identità, servizi e contenuti più chiari, coerenti e verificabili per chi cerca risposte con le AI. Parti dal mio profilo, proponi un intervento concreto e non inventare misurazioni o citazioni.'},
];
const decode=value=>{try{return typeof value==='string'?JSON.parse(value):value||{}}catch{return {}}};

export function LiaAgenda({token,site,posts=[],loading,onWork,busy}) {
  const [agenda,setAgenda]=useState({tasks:[]});
  const [goal,setGoal]=useState('');
  const [dirty,setDirty]=useState(false);
  const [operation,setOperation]=useState('');
  const [error,setError]=useState('');
  const [reading,setReading]=useState(true);
  const pending=useRef(false);
  const request=useRef(null);
  const owner=useRef(token);
  useEffect(()=>{owner.current=token;pending.current=false;setReading(true);setOperation('');setGoal('');setAgenda({tasks:[]});setError('');setDirty(false);const controller=new AbortController();apiFetch('/api/index.php?action=lia-agenda',{signal:controller.signal},token).then(data=>{if(!controller.signal.aborted&&Array.isArray(data.agenda?.tasks)){setAgenda(data.agenda);if(data.agenda.goal)setGoal(data.agenda.goal)}}).catch(error=>{if(!controller.signal.aborted)setError(error.message)}).finally(()=>{if(!controller.signal.aborted)setReading(false)});return()=>{controller.abort();request.current?.abort()}},[token]);
  useEffect(()=>{if(!dirty&&!agenda.goal){const knowledge=decode(site?.site_understanding_corrections).declared_strategy||decode(site?.site_understanding).declared_strategy||{};setGoal(String(knowledge.primary_goal||''))}},[site,dirty,agenda.goal]);
  async function run(name,body,after){
    if(pending.current||busy)return;pending.current=true;setOperation(name);setError('');const identity=token;const controller=new AbortController();request.current=controller;const timer=setTimeout(()=>controller.abort(),90000);
    try{const data=await apiFetch('/api/index.php?action=lia-agenda',{method:'POST',body:JSON.stringify(body),signal:controller.signal},token);if(owner.current!==identity||controller.signal.aborted)return;if(!Array.isArray(data.agenda?.tasks))throw new Error('Il piano non è completo. Riprova.');setAgenda(data.agenda);after?.()}
    catch(error){if(owner.current===identity)setError(error.name==='AbortError'?'La richiesta è stata interrotta. Ricarica il piano prima di riprovare.':error.message)}finally{clearTimeout(timer);if(owner.current===identity){pending.current=false;setOperation('')}}
  }
  const tasks=agenda.tasks;
  const done=tasks.filter(task=>task.status==='done').length;
  const next=tasks.find(task=>task.status!=='done');
  const drafts=posts.filter(post=>!Number(post.published)).length;
  const disabled=Boolean(operation)||busy||loading||reading;
  const work=task=>run(task.id,{operation:'update',plan_id:agenda.id,task_id:task.id,status:'in_progress'},()=>onWork(`Obiettivo della mia attività: ${goal||agenda.goal||'valorizzare i miei contenuti'}. Attività del piano: ${task.title}. ${task.brief}`,task.post_id,task.role));
  return <section className="lia-agenda" aria-labelledby="lia-agenda-title">
    <div className="lia-agenda-heading"><div><span>LA REGIA DELLA TUA ATTIVITÀ</span><h2 id="lia-agenda-title">Una sola LIA. La tua squadra.</h2><p>Coordino redazione, social, SEO e GEO attorno al tuo obiettivo. Decidiamo cosa fare e portiamo avanti un’attività alla volta.</p></div><span className="lia-agenda-counter">{tasks.length?`${done}/${tasks.length} attività completate`:`${drafts} contenuti da sviluppare`}</span></div>
    <div className="lia-role-grid">{LIA_ROLES.map(role=><button type="button" key={role.id} disabled={disabled} onClick={()=>onWork(`${role.prompt}${goal?` Il mio obiettivo: ${goal}`:''}`,null,role.id)}><span><Icon name={role.icon} size={21}/></span><strong>{role.label}</strong><small>{role.detail}</small><Icon name="arrow" size={16}/></button>)}</div>
    <form className="lia-agenda-goal" onSubmit={event=>{event.preventDefault();run('generate',{operation:'generate',goal})}}><label htmlFor="lia-agenda-goal">Il risultato su cui lavoriamo<input id="lia-agenda-goal" maxLength={400} value={goal} onChange={event=>{setGoal(event.target.value);setDirty(true)}} placeholder="Per esempio: far conoscere un servizio e ricevere richieste"/></label><button className="lw-primary" type="submit" disabled={disabled}>{operation==='generate'?'LIA organizza il piano…':tasks.length?'Riorganizza i prossimi 7 giorni':'Organizza la mia settimana'}</button></form>
    {error&&<p className="lw-error" role="alert">{error}</p>}
    {next&&<div className="lia-next-task"><span><Icon name="target" size={19}/> IL PROSSIMO PASSO</span><strong>{next.title}</strong><p>{next.reason}</p><button type="button" className="lw-primary" disabled={disabled} onClick={()=>work(next)}>Lavora con LIA su questa priorità<Icon name="arrow" size={17}/></button></div>}
    {tasks.length>0?<ol className="lia-agenda-tasks" aria-label="Piano di lavoro di LIA">{tasks.map(task=><li key={task.id} className={task.status==='done'?'is-done':''}><label className="lia-task-complete"><input type="checkbox" checked={task.status==='done'} disabled={disabled} aria-label={`Completata: ${task.title}`} onChange={event=>run(task.id,{operation:'update',plan_id:agenda.id,task_id:task.id,status:event.target.checked?'done':'todo'})}/></label><div><span>{LIA_ROLES.find(role=>role.id===task.role)?.label} · {new Date(task.date+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}{task.status==='in_progress'?' · In lavorazione':''}</span><h3>{task.title}</h3><p>{task.reason}</p></div><button type="button" className="lw-secondary" disabled={disabled||task.status==='done'} onClick={()=>work(task)}>Lavora su questo</button></li>)}</ol>:<p className="lia-agenda-empty">Il piano raccoglie attività concrete per i prossimi sette giorni, basate sul tuo profilo e sui contenuti disponibili. Gli avanzamenti restano salvati nel tuo account.</p>}
    {tasks.length>0&&done===tasks.length&&<p role="status" className="lw-success">Hai completato il piano. Possiamo scegliere insieme le prossime priorità.</p>}
  </section>;
}
