(() => {
'use strict';
const page=document.getElementById('project-page');
const brand=document.body.dataset.projectBrand || (location.hostname.includes('lucky')?'Team Lucky':'Tribu Immo');
const fmt=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const n=id=>{const el=document.getElementById(id); return el&&el.value!==''&&el.checkValidity()?Number(el.value):0;};
window.projectAppointmentSummary=function(form){return '\n\nRendez-vous souhaité : '+(form.elements.echange_format?.value||'À définir')+'\nDisponibilité proposée : '+(form.elements.echange_date?.value||'À convenir')+'\nCréneau à confirmer personnellement.';};
document.querySelectorAll('form#fm:not([data-presentation]),form[data-contact-form],form#sim-lead-form').forEach(form=>{
 const area=document.createElement('fieldset'); area.className='project-contact';
 area.innerHTML='<legend>Votre échange individuel</legend><label>Format souhaité<select name="echange_format"><option>Visio</option><option>Café — lieu à convenir</option><option>Appel téléphonique</option></select></label><label>Vos disponibilités (facultatif)<input name="echange_date" maxlength="120" placeholder="Ex. mardi après-midi ou vendredi matin"></label><p>Il s’agit d’une demande de rendez-vous. Le lieu, la date et l’heure vous seront confirmés personnellement.</p>';
 const anchor=form.querySelector('[type="submit"]'); if(anchor)anchor.before(area);else form.append(area);
 form.addEventListener('formdata',event=>{const data=event.formData;data.set('message',(data.get('message')||'')+window.projectAppointmentSummary(form));});
});
if(new URLSearchParams(location.search).has('projet')){
 try{const draft=JSON.parse(sessionStorage.getItem('recruitment-project')||'null');if(draft&&Date.now()-draft.at<3600000){const field=document.querySelector('textarea[name="message"]');if(field){field.value=(field.value?field.value+'\n\n':'')+draft.summary;sessionStorage.removeItem('recruitment-project');}}}catch{}
}
if(!page)return;
let active='debutant';
const names={debutant:'Reconversion',professionnel:'Conseiller expérimenté',equipe:'Agence ou équipe'};
function choose(key){active=names[key]?key:'debutant'; document.querySelectorAll('[data-project-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.projectChoice===active)));document.querySelectorAll('[data-project-panel]').forEach(p=>p.hidden=p.dataset.projectPanel!==active);update();}
function valid(ids){return ids.every(id=>{const e=document.getElementById(id);return e.value!==''&&e.checkValidity();});}
function calculateBudget(v){return {before:v.cost*v.delay+v.setup,surplus:v.sales.map((s,i)=>s*v.commission-v.cost*12-(i===0?v.setup:0))};}
function calculateAgency(current,future,transition){const monthly=current-future;return{monthly,annual:monthly*12-transition,months:monthly>0?Math.ceil(transition/monthly):null};}
window.recruitmentCalculations={calculateBudget,calculateAgency};
function update(){
 const budgetIds=['commission','cost','setup','delay','sales1','sales2','sales3'];
 const budgetOk=valid(budgetIds)&&[1,2,3].every(year=>n('delay')<year*12||n('sales'+year)===0);const r=calculateBudget({commission:n('commission'),cost:n('cost'),setup:n('setup'),delay:n('delay'),sales:[n('sales1'),n('sales2'),n('sales3')]});
 document.getElementById('budget-error').hidden=budgetOk;
 document.getElementById('cash').textContent=budgetOk?fmt(r.before):'—';
 document.getElementById('budget-results').innerHTML=budgetOk?r.surplus.map((amount,i)=>'<tr><th scope="row">Année '+(i+1)+'</th><td>'+n('sales'+(i+1))+'</td><td>'+fmt(n('sales'+(i+1))*n('commission'))+'</td><td>'+fmt(n('cost')*12+(i===0?n('setup'):0))+'</td><td>'+fmt(amount)+'</td></tr>').join(''):'';
 const aIds=['rent','staff','portals','franchise','other','future','transition'];const aOk=valid(aIds);let current=['rent','staff','portals','franchise','other'].reduce((s,id)=>s+n(id),0);const a=calculateAgency(current,n('future'),n('transition'));
 document.getElementById('agency-error').hidden=aOk;
 document.getElementById('agency-result').textContent=aOk?'Écart mensuel de charges : '+fmt(a.monthly)+' · Écart sur 12 mois, transition déduite : '+fmt(a.annual):'—';
 document.getElementById('agency-payback').textContent=aOk?(a.monthly>0?'Frais de transition compensés en environ '+a.months+' mois, à dépenses constantes.':'Aucune économie mensuelle dans ce scénario.') :'';
 const lines=['PROJET '+brand,'Profil : '+names[active],'Pays envisagé : '+document.getElementById('project-country').value];
 if(active==='debutant')lines.push(budgetOk?'Hypothèses personnelles : commission par vente '+fmt(n('commission'))+', frais mensuels '+fmt(n('cost'))+', frais initiaux '+fmt(n('setup'))+', premier encaissement dans '+n('delay')+' mois.':'Budget non renseigné ou incomplet.',...(budgetOk?r.surplus.map((v,i)=>'Année '+(i+1)+' : '+n('sales'+(i+1))+' ventes, solde avant cotisations et impôts '+fmt(v)):[]),...(budgetOk?['Dépenses professionnelles avant premier encaissement : '+fmt(r.before)]:[]));
 if(active==='equipe')lines.push(aOk?'Charges actuelles : '+fmt(current)+'/mois ; charges futures : '+fmt(n('future'))+'/mois ; transition : '+fmt(n('transition'))+'. Écart sur 12 mois : '+fmt(a.annual)+'.':'Comparaison de charges non renseignée ou incomplète.');
 lines.push('Objectif de l’échange : '+document.getElementById('project-goal').value,'Projection indicative fondée sur mes saisies ; pas de revenu garanti.');
 document.getElementById('project-summary').value=lines.join('\n');
 document.getElementById('project-send').disabled=(active==='debutant'&&!budgetOk)||(active==='equipe'&&!aOk);
}
document.querySelectorAll('[data-project-choice]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.projectChoice)));
page.addEventListener('input',update);page.addEventListener('change',update);
document.getElementById('project-send').addEventListener('click',()=>{update();try{sessionStorage.setItem('recruitment-project',JSON.stringify({summary:document.getElementById('project-summary').value,at:Date.now()}));location.href=page.dataset.contact;}catch{document.getElementById('storage-error').hidden=false;}});
choose(new URLSearchParams(location.search).get('profil'));
})();
