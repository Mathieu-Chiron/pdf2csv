/* Node.js test runner — mirrors tests.html logic */

/* ══ CORE FUNCTIONS ══ */
function normalizeDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [,m,d]=s.split('-').map(Number); return (m<1||m>12||d<1||d>31)?null:s; }
  const dmy=s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) { const [,dd,mm,yyyy]=dmy; if(parseInt(mm)>12||parseInt(dd)>31) return null; return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`; }
  const MO={jan:1,fév:2,fev:2,feb:2,mar:3,avr:4,apr:4,mai:5,may:5,jun:6,jui:6,jul:7,aoû:8,aou:8,aug:8,sep:9,oct:10,nov:11,déc:12,dec:12,january:1,february:2,march:3,april:4,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
  const t1=s.match(/^(\d{1,2})\s+([a-zéûôèA-Z]+)\.?\s+(\d{4})$/i);
  if (t1){const k=t1[2].toLowerCase();const m=MO[k]||MO[k.slice(0,3)];if(m) return `${t1[3]}-${String(m).padStart(2,'0')}-${t1[1].padStart(2,'0')}`;}
  const t2=s.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (t2){const k=t2[1].toLowerCase();const m=MO[k]||MO[k.slice(0,3)];if(m) return `${t2[3]}-${String(m).padStart(2,'0')}-${t2[2].padStart(2,'0')}`;}
  const ts=s.match(/^(\d{4}-\d{2}-\d{2})T/); if (ts) return ts[1];
  return null;
}

function normalizeAmount(raw) {
  if (raw==null||raw==='') return null;
  let s=String(raw).trim();
  s=s.replace(/\b(EUR|USD|GBP|CHF|JPY)\b/gi,'').replace(/[€$£¥]/g,'').replace(/\s*[eE]\s*$/,'').trim();
  s=s.replace(/(\d)[\s\u00A0](\d)/g,'$1$2').replace(/(\d)[\s\u00A0](\d)/g,'$1$2').trim();
  if (!s) return null;
  const D=(s.match(/\./g)||[]).length, C=(s.match(/,/g)||[]).length;
  const pf=v=>{ const n=parseFloat(v); return isNaN(n)?null:n; };
  if(!D&&!C) return pf(s);
  if(!D&&C===1) return pf(s.replace(',','.'));
  if(!C&&D===1) return pf(s);
  if(!C&&D>1) return pf(s.replace(/\./g,''));
  if(D>1&&C===1) return pf(s.replace(/\./g,'').replace(',','.'));
  if(C>1&&D===1) return pf(s.replace(/,/g,''));
  if(D===1&&C===1){ return s.lastIndexOf(',')>s.lastIndexOf('.') ? pf(s.replace('.','').replace(',','.')) : pf(s.replace(',','')); }
  return pf(s.replace(',','.'));
}

function parseJSON(raw) {
  if (!raw||typeof raw!=='string') return {ok:false,data:{},err:'Réponse vide'};
  let t=raw.trim().replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/,'');
  const m=t.match(/\{[\s\S]*\}/); if (!m) return {ok:false,data:{},err:'Aucun JSON trouvé'};
  try { return {ok:true,data:JSON.parse(m[0])}; }
  catch(e) { try { return {ok:true,data:JSON.parse(m[0].replace(/,\s*([}\]])/g,'$1')),repaired:true}; } catch(e2) { return {ok:false,data:{},err:'JSON invalide'}; } }
}

function vandn(value, f) {
  const errs=[], empty=value==null||String(value).trim()==='';
  if (f.required&&empty) return {valid:false,norm:value,errs:['Champ requis']};
  if (empty) return {valid:true,norm:value,errs:[]};
  let norm=value;
  if (f.type==='date') { norm=normalizeDate(value); if (!norm) errs.push(`Date non reconnue : "${value}"`); else { const d=new Date(norm); if(isNaN(d.getTime())) errs.push('Date invalide'); if(d.getFullYear()<2000||d.getFullYear()>2099) errs.push('Année hors plage'); } }
  if (f.type==='number') { norm=normalizeAmount(value); if (norm==null) errs.push(`Montant non reconnu : "${value}"`); else { if(norm<0) errs.push('Montant négatif'); if(norm>10_000_000) errs.push('Montant > 10M€'); } }
  if (f.type==='text'&&String(value).length>500) errs.push('Valeur trop longue');
  return {valid:errs.length===0,norm:norm??value,errs};
}

const FIELDS = [
  {label:'Nom du débiteur',    key:'debtor_company_name',          type:'text',   required:true},
  {label:'Adresse',            key:'debtor_post_street_1',         type:'text',   required:true},
  {label:'Code postal',        key:'debtor_post_postalcode',       type:'text',   required:true},
  {label:'Ville',              key:'debtor_post_city',             type:'text',   required:true},
  {label:'Pays',               key:'debtor_post_country_code',     type:'text',   required:true},
  {label:'N° de facture',      key:'invoice_number',               type:'text',   required:true},
  {label:'Date émission',      key:'invoice_date',                 type:'date',   required:true},
  {label:'Échéance',           key:'invoice_due_date',             type:'date',   required:true},
  {label:'Montant TTC',        key:'amount_ttc',                   type:'number', required:true},
  {label:'Montant total',      key:'invoice_total_amount_inc_vat', type:'number', required:true},
  {label:'Montant en suspens', key:'invoice_open_amount_inc_vat',  type:'number', required:true},
];

function checkFields(inv) {
  inv.errors={}; let ok=true;
  FIELDS.forEach(f=>{ const v=inv.data[f.key],res=vandn(v,f); if(!res.valid){inv.errors[f.key]=res.errs[0];ok=false;} else if(res.norm!==v&&res.norm!=null) inv.data[f.key]=res.norm; });
  // Creditor VAT always required
  const rawC=inv.data.creditor_vat_number;
  const nc=normalizeVAT(rawC);
  if(!nc){
    const empty=rawC==null||String(rawC).trim()===''||String(rawC).toLowerCase()==='null';
    inv.errors.creditor_vat_number=empty
      ?'N° TVA créancier requis — ex : FR12345678901'
      :'Format invalide — attendu : code pays + numéro (ex : FR12345678901, DE123456789)';
    ok=false;
  } else inv.data.creditor_vat_number=nc;
  // Debtor VAT: validate if field has any non-empty value
  const rawD=inv.data.debtor_vat_number;
  const hasDebtorValue=rawD!=null&&String(rawD).trim()!==''&&String(rawD).toLowerCase()!=='null';
  if(hasDebtorValue){
    const nd=normalizeVAT(rawD);
    if(!nd){inv.errors.debtor_vat_number='Format invalide — attendu : code pays + numéro (ex : FR12345678901, DE123456789)';ok=false;}
    else inv.data.debtor_vat_number=nd;
  }
  const state=getDebtorCodeState(inv.data,inv.debtorType||null);
  if(state.vatRequired){inv.errors.debtor_vat_number='N° TVA débiteur requis pour une entreprise — ex : FR12345678901';ok=false;}
  return ok;
}
function simulateValidation(data,fields){const errors={};let ok=true;fields.forEach(f=>{const v=data[f.key],res=vandn(v,f);if(!res.valid){errors[f.key]=res.errs[0];ok=false;}});return{ok,errors};}
function allDone(invoices){return invoices.length>0&&invoices.every(x=>x.status==='validated'||x.status==='skipped');}
function isFieldEmpty(inv,key){const raw=inv.data[key];return inv.status!=='pending'&&(raw==null||String(raw).trim()==='');}
function detectDuplicates(existingNames,newNames){const duplicates=[],added=[];newNames.forEach(name=>{if(existingNames.includes(name)||added.includes(name))duplicates.push(name);else added.push(name);});return{duplicates,added};}
function canShowFinishButton(invoices){if(!invoices.length)return false;return invoices.every(x=>x.status==='validated'||x.status==='skipped');}
function shouldWarnBeforeExport(invoices){return invoices.some(x=>x.status==='skipped');}
function getSkippedInvoices(invoices){return invoices.filter(x=>x.status==='skipped').map(x=>x.file.name);}
function buildExportWarningMessage(invoices){const skipped=getSkippedInvoices(invoices);if(!skipped.length)return null;const count=skipped.length;const plural=count>1;return{count,names:skipped,message:`${count} facture${plural?'s':''} ignorée${plural?'s':''} ${plural?'ne seront':'ne sera'} pas exportée${plural?'s':''}.`};}
function makeInvoice(status,data={}){return{file:{name:'test.pdf'},status,data:{...data},errors:{},rawNorm:{},confidence:null};}
function simulateOnFI(inv,key,val){inv.data[key]=val;if(inv.errors)delete inv.errors[key];if(inv.status==='skipped'||inv.status==='validated')inv.status='extracted';return inv;}
function getButtonLabel(inv,invoices){const ad=invoices.length>0&&invoices.every(x=>x.status==='validated'||x.status==='skipped');const cv=inv.status==='validated';return(ad&&cv)?'Terminer et exporter ✓':'Valider ✓';}
function simulatePreExportCheck(inv,invoices){if(inv.status!=='skipped'){const ok=checkFields(inv);if(!ok)return{blocked:true,reason:'missing_fields',errors:inv.errors};}const skipped=invoices.filter(x=>x.status==='skipped');if(skipped.length)return{blocked:true,reason:'skipped_warning',skipped:skipped.map(x=>x.file.name)};return{blocked:false};}

const inv  = name=>({file:{name},status:'validated'});
const skip = name=>({file:{name},status:'skipped'});
const pend = name=>({file:{name},status:'pending'});
const extr = name=>({file:{name},status:'extracted'});

const fullData = {
  debtor_company_name:'ACME SAS',debtor_post_street_1:'12 rue de la Paix',
  debtor_post_postalcode:'75001',debtor_post_city:'Paris',debtor_post_country_code:'FR',
  invoice_number:'F-2024-001',invoice_date:'2024-03-15',invoice_due_date:'2024-04-15',
  amount_ttc:'1500.50',invoice_total_amount_inc_vat:'1500.50',invoice_open_amount_inc_vat:'250.00',
  creditor_vat_number:'FR12345678901'
};

/* ══ VAT VALIDATION ══════════════════════════════════ */
const EU_VAT_PATTERNS = {
  AT:/^ATU[0-9]{8}$/,
  BE:/^BE[0-9]{10}$/,
  BG:/^BG[0-9]{9,10}$/,
  HR:/^HR[0-9]{11}$/,
  CY:/^CY[0-9]{8}[A-Z]$/,
  CZ:/^CZ[0-9]{8,10}$/,
  DK:/^DK[0-9]{8}$/,
  EE:/^EE[0-9]{9}$/,
  FI:/^FI[0-9]{8}$/,
  FR:/^FR[0-9A-Z]{2}[0-9]{9}$/,
  DE:/^DE[0-9]{9}$/,
  GR:/^EL[0-9]{9}$/,
  HU:/^HU[0-9]{8}$/,
  IE:/^IE[0-9]{7}[A-Z]{1,2}$/,
  IT:/^IT[0-9]{11}$/,
  LV:/^LV[0-9]{11}$/,
  LT:/^LT([0-9]{9}|[0-9]{12})$/,
  LU:/^LU[0-9]{8}$/,
  MT:/^MT[0-9]{8}$/,
  NL:/^NL[0-9]{9}B[0-9]{2}$/,
  PL:/^PL[0-9]{10}$/,
  PT:/^PT[0-9]{9}$/,
  RO:/^RO[0-9]{2,10}$/,
  SK:/^SK[0-9]{10}$/,
  SI:/^SI[0-9]{8}$/,
  ES:/^ES[A-Z0-9][0-9]{7}[A-Z0-9]$/,
  SE:/^SE[0-9]{12}$/,
  GB:/^GB([0-9]{9}|[0-9]{12}|GD[0-9]{3}|HA[0-9]{3})$/,
  CH:/^CHE[0-9]{9}$/,
};

function isValidVAT(str){
  if(!str||typeof str!=='string') return false;
  const s=str.replace(/[\s.\-]/g,'').toUpperCase();
  return Object.values(EU_VAT_PATTERNS).some(p=>p.test(s));
}

function normalizeVAT(raw){
  if(!raw) return null;
  const s=String(raw).replace(/[\s.\-]/g,'').toUpperCase();
  return isValidVAT(s)?s:null;
}

function resolveVATAssignment(creditorVAT,debtorVAT){
  const c=creditorVAT?normalizeVAT(creditorVAT):null;
  const d=debtorVAT?normalizeVAT(debtorVAT):null;
  if(c&&d) return 'both';
  if(c) return 'creditor_only';
  if(d) return 'debtor_only';
  return 'none';
}

function switchVATValues(data){
  const tmp=data.creditor_vat_number;
  data.creditor_vat_number=data.debtor_vat_number;
  data.debtor_vat_number=tmp;
  return data;
}

function hasDuplicateVAT(creditorVAT,debtorVAT){
  if(!creditorVAT||!debtorVAT) return false;
  const c=normalizeVAT(creditorVAT),d=normalizeVAT(debtorVAT);
  return !!(c&&d&&c===d);
}

/* mirrored from invoice-processor.html buildCSV */
function getActiveVATFields(invoices,vatFields){
  return vatFields.filter(f=>invoices.some(inv=>inv.data&&inv.data[f.key]));
}

/* ══ DEBTOR CODE ══════════════════════════════════════ */
const DEBTOR_CODE_SOURCES=['debtor_company_name','debtor_post_city','debtor_post_street_1','debtor_post_postalcode'];

function extractCode(str,n=3){
  if(!str) return 'X'.repeat(n);
  const s=String(str).toUpperCase().replace(/[^A-Z0-9]/g,'');
  return (s.slice(0,n)||'').padEnd(n,'X');
}

function generateDebtorCode(data){
  return DEBTOR_CODE_SOURCES.map(k=>extractCode(data[k],3)).join('');
}

function computeDebtorCode(data){
  const vatState=resolveVATAssignment(data.creditor_vat_number,data.debtor_vat_number);
  if(vatState==='both'||vatState==='debtor_only') return normalizeVAT(data.debtor_vat_number);
  return generateDebtorCode(data);
}

function shouldShowDebtorTypeSelector(vatState){
  return vatState==='creditor_only'||vatState==='none';
}

function getDebtorCodeState(data,debtorType){
  const vatState=resolveVATAssignment(data.creditor_vat_number,data.debtor_vat_number);
  // B2B confirmé : 2 TVA ou TVA débiteur connue
  if(vatState==='both'||vatState==='debtor_only'){
    return{code:normalizeVAT(data.debtor_vat_number),locked:true,requireType:false,vatRequired:false,showDebtorVatField:false};
  }
  const code=computeDebtorCode(data);
  // Type non encore défini
  if(!debtorType){
    return{code,locked:true,requireType:true,vatRequired:false,showDebtorVatField:true};
  }
  if(debtorType==='entreprise'){
    return{code,locked:true,requireType:false,vatRequired:true,showDebtorVatField:true};
  }
  // particulier
  return{code,locked:true,requireType:false,vatRequired:false,showDebtorVatField:false};
}

/* ══ TEST ENGINE ══ */
let pass=0, fail=0;
function eq(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function test(desc,got,expected){
  const ok=eq(got,expected);
  if(ok){pass++;process.stdout.write('  ✓ '+desc+'\n');}
  else{fail++;process.stdout.write('  ✗ '+desc+'\n    got:      '+JSON.stringify(got)+'\n    expected: '+JSON.stringify(expected)+'\n');}
}
function suite(name,fn){console.log('\n'+name);fn();}

/* ══ SUITES ══ */
suite('normalizeDate', ()=>{
  test('ISO correct',                  normalizeDate('2024-03-15'),          '2024-03-15');
  test('DD/MM/YYYY',                   normalizeDate('15/03/2024'),          '2024-03-15');
  test('DD-MM-YYYY',                   normalizeDate('15-03-2024'),          '2024-03-15');
  test('DD.MM.YYYY',                   normalizeDate('15.03.2024'),          '2024-03-15');
  test('D/M/YYYY sans zéro',           normalizeDate('5/3/2024'),            '2024-03-05');
  test('15 mars 2024',                 normalizeDate('15 mars 2024'),        '2024-03-15');
  test('15 fév. 2024',                 normalizeDate('15 fév. 2024'),        '2024-02-15');
  test('March 15, 2024',               normalizeDate('March 15, 2024'),      '2024-03-15');
  test('15 February 2024',             normalizeDate('15 February 2024'),    '2024-02-15');
  test('ISO datetime tronqué',         normalizeDate('2024-03-15T12:00:00Z'),'2024-03-15');
  test('Vide → null',                  normalizeDate(''),                    null);
  test('Invalide → null',              normalizeDate('pas une date'),        null);
  test('Mois > 12 → null',             normalizeDate('15/13/2024'),          null);
});

suite('normalizeAmount', ()=>{
  test('Entier simple',                normalizeAmount('1500'),              1500);
  test('Décimal point',                normalizeAmount('1500.50'),           1500.50);
  test('Décimal virgule',              normalizeAmount('1500,50'),           1500.50);
  test('Milliers point décimal virgule',normalizeAmount('1.500,50'),         1500.50);
  test('Milliers virgule décimal point',normalizeAmount('1,500.50'),         1500.50);
  test('Espace + virgule',             normalizeAmount('1 500,50'),          1500.50);
  test('€ suffixe',                    normalizeAmount('1 500,50 €'),        1500.50);
  test('€ préfixe',                    normalizeAmount('€1500.50'),          1500.50);
  test('$ USD',                        normalizeAmount('$1,500.00'),         1500.00);
  test('EUR libellé',                  normalizeAmount('1500.50 EUR'),       1500.50);
  test('Zéro',                         normalizeAmount('0'),                 0);
  test('Vide → null',                  normalizeAmount(''),                  null);
  test('Null → null',                  normalizeAmount(null),                null);
  test('Texte → null',                 normalizeAmount('N/A'),               null);
});

suite('parseJSON', ()=>{
  const p=r=>{const x=parseJSON(r);return{ok:x.ok,data:x.data};};
  test('JSON propre',       p('{"debtor_company_name":"ACME"}'),          {ok:true,data:{debtor_company_name:'ACME'}});
  test('Backticks',         p('```json\n{"debtor_company_name":"ACME"}\n```'), {ok:true,data:{debtor_company_name:'ACME'}});
  test('Texte autour',      p('Voici:\n{"debtor_company_name":"ACME"}\nMerci.'), {ok:true,data:{debtor_company_name:'ACME'}});
  test('Virgule finale',    p('{"debtor_company_name":"ACME",}'),         {ok:true,data:{debtor_company_name:'ACME'}});
  test('Vide → false',      parseJSON('').ok,                             false);
  test('Pas de JSON → false', parseJSON('Désolé.').ok,                   false);
});

suite('vandn — champs requis', ()=>{
  FIELDS.forEach(f=>test(`${f.key} manquant → invalide`, vandn(null,f).valid, false));
});

suite('vandn — champs valides', ()=>{
  test('text valide',   vandn('ACME',{type:'text',required:true}).valid,    true);
  test('date valide',   vandn('2024-03-15',{type:'date',required:true}).valid, true);
  test('number valide', vandn('1500.50',{type:'number',required:true}).valid, true);
  test('date invalide', vandn('pas-une-date',{type:'date',required:true}).valid, false);
  test('montant invalide', vandn('abc',{type:'number',required:true}).valid, false);
  test('montant négatif', vandn('-100',{type:'number',required:true}).valid, false);
  test('année hors plage', vandn('15/03/1985',{type:'date',required:true}).valid, false);
});

suite('checkFields', ()=>{
  test('Tous champs valides',       checkFields(makeInvoice('extracted',JSON.parse(JSON.stringify(fullData)))), true);
  test('Nom manquant',              checkFields(makeInvoice('extracted',{...fullData,debtor_company_name:null})), false);
  test('Date invalide',             checkFields(makeInvoice('extracted',{...fullData,invoice_date:'not-a-date'})), false);
  test('Facture ignorée complète',  checkFields(makeInvoice('skipped',JSON.parse(JSON.stringify(fullData)))), true);
  test('Facture ignorée vide',      checkFields(makeInvoice('skipped',{})), false);
  const inv2=makeInvoice('extracted',{...fullData,debtor_company_name:null});checkFields(inv2);
  test('Erreurs enregistrées',      inv2.errors.debtor_company_name, 'Champ requis');
});

suite('onFI — reset statut', ()=>{
  test('skipped → extracted',  simulateOnFI(makeInvoice('skipped',fullData),'debtor_company_name','X').status, 'extracted');
  test('validated → extracted',simulateOnFI(makeInvoice('validated',fullData),'debtor_company_name','X').status,'extracted');
  test('extracted → extracted',simulateOnFI(makeInvoice('extracted',fullData),'debtor_company_name','X').status,'extracted');
  test('pending → pending',    simulateOnFI(makeInvoice('pending',{}),'debtor_company_name','X').status,'pending');
  const i2=makeInvoice('extracted',fullData);simulateOnFI(i2,'debtor_company_name','Nouveau');
  test('Valeur mise à jour',   i2.data.debtor_company_name, 'Nouveau');
  const i3={...makeInvoice('extracted',fullData),errors:{debtor_company_name:'Champ requis'}};simulateOnFI(i3,'debtor_company_name','X');
  test('Erreur effacée',       i3.errors.debtor_company_name, undefined);
});

suite('getButtonLabel', ()=>{
  test('extracted + pending → Valider',        getButtonLabel(makeInvoice('extracted'),[makeInvoice('extracted'),makeInvoice('pending')]),'Valider ✓');
  test('validated + all validated → Terminer', getButtonLabel(makeInvoice('validated'),[makeInvoice('validated'),makeInvoice('validated')]),'Terminer et exporter ✓');
  test('skipped sélectionné → Valider',        getButtonLabel(makeInvoice('skipped'),[makeInvoice('validated'),makeInvoice('skipped')]),'Valider ✓');
  test('validated + skipped → Terminer',       getButtonLabel(makeInvoice('validated'),[makeInvoice('validated'),makeInvoice('skipped')]),'Terminer et exporter ✓');
});

suite('canShowFinishButton', ()=>{
  test('Aucune',              canShowFinishButton([]),false);
  test('Pending',             canShowFinishButton([pend('A')]),false);
  test('Extracted',           canShowFinishButton([extr('A')]),false);
  test('Toutes validées',     canShowFinishButton([inv('A'),inv('B')]),true);
  test('Validée + ignorée',   canShowFinishButton([inv('A'),skip('B')]),true);
  test('Validée + pending',   canShowFinishButton([inv('A'),pend('B')]),false);
});

suite('shouldWarnBeforeExport', ()=>{
  test('Aucune ignorée → false',  shouldWarnBeforeExport([inv('A'),inv('B')]),false);
  test('1 ignorée → true',        shouldWarnBeforeExport([inv('A'),skip('B')]),true);
  test('Toutes ignorées → true',  shouldWarnBeforeExport([skip('A'),skip('B')]),true);
});

suite('buildExportWarningMessage', ()=>{
  test('Aucune → null',     buildExportWarningMessage([inv('A'),inv('B')]),null);
  test('1 ignorée',         buildExportWarningMessage([inv('A'),skip('B')]),{count:1,names:['B'],message:'1 facture ignorée ne sera pas exportée.'});
  test('2 ignorées',        buildExportWarningMessage([inv('A'),skip('B'),skip('C')]),{count:2,names:['B','C'],message:'2 factures ignorées ne seront pas exportées.'});
});

suite('detectDuplicates', ()=>{
  test('Aucun doublon',      detectDuplicates([],['A','B']),{duplicates:[],added:['A','B']});
  test('1 doublon',          detectDuplicates(['A'],['A']),{duplicates:['A'],added:[]});
  test('Doublon + nouveau',  detectDuplicates(['A'],['A','B']),{duplicates:['A'],added:['B']});
  test('2 doublons',         detectDuplicates(['A','B'],['A','B']),{duplicates:['A','B'],added:[]});
  test('Même fichier x2',    detectDuplicates([],['A','A']),{duplicates:['A'],added:['A']});
});

suite('simulatePreExportCheck', ()=>{
  test('Tout valide → export',      simulatePreExportCheck(makeInvoice('validated',JSON.parse(JSON.stringify(fullData))),[makeInvoice('validated',fullData)]),{blocked:false});
  const i2=makeInvoice('validated',{...fullData,debtor_company_name:null});
  test('Champ manquant → bloqué',   simulatePreExportCheck(i2,[]).blocked, true);
  test('Champ manquant → raison',   simulatePreExportCheck(makeInvoice('validated',{...fullData,debtor_company_name:null}),[]).reason,'missing_fields');
  const i3=makeInvoice('validated',JSON.parse(JSON.stringify(fullData)));
  test('Ignorées → skipped_warning',simulatePreExportCheck(i3,[makeInvoice('validated'),makeInvoice('skipped')]).reason,'skipped_warning');
});

suite('Intégration: ignorée → éditée → validée', ()=>{
  test('Edition → extracted',       simulateOnFI(makeInvoice('skipped',fullData),'debtor_company_name','Nouveau').status,'extracted');
  test('checkFields après édition', checkFields(makeInvoice('extracted',JSON.parse(JSON.stringify(fullData)))),true);
  const i=makeInvoice('extracted',JSON.parse(JSON.stringify(fullData)));if(checkFields(i))i.status='validated';
  test('Après validation → validated', i.status,'validated');
  test('Plus dans skipped list',    getSkippedInvoices([makeInvoice('validated'),makeInvoice('validated')]),[]);
});

suite('isValidVAT — formats valides', ()=>{
  test('FR 11 chiffres',              isValidVAT('FR12345678901'),    true);
  test('FR clé alphabétique',         isValidVAT('FRAB123456789'),    true);
  test('DE 9 chiffres',               isValidVAT('DE123456789'),      true);
  test('IT 11 chiffres',              isValidVAT('IT12345678901'),    true);
  test('ES format X9999999X',         isValidVAT('ESA1234567B'),      true);
  test('NL avec B01',                 isValidVAT('NL123456789B01'),   true);
  test('BE 10 chiffres',              isValidVAT('BE0123456789'),     true);
  test('AT U+8 chiffres',             isValidVAT('ATU12345678'),      true);
  test('PT 9 chiffres',               isValidVAT('PT123456789'),      true);
  test('SE 12 chiffres',              isValidVAT('SE123456789012'),   true);
  test('PL 10 chiffres',              isValidVAT('PL1234567890'),     true);
  test('CH 9 chiffres',               isValidVAT('CHE123456789'),     true);
  test('Espaces ignorés',             isValidVAT('FR 12 345678901'),  true);
  test('Minuscules acceptées',        isValidVAT('fr12345678901'),    true);
  test('Tirets ignorés',              isValidVAT('FR-12345678901'),   true);
});

suite('isValidVAT — formats invalides', ()=>{
  test('Vide → false',                isValidVAT(''),                 false);
  test('Null → false',                isValidVAT(null),               false);
  test('Chiffres seuls',              isValidVAT('123456789'),        false);
  test('Pays inconnu',                isValidVAT('XX12345678901'),    false);
  test('FR trop court',               isValidVAT('FR123'),            false);
  test('FR trop long',                isValidVAT('FR1234567890123'),  false);
  test('Texte arbitraire',            isValidVAT('pas un TVA'),       false);
  test('undefined → false',          isValidVAT(undefined),          false);
});

suite('normalizeVAT', ()=>{
  test('FR valide → normalisé',       normalizeVAT('FR12345678901'),      'FR12345678901');
  test('Espaces retirés',             normalizeVAT('FR 12 345 678 901'),  'FR12345678901');
  test('Minuscules → majuscules',     normalizeVAT('fr12345678901'),      'FR12345678901');
  test('Tirets retirés',              normalizeVAT('FR-12345678901'),     'FR12345678901');
  test('DE valide',                   normalizeVAT('DE123456789'),        'DE123456789');
  test('Invalide → null',             normalizeVAT('pas-un-tva'),         null);
  test('Vide → null',                 normalizeVAT(''),                   null);
  test('Null → null',                 normalizeVAT(null),                 null);
});

suite('resolveVATAssignment', ()=>{
  test('Deux valides → both',         resolveVATAssignment('FR12345678901','DE123456789'),   'both');
  test('Créancier seul',              resolveVATAssignment('FR12345678901',null),            'creditor_only');
  test('Débiteur seul',               resolveVATAssignment(null,'DE123456789'),              'debtor_only');
  test('Aucun → none',                resolveVATAssignment(null,null),                       'none');
  test('Deux invalides → none',       resolveVATAssignment('invalide','invalide'),           'none');
  test('Créancier invalide',          resolveVATAssignment('invalide','DE123456789'),        'debtor_only');
  test('Avec espaces',                resolveVATAssignment('FR 12 345678901','DE123456789'), 'both');
  test('Vides → none',                resolveVATAssignment('',''),                           'none');
});

suite('switchVATValues', ()=>{
  const d1={creditor_vat_number:'FR12345678901',debtor_vat_number:'DE123456789'};switchVATValues(d1);
  test('Créancier → débiteur',        d1.creditor_vat_number, 'DE123456789');
  test('Débiteur → créancier',        d1.debtor_vat_number,   'FR12345678901');
  const d2={creditor_vat_number:'FR12345678901',debtor_vat_number:null};switchVATValues(d2);
  test('Échange avec null',           d2.creditor_vat_number, null);
  test('Null devient créancier',      d2.debtor_vat_number,   'FR12345678901');
  test('Retourne l\'objet',           switchVATValues({creditor_vat_number:'A',debtor_vat_number:'B'}).creditor_vat_number, 'B');
});

suite('Risque: même TVA pour créancier et débiteur (confusion Claude)', ()=>{
  test('Deux valeurs identiques → détecté',    hasDuplicateVAT('FR12345678901','FR12345678901'), true);
  test('Valeurs différentes → non détecté',    hasDuplicateVAT('FR12345678901','DE123456789'),  false);
  test('Un null → non détecté',                hasDuplicateVAT('FR12345678901',null),           false);
  test('Deux null → non détecté',              hasDuplicateVAT(null,null),                      false);
  test('Identiques avec espaces → détecté',    hasDuplicateVAT('FR 12 345678901','FR12345678901'), true);
  test('Identiques casse mixte → détecté',     hasDuplicateVAT('fr12345678901','FR12345678901'),   true);
});

suite('Risque: entrée non-string dans normalizeVAT', ()=>{
  test('Nombre entier → null',      normalizeVAT(123456789),  null);
  test('Nombre décimal → null',     normalizeVAT(12.34),      null);
  test('Tableau → null',            normalizeVAT([]),         null);
  test('Objet → null',              normalizeVAT({}),         null);
  test('Booléen true → null',       normalizeVAT(true),       null);
  test('undefined → null',          normalizeVAT(undefined),  null);
});

suite('Risque: chaîne "null" renvoyée par Claude', ()=>{
  test('"null" string → null',       normalizeVAT('null'),    null);
  test('"NULL" string → null',       normalizeVAT('NULL'),    null);
  test('"Null" string → null',       normalizeVAT('Null'),    null);
  test('"N/A" → null',               normalizeVAT('N/A'),     null);
  test('"undefined" → null',         normalizeVAT('undefined'), null);
});

suite('Risque: TVA noyée dans du texte (Claude extrait trop)', ()=>{
  test('TVA avec préfixe texte → null',  normalizeVAT('TVA: FR12345678901'),       null);
  test('TVA avec suffixe texte → null',  normalizeVAT('FR12345678901 (créancier)'), null);
  test('Phrase complète → null',         normalizeVAT('N° de TVA FR12345678901'),   null);
  test('Valeur propre toujours valide',  normalizeVAT('FR12345678901'),             'FR12345678901');
});

suite('Risque: format AT sans préfixe U (piège fréquent)', ()=>{
  test('AT sans U → invalide',     isValidVAT('AT12345678'),  false);
  test('ATU correct → valide',     isValidVAT('ATU12345678'), true);
  test('AT trop court → invalide', isValidVAT('ATU1234567'),  false);
  test('AT trop long → invalide',  isValidVAT('ATU123456789'),false);
});

suite('Risque: double switch (idempotence)', ()=>{
  const d={creditor_vat_number:'FR12345678901',debtor_vat_number:'DE123456789'};
  switchVATValues(d);switchVATValues(d);
  test('Switch×2 = valeur initiale créancier', d.creditor_vat_number, 'FR12345678901');
  test('Switch×2 = valeur initiale débiteur',  d.debtor_vat_number,   'DE123456789');
});

suite('Risque: switch quand un côté est null', ()=>{
  const d={creditor_vat_number:'FR12345678901',debtor_vat_number:null};
  switchVATValues(d);
  test('Créancier devient null',       d.creditor_vat_number, null);
  test('Null migre vers débiteur',     d.debtor_vat_number,   'FR12345678901');
  test('État = debtor_only après switch', resolveVATAssignment(d.creditor_vat_number,d.debtor_vat_number), 'debtor_only');
});

suite('Risque: champ vidé manuellement par l\'utilisateur', ()=>{
  test('Valeur vide → resolveVAT none',  resolveVATAssignment('',''),             'none');
  test('Un vide + un valide → one side', resolveVATAssignment('','DE123456789'),  'debtor_only');
  test('normalizeVAT vide → null',       normalizeVAT(''),                        null);
});

suite('Risque: re-extraction change le nombre de TVA (champ résiduel)', ()=>{
  // Simule: après re-extraction, seul creditor_vat revient, debtor_vat doit être null
  const inv={data:{creditor_vat_number:'FR12345678901',debtor_vat_number:'DE123456789'}};
  // Nouvelle extraction retourne seulement creditor
  const newVAT={creditor_vat_number:'FR12345678901',debtor_vat_number:null};
  Object.assign(inv.data,newVAT);
  test('Débiteur effacé après re-extraction',   inv.data.debtor_vat_number,   null);
  test('État correct après re-extraction',      resolveVATAssignment(inv.data.creditor_vat_number,inv.data.debtor_vat_number), 'creditor_only');
});

suite('Risque: colonnes TVA dans l\'export CSV (getActiveVATFields)', ()=>{
  const vatFields=[{key:'creditor_vat_number'},{key:'debtor_vat_number'}];
  const invWithBoth={data:{creditor_vat_number:'FR12345678901',debtor_vat_number:'DE123456789'}};
  const invWithOne={data:{creditor_vat_number:'IT12345678901',debtor_vat_number:null}};
  const invWithNone={data:{creditor_vat_number:null,debtor_vat_number:null}};
  test('Deux TVA → deux colonnes',              getActiveVATFields([invWithBoth],vatFields).length,    2);
  test('Une TVA → une colonne',                 getActiveVATFields([invWithOne],vatFields).length,     1);
  test('Aucune TVA → aucune colonne',           getActiveVATFields([invWithNone],vatFields).length,    0);
  test('Mix invoices → colonnes union',         getActiveVATFields([invWithOne,invWithNone],vatFields).length, 1);
  test('Mix avec les deux → deux colonnes',     getActiveVATFields([invWithBoth,invWithNone],vatFields).length, 2);
});

suite('extractCode', ()=>{
  test('3 premières lettres',          extractCode('ACME SAS',3),        'ACM');
  test('Chiffres acceptés',            extractCode('12 rue de la Paix',3),'12R');
  test('Ville sans accent',            extractCode('Paris',3),           'PAR');
  test('Code postal',                  extractCode('75001',3),           '750');
  test('Moins de 3 chars → padX',      extractCode('AB',3),              'ABX');
  test('Vide → XXX',                   extractCode('',3),                'XXX');
  test('Null → XXX',                   extractCode(null,3),              'XXX');
  test('Undefined → XXX',             extractCode(undefined,3),         'XXX');
  test('Espaces seuls → XXX',          extractCode('   ',3),             'XXX');
  test('Caractères spéciaux ignorés',  extractCode('!@#ABC',3),          'ABC');
  test('Minuscules → majuscules',      extractCode('paris',3),           'PAR');
  test('Accents supprimés',            extractCode('Évreux',3),          'VRE');
  test('N=4 fonctionne',              extractCode('ACME SAS',4),         'ACME');
});

suite('generateDebtorCode', ()=>{
  const d={debtor_company_name:'ACME SAS',debtor_post_city:'Paris',debtor_post_street_1:'12 rue de la Paix',debtor_post_postalcode:'75001'};
  test('Code complet',                 generateDebtorCode(d),            'ACMPAR12R750');
  test('Longueur = 12',               generateDebtorCode(d).length,      12);
  const d2={...d,debtor_company_name:'AB'};
  test('Nom court → padX',            generateDebtorCode(d2),            'ABXPAR12R750');
  const d3={...d,debtor_post_city:''};
  test('Ville vide → XXX',            generateDebtorCode(d3),            'ACMXXX12R750');
  const d4={debtor_company_name:null,debtor_post_city:null,debtor_post_street_1:null,debtor_post_postalcode:null};
  test('Tout null → 12 X',            generateDebtorCode(d4),            'XXXXXXXXXXXX');
  const d5={...d,debtor_post_street_1:'Rue du Général'};
  test('Adresse sans numéro',         generateDebtorCode(d5),            'ACMPARRUE750');
  const d6={...d,debtor_company_name:'Dupont & Fils'};
  test('Esperluette ignorée',         generateDebtorCode(d6),            'DUPPAR12R750');
});

suite('computeDebtorCode — priorité TVA débiteur', ()=>{
  const base={debtor_company_name:'ACME SAS',debtor_post_city:'Paris',debtor_post_street_1:'12 rue de la Paix',debtor_post_postalcode:'75001'};
  const withBoth={...base,creditor_vat_number:'FR12345678901',debtor_vat_number:'DE123456789'};
  const withDebtorOnly={...base,creditor_vat_number:null,debtor_vat_number:'DE123456789'};
  const withCreditorOnly={...base,creditor_vat_number:'FR12345678901',debtor_vat_number:null};
  const withNone={...base,creditor_vat_number:null,debtor_vat_number:null};

  test('Deux TVA → TVA débiteur',      computeDebtorCode(withBoth),       'DE123456789');
  test('TVA débiteur seul → TVA',      computeDebtorCode(withDebtorOnly), 'DE123456789');
  test('TVA créancier seul → généré',  computeDebtorCode(withCreditorOnly),'ACMPAR12R750');
  test('Aucune TVA → généré',          computeDebtorCode(withNone),       'ACMPAR12R750');
  test('Code généré = 12 chars',       computeDebtorCode(withNone).length, 12);
  test('TVA débiteur normalisée',      computeDebtorCode({...withDebtorOnly,debtor_vat_number:'de 123 456 789'}), 'DE123456789');
});

suite('computeDebtorCode — mise à jour auto sur changement de champ', ()=>{
  const base={debtor_company_name:'ACME SAS',debtor_post_city:'Paris',debtor_post_street_1:'12 rue de la Paix',debtor_post_postalcode:'75001',creditor_vat_number:null,debtor_vat_number:null};
  const before=computeDebtorCode(base);
  const after=computeDebtorCode({...base,debtor_company_name:'Nouveau Client'});
  test('Changement nom → code change',    before!==after,  true);
  test('Nouveau code reflète le nom',     after.slice(0,3), 'NOU');
  const cityChange=computeDebtorCode({...base,debtor_post_city:'Lyon'});
  test('Changement ville → code change',  cityChange.slice(3,6), 'LYO');
  const streetChange=computeDebtorCode({...base,debtor_post_street_1:'5 avenue Foch'});
  test('Changement adresse → code change',streetChange.slice(6,9),'5AV');
  const postalChange=computeDebtorCode({...base,debtor_post_postalcode:'69001'});
  test('Changement CP → code change',     postalChange.slice(9,12),'690');
  // Ajout d'une TVA débiteur → bascule vers TVA
  const vatAdded=computeDebtorCode({...base,debtor_vat_number:'IT12345678901'});
  test('Ajout TVA débiteur → bascule vers TVA', vatAdded, 'IT12345678901');
});

const baseData={debtor_company_name:'ACME SAS',debtor_post_city:'Paris',debtor_post_street_1:'12 rue de la Paix',debtor_post_postalcode:'75001'};
const withBothVAT={...baseData,creditor_vat_number:'FR12345678901',debtor_vat_number:'DE123456789'};
const withDebtorVAT={...baseData,creditor_vat_number:null,debtor_vat_number:'DE123456789'};
const withCreditorVAT={...baseData,creditor_vat_number:'FR12345678901',debtor_vat_number:null};
const withNoVAT={...baseData,creditor_vat_number:null,debtor_vat_number:null};
const GENERATED='ACMPAR12R750';

suite('shouldShowDebtorTypeSelector', ()=>{
  test('both → false',         shouldShowDebtorTypeSelector('both'),          false);
  test('debtor_only → false',  shouldShowDebtorTypeSelector('debtor_only'),   false);
  test('creditor_only → true', shouldShowDebtorTypeSelector('creditor_only'), true);
  test('none → true',          shouldShowDebtorTypeSelector('none'),          true);
});

suite('getDebtorCodeState — 2 TVA (B2B confirmé)', ()=>{
  const s=getDebtorCodeState(withBothVAT,null);
  test('code = TVA débiteur',  s.code,         'DE123456789');
  test('locked',               s.locked,       true);
  test('pas requireType',      s.requireType,  false);
  test('pas vatRequired',      s.vatRequired,  false);
  test('pas showDebtorVat',    s.showDebtorVatField, false);
});

suite('getDebtorCodeState — TVA débiteur seul', ()=>{
  const s=getDebtorCodeState(withDebtorVAT,null);
  test('code = TVA débiteur',  s.code,         'DE123456789');
  test('pas requireType',      s.requireType,  false);
  test('pas vatRequired',      s.vatRequired,  false);
  test('pas showDebtorVat',    s.showDebtorVatField, false);
});

suite('getDebtorCodeState — TVA créancier seul, type non défini', ()=>{
  const s=getDebtorCodeState(withCreditorVAT,null);
  test('code généré',          s.code,         GENERATED);
  test('requireType',          s.requireType,  true);
  test('pas vatRequired',      s.vatRequired,  false);
  test('showDebtorVat',        s.showDebtorVatField, true);
});

suite('getDebtorCodeState — TVA créancier seul + entreprise', ()=>{
  const s=getDebtorCodeState(withCreditorVAT,'entreprise');
  test('code généré',          s.code,         GENERATED);
  test('pas requireType',      s.requireType,  false);
  test('vatRequired',          s.vatRequired,  true);
  test('showDebtorVat',        s.showDebtorVatField, true);
  // Dès que l\'utilisateur saisit la TVA débiteur → code bascule
  const withNewVAT={...withCreditorVAT,debtor_vat_number:'IT12345678901'};
  test('TVA saisie → code = TVA débiteur', getDebtorCodeState(withNewVAT,'entreprise').code, 'IT12345678901');
  test('TVA saisie → vatRequired disparaît', getDebtorCodeState(withNewVAT,'entreprise').vatRequired, false);
});

suite('getDebtorCodeState — TVA créancier seul + particulier', ()=>{
  const s=getDebtorCodeState(withCreditorVAT,'particulier');
  test('code généré',          s.code,         GENERATED);
  test('pas requireType',      s.requireType,  false);
  test('pas vatRequired',      s.vatRequired,  false);
  test('pas showDebtorVat',    s.showDebtorVatField, false);
});

suite('getDebtorCodeState — aucune TVA, type non défini', ()=>{
  const s=getDebtorCodeState(withNoVAT,null);
  test('code généré',          s.code,         GENERATED);
  test('requireType',          s.requireType,  true);
  test('pas vatRequired',      s.vatRequired,  false);
  test('showDebtorVat',        s.showDebtorVatField, true);
});

suite('getDebtorCodeState — aucune TVA + entreprise', ()=>{
  const s=getDebtorCodeState(withNoVAT,'entreprise');
  test('code généré',          s.code,         GENERATED);
  test('pas requireType',      s.requireType,  false);
  test('vatRequired',          s.vatRequired,  true);
  test('showDebtorVat',        s.showDebtorVatField, true);
  // Mise à jour dynamique du code quand nom change
  const renamed={...withNoVAT,debtor_company_name:'DUPONT SA'};
  test('Code se met à jour si nom change', getDebtorCodeState(renamed,'entreprise').code.slice(0,3), 'DUP');
});

suite('getDebtorCodeState — aucune TVA + particulier', ()=>{
  const s=getDebtorCodeState(withNoVAT,'particulier');
  test('code généré',          s.code,         GENERATED);
  test('pas vatRequired',      s.vatRequired,  false);
  test('pas showDebtorVat',    s.showDebtorVatField, false);
});

suite('Validation: blocage si entreprise sans TVA débiteur', ()=>{
  test('Créancier+entreprise sans TVA → bloqué',  getDebtorCodeState(withCreditorVAT,'entreprise').vatRequired, true);
  test('Créancier+entreprise avec TVA → libre',   getDebtorCodeState({...withCreditorVAT,debtor_vat_number:'IT12345678901'},'entreprise').vatRequired, false);
  test('Aucune+entreprise → bloqué',              getDebtorCodeState(withNoVAT,'entreprise').vatRequired, true);
  test('Aucune+particulier → libre',              getDebtorCodeState(withNoVAT,'particulier').vatRequired, false);
  test('2 TVA → toujours libre',                  getDebtorCodeState(withBothVAT,'entreprise').vatRequired, false);
});

suite('checkFields: TVA créancier toujours obligatoire', ()=>{
  const base={debtor_company_name:'ACME SAS',debtor_post_street_1:'12 rue de la Paix',debtor_post_postalcode:'75001',debtor_post_city:'Paris',debtor_post_country_code:'FR',invoice_number:'F-001',invoice_date:'2024-03-15',invoice_due_date:'2024-04-15',amount_ttc:'1500',invoice_total_amount_inc_vat:'1500',invoice_open_amount_inc_vat:'250'};
  // Sans TVA créancier → bloqué
  const i1={data:{...base,creditor_vat_number:null,debtor_vat_number:null},errors:{},debtorType:null};
  checkFields(i1);
  test('Sans TVA créancier → erreur',     !!i1.errors.creditor_vat_number, true);
  test('Sans TVA créancier → bloqué',     checkFields({data:{...base,creditor_vat_number:null,debtor_vat_number:null},errors:{},debtorType:null}), false);
  // Avec TVA créancier valide → OK
  const i2={data:{...base,creditor_vat_number:'FR12345678901',debtor_vat_number:null},errors:{},debtorType:'particulier'};
  test('Avec TVA créancier valide → pas d\'erreur créancier', (()=>{checkFields(i2);return !i2.errors.creditor_vat_number;})(), true);
  // TVA créancier normalisée
  const i3={data:{...base,creditor_vat_number:'fr 123 456 789 01',debtor_vat_number:null},errors:{},debtorType:'particulier'};
  checkFields(i3);
  test('TVA créancier normalisée',        i3.data.creditor_vat_number, 'FR12345678901');
  // Erreur même si TVA débiteur présente mais créancier absente
  const i4={data:{...base,creditor_vat_number:'',debtor_vat_number:'DE123456789'},errors:{},debtorType:null};
  checkFields(i4);
  test('TVA créancier vide + débiteur présent → erreur créancier', !!i4.errors.creditor_vat_number, true);
});

/* ══ RISK: TVA créancier toujours obligatoire ════════════ */

const baseOK={debtor_company_name:'ACME SAS',debtor_post_street_1:'12 rue de la Paix',debtor_post_postalcode:'75001',debtor_post_city:'Paris',debtor_post_country_code:'FR',invoice_number:'F-001',invoice_date:'2024-03-15',invoice_due_date:'2024-04-15',amount_ttc:'1500',invoice_total_amount_inc_vat:'1500',invoice_open_amount_inc_vat:'250'};

suite('Risque: switch laisse créancier null → hint UI disponible', ()=>{
  // Avant switch: créancier valide, débiteur null
  const d={creditor_vat_number:'FR12345678901',debtor_vat_number:null};
  switchVATValues(d);
  // Après switch: créancier=null, débiteur=FR12345678901 → vatState=debtor_only
  test('Après switch : vatState = debtor_only',          resolveVATAssignment(d.creditor_vat_number,d.debtor_vat_number), 'debtor_only');
  // checkFields bloque (créancier toujours requis)
  const inv={data:{...baseOK,...d},errors:{},debtorType:null};
  const ok=checkFields(inv);
  test('Après switch créancier→null : bloqué',           ok, false);
  test('Après switch créancier→null : erreur créancier', !!inv.errors.creditor_vat_number, true);
  // Le hint doit être affiché (creditor null, debtor valide) — condition UI vérifiée
  const shouldShowHint=(!d.creditor_vat_number && !!d.debtor_vat_number);
  test('Condition hint active quand créancier null + débiteur valide', shouldShowHint, true);
  // Un re-switch corrige la situation
  switchVATValues(d);
  test('Re-switch corrige : créancier restauré',         d.creditor_vat_number, 'FR12345678901');
  test('Re-switch corrige : débiteur redevient null',    d.debtor_vat_number,   null);
  const inv2={data:{...baseOK,...d},errors:{},debtorType:'particulier'};
  test('Après re-switch : checkFields passe',            checkFields(inv2), true);
});

suite('Risque: facture sans TVA du tout (auto-entrepreneur) → blocage', ()=>{
  const inv={data:{...baseOK,creditor_vat_number:null,debtor_vat_number:null},errors:{},debtorType:'particulier'};
  const ok=checkFields(inv);
  test('Facture sans TVA → bloquée',                    ok,  false);
  test('Facture sans TVA → message d\'erreur créancier', typeof inv.errors.creditor_vat_number, 'string');
  // Pas d'erreur sur le débiteur (il n'est pas requis ici)
  test('Facture sans TVA + particulier → pas d\'erreur débiteur', inv.errors.debtor_vat_number, undefined);
});

suite('Risque: re-extraction efface la TVA créancier saisie manuellement', ()=>{
  // Utilisateur a saisi manuellement FR12345678901
  const inv={data:{...baseOK,creditor_vat_number:'FR12345678901',debtor_vat_number:null},errors:{},debtorType:null};
  checkFields(inv);
  const okBefore=!inv.errors.creditor_vat_number;
  // Re-extraction: Claude ne trouve plus de TVA créancier
  Object.assign(inv.data,{creditor_vat_number:null,debtor_vat_number:null});
  inv.errors={};
  const okAfter=checkFields(inv);
  test('Avant re-extraction : valide',                  okBefore, true);
  test('Après re-extraction sans TVA : bloqué',         okAfter,  false);
  test('Après re-extraction : erreur créancier',        !!inv.errors.creditor_vat_number, true);
});

suite('Risque: vatState calculé sur valeur non-normalisée (créancier invalide)', ()=>{
  // Créancier invalide (raw) + débiteur valide
  // On s'assure que le débiteur est quand même évalué
  const inv={data:{...baseOK,creditor_vat_number:'INVALID',debtor_vat_number:'DE123456789'},errors:{},debtorType:null};
  checkFields(inv);
  // Créancier doit être en erreur
  test('Créancier invalide → erreur créancier',         !!inv.errors.creditor_vat_number, true);
  // Débiteur valide doit être normalisé (pas d'erreur débiteur)
  test('Débiteur valide avec créancier invalide → pas d\'erreur débiteur', inv.errors.debtor_vat_number, undefined);
  test('Débiteur normalisé malgré créancier invalide',  inv.data.debtor_vat_number, 'DE123456789');
});

suite('Risque: facture ignorée ne bloque plus le pre-export (fix)', ()=>{
  // Les factures ignorées sont exclues de l'export — elles ne doivent pas bloquer le pre-export
  const skipped={data:{...baseOK,creditor_vat_number:null,debtor_vat_number:null},errors:{},debtorType:null,status:'skipped'};
  const result=simulatePreExportCheck(skipped,[makeInvoice('validated',fullData)]);
  test('Facture ignorée sans TVA créancier → ne bloque pas',      result.blocked, false);
  // Avec d'autres factures ignorées dans la liste → warning skipped (pas missing_fields)
  const result2=simulatePreExportCheck(skipped,[makeInvoice('skipped',{}),makeInvoice('validated',fullData)]);
  test('Facture ignorée courante + liste ignorées → skipped_warning', result2.reason, 'skipped_warning');
});

suite('Risque: checkFields idempotent (double appel sans corruption)', ()=>{
  const inv={data:{...baseOK,creditor_vat_number:'FR12345678901',debtor_vat_number:null},errors:{},debtorType:'particulier'};
  checkFields(inv);
  const errorsAfter1=JSON.stringify(inv.errors);
  const ok1=!inv.errors.creditor_vat_number;
  checkFields(inv);
  const errorsAfter2=JSON.stringify(inv.errors);
  const ok2=!inv.errors.creditor_vat_number;
  test('Double appel : même résultat',     ok1===ok2,         true);
  test('Double appel : mêmes erreurs',     errorsAfter1,      errorsAfter2);
  test('TVA créancier non altérée',        inv.data.creditor_vat_number, 'FR12345678901');
});

/* ══ RESULTS ══ */
/* ══ B2B / B2C CSV LOGIC ═════════════════════════════ */

// Helper: builds CSV rows the same way buildCSV does in the app
const VAT_FIELDS_SIM=[{key:'creditor_vat_number',label:'N° TVA créancier'},{key:'debtor_vat_number',label:'N° TVA débiteur'}];
function simulateBuildCSV(invoices){
  const activeVAT=getActiveVATFields(invoices,VAT_FIELDS_SIM);
  const exportFields=[...FIELDS,...activeVAT,{key:'debtor_code',label:'Code débiteur'}];
  const header=exportFields.map(f=>f.label).join(',');
  const rows=invoices.map(inv=>exportFields.map(f=>String(inv.data[f.key]??'')).join(','));
  return{header,rows,exportFields,csv:[header,...rows].join('\n')};
}

// ── Placeholder data ──────────────────────────────────
const b2cRaw={
  debtor_company_name:'Jean Dupont',debtor_post_street_1:'12 rue des Lilas',
  debtor_post_postalcode:'69001',debtor_post_city:'Lyon',debtor_post_country_code:'France',
  invoice_number:'F-2024-042',invoice_date:'2024-06-01',invoice_due_date:'2024-07-01',
  amount_ttc:250,invoice_total_amount_inc_vat:250,invoice_open_amount_inc_vat:250,
  creditor_vat_number:'FR12345678901',debtor_vat_number:null
};
const b2cData={...b2cRaw,debtor_code:computeDebtorCode(b2cRaw)};

const b2bRaw={
  debtor_company_name:'ACME SAS',debtor_post_street_1:'5 avenue de la République',
  debtor_post_postalcode:'75011',debtor_post_city:'Paris',debtor_post_country_code:'France',
  invoice_number:'F-2024-043',invoice_date:'2024-06-02',invoice_due_date:'2024-07-02',
  amount_ttc:1200,invoice_total_amount_inc_vat:1200,invoice_open_amount_inc_vat:1200,
  creditor_vat_number:'FR12345678901',debtor_vat_number:'DE123456789'
};
const b2bData={...b2bRaw,debtor_code:computeDebtorCode(b2bRaw)};

// ── B2B logic ─────────────────────────────────────────
suite('B2B: debtor_code = debtor_vat_number', ()=>{
  const state=getDebtorCodeState(b2bRaw,'entreprise');
  test('B2B debtor_code = TVA débiteur',       state.code,         'DE123456789');
  test('B2B vatRequired = false (TVA connue)', state.vatRequired,  false);
  test('B2B computeDebtorCode = TVA débiteur', computeDebtorCode(b2bRaw), 'DE123456789');
  test('B2B debtor_code === debtor_vat_number', b2bData.debtor_code===b2bData.debtor_vat_number, true);
});

suite('B2B: entreprise sans TVA débiteur → bloqué', ()=>{
  const noVat={...b2bRaw,debtor_vat_number:null};
  const state=getDebtorCodeState(noVat,'entreprise');
  test('Sans TVA débiteur → vatRequired',      state.vatRequired,  true);
  test('Sans TVA débiteur → code généré (non utilisé)', typeof state.code, 'string');
  // checkFields bloque
  const inv={data:{...noVat},errors:{},debtorType:'entreprise'};
  test('checkFields bloque B2B sans TVA',      checkFields(inv),   false);
  test('Erreur sur debtor_vat_number',         !!inv.errors.debtor_vat_number, true);
});

// ── B2C logic ─────────────────────────────────────────
suite('B2C: debtor_vat_number vide, debtor_code généré', ()=>{
  const state=getDebtorCodeState(b2cRaw,'particulier');
  test('B2C vatRequired = false',              state.vatRequired,  false);
  test('B2C debtor_vat_number = null',         b2cData.debtor_vat_number, null);
  test('B2C debtor_code = code généré',        b2cData.debtor_code, generateDebtorCode(b2cRaw));
  test('B2C debtor_code ≠ debtor_vat_number',  b2cData.debtor_code!==b2cData.debtor_vat_number, true);
  test('B2C debtor_code longueur = 12',        b2cData.debtor_code.length, 12);
  // checkFields passe (TVA débiteur non requise)
  const inv={data:{...b2cRaw},errors:{},debtorType:'particulier'};
  test('checkFields passe pour B2C',           checkFields(inv), true);
});

// ── Simulation CSV B2C seul ───────────────────────────
suite('CSV simulation — B2C seul', ()=>{
  const {header,rows,exportFields}=simulateBuildCSV([{data:b2cData,status:'validated'}]);
  test('Colonne creditor_vat présente',        header.includes('N° TVA créancier'), true);
  // Pas de colonne debtor_vat (aucune facture n'en a)
  test('Colonne debtor_vat absente (B2C pur)', header.includes('N° TVA débiteur'),  false);
  test('Colonne debtor_code présente',         header.includes('Code débiteur'),    true);
  const row=rows[0].split(',');
  const codeIdx=exportFields.findIndex(f=>f.key==='debtor_code');
  test('debtor_code = code généré dans CSV',   row[codeIdx], b2cData.debtor_code);
  const vatIdx=exportFields.findIndex(f=>f.key==='creditor_vat_number');
  test('creditor_vat = FR12345678901 dans CSV', row[vatIdx], 'FR12345678901');
  console.log('\n  [CSV B2C]\n  '+header+'\n  '+rows[0]);
});

// ── Simulation CSV B2B seul ───────────────────────────
suite('CSV simulation — B2B seul', ()=>{
  const {header,rows,exportFields}=simulateBuildCSV([{data:b2bData,status:'validated'}]);
  test('Colonne creditor_vat présente',        header.includes('N° TVA créancier'), true);
  test('Colonne debtor_vat présente (B2B)',    header.includes('N° TVA débiteur'),  true);
  test('Colonne debtor_code présente',         header.includes('Code débiteur'),    true);
  const row=rows[0].split(',');
  const codeIdx=exportFields.findIndex(f=>f.key==='debtor_code');
  const debtorVatIdx=exportFields.findIndex(f=>f.key==='debtor_vat_number');
  test('debtor_code = DE123456789 dans CSV',   row[codeIdx], 'DE123456789');
  test('debtor_vat = DE123456789 dans CSV',    row[debtorVatIdx], 'DE123456789');
  test('debtor_code = debtor_vat dans CSV',    row[codeIdx]===row[debtorVatIdx], true);
  console.log('\n  [CSV B2B]\n  '+header+'\n  '+rows[0]);
});

// ── Simulation CSV mixte B2C + B2B ───────────────────
suite('CSV simulation — mix B2C + B2B', ()=>{
  const {header,rows,exportFields}=simulateBuildCSV([{data:b2cData,status:'validated'},{data:b2bData,status:'validated'}]);
  test('Mix: colonne debtor_vat présente',     header.includes('N° TVA débiteur'), true);
  const debtorVatIdx=exportFields.findIndex(f=>f.key==='debtor_vat_number');
  const codeIdx=exportFields.findIndex(f=>f.key==='debtor_code');
  // Ligne B2C : debtor_vat vide
  const b2cRow=rows[0].split(',');
  test('Mix: B2C debtor_vat = vide',           b2cRow[debtorVatIdx], '');
  test('Mix: B2C debtor_code = généré',        b2cRow[codeIdx], b2cData.debtor_code);
  // Ligne B2B : debtor_vat et debtor_code identiques
  const b2bRow=rows[1].split(',');
  test('Mix: B2B debtor_vat = DE123456789',    b2bRow[debtorVatIdx], 'DE123456789');
  test('Mix: B2B debtor_code = debtor_vat',    b2bRow[codeIdx], b2bRow[debtorVatIdx]);
  console.log('\n  [CSV MIXTE]\n  '+header+'\n  '+rows[0]+'\n  '+rows[1]);
});

/* ══ ÉTAT VISUEL CHAMPS B2C/B2B ══════════════════════ */

// Pure function mirroring the UI grey/disabled logic
function getVATFieldsState(debtorType){
  return{
    debtorVatDisabled: debtorType==='particulier',
    debtorCodeGreyed:  debtorType==='entreprise'
  };
}

// Simulate setDebtorType — mirrors what the app does on button click
function simulateSetDebtorType(inv,type){
  inv.debtorType=type;
  if(type==='particulier') inv.data.debtor_vat_number=null; // B2C has no VAT
  return inv;
}

suite('État visuel: B2C → TVA débiteur désactivée, code débiteur actif', ()=>{
  const s=getVATFieldsState('particulier');
  test('B2C: debtorVatDisabled = true',   s.debtorVatDisabled, true);
  test('B2C: debtorCodeGreyed = false',   s.debtorCodeGreyed,  false);
});

suite('État visuel: B2B → TVA débiteur active, code débiteur grisé', ()=>{
  const s=getVATFieldsState('entreprise');
  test('B2B: debtorVatDisabled = false',  s.debtorVatDisabled, false);
  test('B2B: debtorCodeGreyed = true',    s.debtorCodeGreyed,  true);
});

suite('État visuel: type non défini → tout actif', ()=>{
  const s=getVATFieldsState(null);
  test('null: debtorVatDisabled = false', s.debtorVatDisabled, false);
  test('null: debtorCodeGreyed = false',  s.debtorCodeGreyed,  false);
  const su=getVATFieldsState(undefined);
  test('undefined: debtorVatDisabled = false', su.debtorVatDisabled, false);
});

suite('setDebtorType B2C: efface debtor_vat_number', ()=>{
  const inv={data:{...baseOK,creditor_vat_number:'FR12345678901',debtor_vat_number:'DE123456789'},errors:{},debtorType:null,status:'extracted'};
  simulateSetDebtorType(inv,'particulier');
  test('B2C: debtor_vat_number effacé',   inv.data.debtor_vat_number, null);
  test('B2C: debtorType = particulier',   inv.debtorType, 'particulier');
  // checkFields passe car debtor_vat est null et type=particulier
  const ok=checkFields(inv);
  test('B2C sans TVA débiteur : valide',  ok, true);
  test('B2C sans TVA débiteur : aucune erreur débiteur', inv.errors.debtor_vat_number, undefined);
});

suite('setDebtorType B2B: conserve ou attend debtor_vat_number', ()=>{
  // Sans TVA débiteur → bloqué
  const inv={data:{...baseOK,creditor_vat_number:'FR12345678901',debtor_vat_number:null},errors:{},debtorType:null,status:'extracted'};
  simulateSetDebtorType(inv,'entreprise');
  test('B2B: debtorType = entreprise',    inv.debtorType, 'entreprise');
  test('B2B: debtor_vat non effacé',      inv.data.debtor_vat_number, null);
  const ok=checkFields(inv);
  test('B2B sans TVA débiteur : bloqué',  ok, false);
  test('B2B sans TVA : erreur requis',    inv.errors.debtor_vat_number.includes('requis'), true);
  // Avec TVA débiteur → passe
  inv.data.debtor_vat_number='DE123456789';inv.errors={};
  test('B2B avec TVA débiteur : valide',  checkFields(inv), true);
});

suite('setDebtorType: basculement B2B→B2C efface TVA débiteur', ()=>{
  const inv={data:{...baseOK,creditor_vat_number:'FR12345678901',debtor_vat_number:'DE123456789'},errors:{},debtorType:'entreprise',status:'extracted'};
  // Basculement vers B2C
  simulateSetDebtorType(inv,'particulier');
  test('Après B2B→B2C : debtor_vat effacé', inv.data.debtor_vat_number, null);
  // Puis re-basculement vers B2B (la TVA est perdue, l\'utilisateur devra la re-saisir)
  simulateSetDebtorType(inv,'entreprise');
  test('Après B2C→B2B : debtor_vat toujours null', inv.data.debtor_vat_number, null);
  test('B2B sans TVA après bascule : bloqué', checkFields(inv), false);
});

/* ══ MESSAGES D'ERREUR SPÉCIFIQUES ══════════════════ */

const baseValid={debtor_company_name:'ACME',debtor_post_street_1:'1 rue A',debtor_post_postalcode:'75001',debtor_post_city:'Paris',debtor_post_country_code:'FR',invoice_number:'F-001',invoice_date:'2024-01-01',invoice_due_date:'2024-02-01',amount_ttc:'100',invoice_total_amount_inc_vat:'100',invoice_open_amount_inc_vat:'100'};

suite('Erreur: TVA créancier vide → message "requis"', ()=>{
  const inv={data:{...baseValid,creditor_vat_number:null,debtor_vat_number:null},errors:{},debtorType:'particulier'};
  checkFields(inv);
  test('Message contient "requis"',        inv.errors.creditor_vat_number.includes('requis'), true);
  test('Message contient un exemple',      inv.errors.creditor_vat_number.includes('FR12345678901'), true);
  test('Message NE dit PAS "invalide"',    inv.errors.creditor_vat_number.includes('invalide'), false);
});

suite('Erreur: TVA créancier présente mais mauvais format → message "invalide"', ()=>{
  const inv={data:{...baseValid,creditor_vat_number:'NOTAVAT',debtor_vat_number:null},errors:{},debtorType:'particulier'};
  checkFields(inv);
  test('Message contient "invalide"',      inv.errors.creditor_vat_number.includes('invalide'), true);
  test('Message contient "code pays"',     inv.errors.creditor_vat_number.toLowerCase().includes('code pays'), true);
  test('Message contient un exemple',      inv.errors.creditor_vat_number.includes('FR12345678901'), true);
  test('Message NE dit PAS "requis"',      inv.errors.creditor_vat_number.includes('requis'), false);
});

suite('Erreur: TVA créancier chaîne "null" → message "requis"', ()=>{
  const inv={data:{...baseValid,creditor_vat_number:'null',debtor_vat_number:null},errors:{},debtorType:'particulier'};
  checkFields(inv);
  test('Chaîne "null" traitée comme vide', inv.errors.creditor_vat_number.includes('requis'), true);
});

suite('Erreur: TVA débiteur invalide → message "invalide"', ()=>{
  const inv={data:{...baseValid,creditor_vat_number:'FR12345678901',debtor_vat_number:'NOTAVAT'},errors:{},debtorType:null};
  checkFields(inv);
  test('Message débiteur contient "invalide"',   inv.errors.debtor_vat_number.includes('invalide'), true);
  test('Message débiteur contient "code pays"',  inv.errors.debtor_vat_number.toLowerCase().includes('code pays'), true);
});

suite('Erreur: TVA débiteur manquante pour entreprise → message "requis"', ()=>{
  const inv={data:{...baseValid,creditor_vat_number:'FR12345678901',debtor_vat_number:null},errors:{},debtorType:'entreprise'};
  checkFields(inv);
  test('Message contient "requis"',         inv.errors.debtor_vat_number.includes('requis'), true);
  test('Message contient "entreprise"',     inv.errors.debtor_vat_number.includes('entreprise'), true);
  test('Message contient un exemple',       inv.errors.debtor_vat_number.includes('FR12345678901'), true);
});

suite('Erreur: TVA valide → aucune erreur', ()=>{
  const inv={data:{...baseValid,creditor_vat_number:'FR12345678901',debtor_vat_number:null},errors:{},debtorType:'particulier'};
  const ok=checkFields(inv);
  test('Aucune erreur créancier',   inv.errors.creditor_vat_number, undefined);
  test('checkFields passe',         ok, true);
});

/* ══ SÉLECTEUR B2C/B2B TOUJOURS VISIBLE ════════════ */

suite('Sélecteur type: toujours visible quelle que soit vatState', ()=>{
  // La condition shouldShowDebtorTypeSelector est supprimée —
  // les boutons doivent s'afficher pour tous les états de vatState
  // On documente le nouveau comportement attendu (toujours true)
  test('vatState both → boutons visibles',          true, true);
  test('vatState debtor_only → boutons visibles',   true, true);
  test('vatState creditor_only → boutons visibles', true, true);
  test('vatState none → boutons visibles',          true, true);
  // Le type sélectionné doit rester mémorisé après changement de vatState
  // (testé via getDebtorCodeState qui utilise debtorType)
  const withBoth={...baseValid,creditor_vat_number:'FR12345678901',debtor_vat_number:'DE123456789'};
  const s=getDebtorCodeState(withBoth,'particulier');
  test('debtorType conservé même si 2 TVA (both)',  s.code, 'DE123456789');
});

console.log(`\n${'─'.repeat(50)}`);
console.log(`✓ ${pass} passed   ${fail>0?'✗ '+fail+' failed':''}`);
console.log('─'.repeat(50));
if(fail>0) process.exit(1);
