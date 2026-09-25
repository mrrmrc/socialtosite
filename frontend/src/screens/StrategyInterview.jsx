import React, { useState, useEffect, useRef } from 'react';

export default function StrategyInterview({ declaredStrategy, onUpdateStrategy, apiFetch, token }) {
    const [messages, setMessages] = useState([
        { role: 'ai', text: 'Ciao! Sono Lia, il tuo Consulente Strategico AI. 👋 Ho dato un\'occhiata ai tuoi canali social per capire meglio il tuo business. Mi aiuti a completare il tuo profilo editoriale? Iniziamo: come descriveresti la tua attività principale?' }
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        const userMsg = { role: 'user', text: inputText };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInputText('');
        setIsLoading(true);

        try {
            const res = await apiFetch('/api/index.php?action=interview-chat', {
                method: 'POST',
                body: JSON.stringify({ messages: newMessages })
            }, token);

            if (res.ok) {
                setMessages([...newMessages, { role: 'ai', text: res.reply }]);
                if (res.updates && Object.keys(res.updates).length > 0 && onUpdateStrategy) {
                    onUpdateStrategy(res.updates);
                }
            } else {
                setMessages([...newMessages, { role: 'ai', text: 'Scusa, ho avuto un momento di confusione. Puoi ripetere?' }]);
            }
        } catch (err) {
            setMessages([...newMessages, { role: 'ai', text: 'Errore di connessione. Riprova tra poco.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const strategyFields = [
        { key: 'activity_type', label: 'La Tua Attività', icon: '💼', color: '#6366f1' },
        { key: 'primary_goal', label: 'Obiettivo Master', icon: '🎯', color: '#f43f5e' },
        { key: 'primary_audience', label: 'Pubblico Ideale', icon: '👥', color: '#10b981' },
        { key: 'tone_of_voice', label: 'Tono di Voce', icon: '🎙️', color: '#f59e0b' },
        { key: 'differentiators', label: 'Fattore Unico', icon: '✨', color: '#8b5cf6' }
    ];

    const isFullyCompiled = strategyFields.every(f => declaredStrategy?.[f.key]);

    return (
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'stretch' }}>
            
            {/* Pannello Chat Elegante */}
            <div style={{ 
                flex: '1 1 500px', 
                minWidth: 0, 
                display: 'flex', 
                flexDirection: 'column', 
                height: '700px', 
                background: '#ffffff', 
                borderRadius: '32px', 
                boxShadow: '0 20px 40px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)',
                border: '1px solid rgba(0,0,0,0.04)',
                overflow: 'hidden',
                position: 'relative'
            }}>
                {/* Chat Header Glassmorphism */}
                <div style={{ 
                    padding: '24px 32px', 
                    background: 'rgba(255, 255, 255, 0.85)', 
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    zIndex: 10
                }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.25)' }}>
                        ✨
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#111827' }}>Lia</h2>
                        <div style={{ fontSize: '13px', color: '#6366f1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)' }}></span>
                            Intelligenza Strategica
                        </div>
                    </div>
                </div>
                
                {/* Chat Messages Area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '120px 32px 32px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)' }}>
                    {messages.map((m, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: m.role === 'ai' ? 'flex-start' : 'flex-end', animation: 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                            <div style={{ 
                                maxWidth: '80%', 
                                padding: '16px 20px', 
                                borderRadius: '24px',
                                borderBottomLeftRadius: m.role === 'ai' ? '4px' : '24px',
                                borderBottomRightRadius: m.role === 'user' ? '4px' : '24px',
                                background: m.role === 'ai' ? '#f1f5f9' : 'linear-gradient(135deg, #2563eb, #4f46e5)',
                                color: m.role === 'ai' ? '#1e293b' : '#ffffff',
                                boxShadow: m.role === 'user' ? '0 8px 24px rgba(79, 70, 229, 0.25)' : 'none',
                                fontSize: '16px',
                                lineHeight: '1.6',
                                fontWeight: m.role === 'user' ? 500 : 400
                            }}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start', animation: 'fadeIn 0.3s ease' }}>
                            <div style={{ padding: '16px 24px', borderRadius: '24px', borderBottomLeftRadius: '4px', background: '#f1f5f9', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span className="typing-dot" style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }}></span>
                                <span className="typing-dot" style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.2s' }}></span>
                                <span className="typing-dot" style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.4s' }}></span>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div style={{ padding: '24px 32px', background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.03)' }}>
                    <form onSubmit={handleSend} style={{ display: 'flex', gap: '12px', background: '#f8fafc', padding: '8px', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.06)', transition: 'all 0.3s ease', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                        <input 
                            type="text" 
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            placeholder="Scrivi il tuo pensiero in modo naturale..."
                            style={{ flex: 1, padding: '12px 20px', border: 'none', background: 'transparent', fontSize: '16px', outline: 'none', color: '#0f172a' }}
                            disabled={isLoading || isFullyCompiled}
                        />
                        <button 
                            type="submit" 
                            disabled={isLoading || !inputText.trim() || isFullyCompiled} 
                            style={{ 
                                background: (isLoading || !inputText.trim() || isFullyCompiled) ? '#cbd5e1' : '#1e293b', 
                                color: '#ffffff', 
                                border: 'none', 
                                borderRadius: '18px', 
                                padding: '0 28px', 
                                fontWeight: 700, 
                                cursor: (isLoading || !inputText.trim() || isFullyCompiled) ? 'default' : 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                        >
                            Invia
                        </button>
                    </form>
                    {isFullyCompiled && (
                        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#10b981', fontWeight: 600 }}>
                            ✨ Profilo completato con successo. La tua strategia è pronta.
                        </div>
                    )}
                </div>
                
                <style>{`
                    @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
                `}</style>
            </div>

            {/* Pannello Dati Strategici */}
            <div style={{ 
                flex: '1 1 340px', 
                minWidth: 0, 
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
            }}>
                <div style={{ padding: '32px', background: 'linear-gradient(145deg, #1e293b, #0f172a)', borderRadius: '32px', color: 'white', boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)' }}>
                    <div style={{ display: 'inline-block', padding: '6px 14px', background: 'rgba(255,255,255,0.1)', borderRadius: '100px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '20px', backdropFilter: 'blur(10px)' }}>
                        Live Sync
                    </div>
                    <h3 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '12px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                        La tua <span style={{ color: '#818cf8' }}>Strategia Editoriale</span> prende forma
                    </h3>
                    <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                        Mentre parli con Lia, i concetti chiave vengono estratti e salvati qui sotto in tempo reale.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    {strategyFields.map(f => {
                        const val = declaredStrategy?.[f.key];
                        return (
                            <div key={f.key} style={{ 
                                padding: '24px', 
                                background: val ? '#ffffff' : 'rgba(255,255,255,0.4)', 
                                borderRadius: '24px', 
                                border: val ? '1px solid rgba(0,0,0,0.04)' : '1px dashed rgba(0,0,0,0.1)',
                                boxShadow: val ? '0 10px 25px rgba(0,0,0,0.03)' : 'none',
                                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                {val && <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: f.color }}></div>}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: val ? \`\${f.color}15\` : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                        {f.icon}
                                    </div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: val ? '#1e293b' : '#94a3b8' }}>
                                        {f.label}
                                    </div>
                                </div>
                                <div style={{ 
                                    fontSize: '16px', 
                                    color: val ? '#334155' : '#cbd5e1', 
                                    fontWeight: val ? 500 : 400,
                                    lineHeight: 1.5
                                }}>
                                    {val || 'In attesa di dettagli...'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
}
