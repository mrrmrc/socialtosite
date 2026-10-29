import React, { useRef, useState } from 'react';
import { InterfaceIcon as Icon } from './InterfaceIcon';

const icons = { account: 'user', profile: 'target', sources: 'link', seo: 'chart', services: 'wallet', security: 'shield' };
export function UserMenu({ user, items, onNavigate, onLogout }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  return <div className="user-menu" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } }}><button ref={trigger} type="button" className="user-menu-trigger" aria-label="Apri menu utente" aria-expanded={open} aria-controls="personal-menu" onClick={() => setOpen(value => !value)}><span className="user-silhouette"><Icon name="user" size={23} /></span><span className="user-trigger-name"><strong>{user.name || 'Il mio profilo'}</strong><small>{user.plan || 'Base'}</small></span><Icon name="chevron" size={16} /></button><div id="personal-menu" className="user-menu-panel" hidden={!open}><header><span className="user-silhouette"><Icon name="user" size={24} /></span><div><strong>{user.name || 'Il mio account'}</strong><span>{user.email}</span></div></header><div className="user-menu-links">{items.map(item => <button key={item.id} type="button" onClick={() => { onNavigate(item.id); setOpen(false); }}><Icon name={icons[item.id]} size={19} /><span>{item.label}</span><Icon name="arrow" size={15} /></button>)}</div><button type="button" className="user-menu-logout" onClick={onLogout}><Icon name="logout" size={18} />Esci</button></div></div>;
}
