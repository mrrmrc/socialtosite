const OPEN_SOURCE_PROVENANCE = {
  type: 'curated-original',
  inspiration: 'Open-source design tokens and established web design patterns',
  license: 'All Social To Web original implementation',
};

const PALETTES = [
  { id:'ivory', name:'Avorio', colors:['#f5f1ea','#201a17','#a06a42'], background:'#f5f1ea', surface:'#fffdf9', text:'#201a17', text_muted:'#6e6258', primary:'#9a5f36', secondary:'#efe1d2', gradient:'linear-gradient(135deg,#c79063,#83502f)' },
  { id:'midnight', name:'Mezzanotte', colors:['#0b1020','#f6f7fb','#7c8cff'], background:'#0b1020', surface:'#151c31', text:'#f6f7fb', text_muted:'#b8c0d9', primary:'#8c9aff', secondary:'#252f52', gradient:'linear-gradient(135deg,#9aa6ff,#5865d8)', dark:true },
  { id:'sage', name:'Salvia', colors:['#f3f5ef','#1f3327','#3d7d5a'], background:'#f3f5ef', surface:'#ffffff', text:'#1f3327', text_muted:'#617066', primary:'#347454', secondary:'#dbe9df', gradient:'linear-gradient(135deg,#65a77f,#2d674a)' },
  { id:'ocean', name:'Oceano', colors:['#edf6f8','#102c36','#087e8b'], background:'#edf6f8', surface:'#ffffff', text:'#102c36', text_muted:'#58727b', primary:'#087e8b', secondary:'#ccecef', gradient:'linear-gradient(135deg,#20a4b2,#086574)' },
  { id:'terracotta', name:'Terracotta', colors:['#fbf2ea','#3e241e','#bd5d3d'], background:'#fbf2ea', surface:'#fffaf6', text:'#3e241e', text_muted:'#795f56', primary:'#ad4f32', secondary:'#f1d5c5', gradient:'linear-gradient(135deg,#d97a55,#963e28)' },
  { id:'plum', name:'Prugna', colors:['#f8f2f7','#321c30','#8c3f78'], background:'#f8f2f7', surface:'#fffaff', text:'#321c30', text_muted:'#765e72', primary:'#853b72', secondary:'#eed9e9', gradient:'linear-gradient(135deg,#b3609e,#6a2c5b)' },
  { id:'sand', name:'Sabbia', colors:['#f7f2e7','#322b22','#a67c3f'], background:'#f7f2e7', surface:'#fffdf7', text:'#322b22', text_muted:'#746a5b', primary:'#936a31', secondary:'#eadfc8', gradient:'linear-gradient(135deg,#c59b5b,#7e5929)' },
  { id:'graphite', name:'Grafite', colors:['#f3f4f6','#17191d','#343a46'], background:'#f3f4f6', surface:'#ffffff', text:'#17191d', text_muted:'#656b76', primary:'#343a46', secondary:'#e2e5ea', gradient:'linear-gradient(135deg,#596171,#252a33)' },
  { id:'burgundy', name:'Borgogna', colors:['#f8f1f1','#32181c','#8f2438'], background:'#f8f1f1', surface:'#fffafa', text:'#32181c', text_muted:'#765b60', primary:'#862035', secondary:'#efd5da', gradient:'linear-gradient(135deg,#b84358,#6e1729)' },
  { id:'cobalt', name:'Cobalto', colors:['#f1f5ff','#14213d','#2457d6'], background:'#f1f5ff', surface:'#ffffff', text:'#14213d', text_muted:'#5c6983', primary:'#2457d6', secondary:'#d9e4ff', gradient:'linear-gradient(135deg,#4c7af0,#173fa7)' },
];

const FAMILIES = [
  { id:'editorial-luxe', name:'Editoriale Luxe', category:'Blog e magazine', emoji:'📰', desc:'Titoli importanti, ritmo editoriale e contenuti in primo piano.', font_heading:'Cormorant Garamond', font_body:'Source Sans 3', recipe:{hero:'editorial',nav:'centered',cards:'editorial',density:'airy'}, model:'editorial-luxe', radius:'18px', shadow:'0 12px 40px rgba(0,0,0,.08)', basePalette:'ivory' },
  { id:'neo-brutal-pop', name:'Neo Brutal', category:'Creator', emoji:'⚡', desc:'Gerarchie forti, bordi netti e una presenza contemporanea.', font_heading:'Space Grotesk', font_body:'Inter', recipe:{hero:'split',nav:'solid',cards:'bold',density:'balanced'}, model:'neo-brutal-pop', radius:'8px', shadow:'8px 8px 0 rgba(0,0,0,.14)', basePalette:'terracotta' },
  { id:'dark-cinematic', name:'Cinematografico', category:'Foto e portfolio', emoji:'🎬', desc:'Immagini protagoniste, atmosfera profonda e ritmo visivo.', font_heading:'Sora', font_body:'DM Sans', recipe:{hero:'immersive',nav:'minimal',cards:'cinematic',density:'airy'}, model:'dark-cinematic', radius:'20px', shadow:'0 20px 60px rgba(0,0,0,.28)', basePalette:'midnight', glass:true },
  { id:'warm-humanist', name:'Umano e caldo', category:'Personal brand', emoji:'🌿', desc:'Accogliente, rassicurante e ideale per raccontare persone e valori.', font_heading:'Fraunces', font_body:'Source Sans 3', recipe:{hero:'human',nav:'floating',cards:'soft',density:'airy'}, model:'warm-humanist', radius:'24px', shadow:'0 12px 36px rgba(36,48,40,.08)', basePalette:'sage' },
  { id:'tech-clarity', name:'Business moderno', category:'Aziende', emoji:'◈', desc:'Pulito, preciso e orientato a servizi, risultati e conversione.', font_heading:'Plus Jakarta Sans', font_body:'Inter', recipe:{hero:'product',nav:'solid',cards:'product',density:'balanced'}, model:'tech-clarity', radius:'16px', shadow:'0 10px 30px rgba(15,23,42,.08)', basePalette:'cobalt' },
  { id:'legal-authority', name:'Autorità professionale', category:'Professionisti', emoji:'⚖️', desc:'Sobrio e autorevole per studi legali, consulenti e professionisti.', font_heading:'Cormorant Garamond', font_body:'Inter', recipe:{hero:'split',nav:'centered',cards:'editorial',density:'balanced'}, model:'editorial-luxe', radius:'4px', shadow:'0 12px 34px rgba(22,28,38,.07)', basePalette:'burgundy' },
  { id:'hospitality-story', name:'Ospitalità', category:'Hotel e ristorazione', emoji:'🌾', desc:'Caldo e fotografico per agriturismi, ristoranti e destinazioni.', font_heading:'Fraunces', font_body:'DM Sans', recipe:{hero:'immersive',nav:'floating',cards:'soft',density:'airy'}, model:'warm-humanist', radius:'28px', shadow:'0 18px 46px rgba(50,38,24,.12)', basePalette:'sand' },
  { id:'minimal-journal', name:'Journal minimale', category:'Blog e magazine', emoji:'✒️', desc:'Tipografia, spazio bianco e lettura senza distrazioni.', font_heading:'Cormorant Garamond', font_body:'Source Sans 3', recipe:{hero:'editorial',nav:'minimal',cards:'editorial',density:'airy'}, model:'editorial-luxe', radius:'2px', shadow:'none', basePalette:'graphite' },
  { id:'portfolio-grid', name:'Portfolio Grid', category:'Foto e portfolio', emoji:'▦', desc:'Griglia visuale decisa per lavori, progetti, arte e fotografia.', font_heading:'Space Grotesk', font_body:'Inter', recipe:{hero:'split',nav:'floating',cards:'cinematic',density:'compact'}, model:'dark-cinematic', radius:'12px', shadow:'0 16px 44px rgba(0,0,0,.14)', basePalette:'plum' },
  { id:'boutique-signature', name:'Boutique Signature', category:'Negozi e attività', emoji:'✦', desc:'Raffinato e distintivo per atelier, prodotti e attività locali.', font_heading:'Fraunces', font_body:'DM Sans', recipe:{hero:'human',nav:'centered',cards:'product',density:'balanced'}, model:'warm-humanist', radius:'22px', shadow:'0 14px 38px rgba(45,30,25,.1)', basePalette:'ocean' },
];

function orderedPalettes(basePalette) {
  return [...PALETTES.filter(p => p.id === basePalette), ...PALETTES.filter(p => p.id !== basePalette)];
}

export const SITE_LAYOUTS = FAMILIES.flatMap(family => orderedPalettes(family.basePalette).map((palette, index) => ({
  id: index === 0 ? family.id : `${family.id}-${palette.id}`,
  family: family.id,
  category: family.category,
  name: index === 0 ? family.name : `${family.name} · ${palette.name}`,
  desc: family.desc,
  emoji: family.emoji,
  colors: palette.colors,
  font_heading: family.font_heading,
  font_body: family.font_body,
  color_palette: {
    background: palette.background,
    surface: palette.surface,
    text: palette.text,
    text_muted: palette.text_muted,
    primary: palette.primary,
    secondary: palette.secondary,
    primary_gradient: palette.gradient,
  },
  ui_style: {
    radius: family.radius,
    card_shadow: family.shadow,
    glassmorphism: family.glass || false,
  },
  layout_recipe: family.recipe,
  base_models: [family.model],
  provenance: OPEN_SOURCE_PROVENANCE,
})));

export const SITE_LAYOUT_CATEGORIES = ['Tutti', ...new Set(FAMILIES.map(family => family.category))];
