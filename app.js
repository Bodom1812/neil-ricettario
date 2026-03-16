const DEFAULT_RECIPE_IMAGE = "/images/Chef Lai.png";

const state = { search:"", category:"Tutte", onlyFavs:false, mode:"all", quick:"all", recipes:[] };
const favKey="ricettario-neil-favorites";
const noteKey="ricettario-neil-notes";
const recentKey="ricettario-neil-recent";
const getFavs=()=>JSON.parse(localStorage.getItem(favKey)||"[]");
const setFavs=v=>localStorage.setItem(favKey,JSON.stringify(v));
const getNotes=()=>JSON.parse(localStorage.getItem(noteKey)||"{}");
const setNotes=v=>localStorage.setItem(noteKey,JSON.stringify(v));
const getRecent=()=>JSON.parse(localStorage.getItem(recentKey)||"[]");
const setRecent=v=>localStorage.setItem(recentKey,JSON.stringify(v));

const searchEl=document.getElementById("search");
const categoryEl=document.getElementById("category");
const chipsEl=document.getElementById("chips");
const quickFiltersEl=document.getElementById("quickFilters");
const gridEl=document.getElementById("grid");
const favToggle=document.getElementById("favToggle");
const toast=document.getElementById("toast");
const topBtn=document.getElementById("topBtn");

const quickFilters = [
  {id:"all", label:"Tutte"},
  {id:"dolci", label:"Dolci"},
  {id:"pasta", label:"Pasta"},
  {id:"carne", label:"Carne"},
  {id:"pane", label:"Pane"},
  {id:"contorni", label:"Contorni"}
];

function escapeHtml(str){return String(str ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function slug(str){return btoa(unescape(encodeURIComponent(String(str ?? "")))).replace(/[^a-zA-Z0-9]/g,"").slice(0,20);}
function showToast(text){toast.textContent=text;toast.classList.add("show");clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>toast.classList.remove("show"),1500);}

function getRecipeKey(r){
  return String(r?.id || r?.slug || r?.source || r?.title || "");
}

function getRecipePageUrl(recipe){
  if(!recipe?.slug) return "";
  return `/recipe/${encodeURIComponent(recipe.slug)}`;
}

function getRecipeImage(recipe){
  const raw = String(recipe?.image_url || recipe?.image || "").trim();
  return raw || DEFAULT_RECIPE_IMAGE;
}

function isFav(key){return getFavs().includes(key);}
function touchRecent(key){const recent=getRecent().filter(x=>x!==key);recent.unshift(key);setRecent(recent.slice(0,18));}
function toggleFav(key){const favs=getFavs();const next=favs.includes(key)?favs.filter(x=>x!==key):[...favs,key];setFavs(next);render();showToast(next.includes(key)?"Aggiunta ai preferiti":"Tolta dai preferiti");}
async function copyLink(url){try{await navigator.clipboard.writeText(url);showToast("Link copiato");}catch{showToast("Copia non riuscita");}}
function openRecipe(url, recipeKey){
  if(recipeKey) touchRecent(recipeKey);
  if(url) window.open(url,"_blank","noopener");
  renderCounts();
}
function saveNote(key){
  const input=document.getElementById("note-input-"+slug(key));
  if(!input)return;
  const notes=getNotes();
  const val=input.value.trim();
  if(val) notes[key]=val; else delete notes[key];
  setNotes(notes);
  render();
  showToast(val?"Nota salvata":"Nota rimossa");
}
function deleteNote(key){
  const notes=getNotes();
  delete notes[key];
  setNotes(notes);
  render();
  showToast("Nota cancellata");
}
function toggleNote(key){
  const box=document.getElementById("note-box-"+slug(key));
  if(box) box.classList.toggle("show");
}
function toggleSection(id){
  const panel=document.getElementById(id);
  if(panel) panel.classList.toggle("open");
}
function getByUrl(key){
  return state.recipes.find(r=>getRecipeKey(r)===key || r.source===key || r.slug===key);
}

function matchQuick(r){
  const t = (r.title || "").toLowerCase();
  const c = (r.category || "").toLowerCase();
  if(state.quick === "all") return true;
  if(state.quick === "dolci") return c.includes("dolci");
  if(state.quick === "pasta") return c.includes("primi") || /pasta|spaghetti|penne|pici|testaroli|crepes/.test(t);
  if(state.quick === "carne") return /pollo|hamburger|luganega/.test(t) || (c.includes("secondi") && !/uova/.test(t));
  if(state.quick === "pane") return c.includes("pane") || /pizza|bagel|bretzel|puccia|panini|flauti/.test(t);
  if(state.quick === "contorni") return c.includes("contorni") || /peperonata|ceci|insalata/.test(t);
  return true;
}

function filteredBase(){
  const q=state.search.trim().toLowerCase();
  return state.recipes.filter(r=>{
    const recipeKey = getRecipeKey(r);
    return (!q || r._haystack.includes(q))
      && (state.category==="Tutte" || r.category===state.category)
      && (!state.onlyFavs || isFav(recipeKey))
      && matchQuick(r);
  });
}

function currentRecipes(){
  const notes=getNotes();
  if(state.mode==="favorites") return state.recipes.filter(r=>isFav(getRecipeKey(r)));
  if(state.mode==="notes") return state.recipes.filter(r=>notes[getRecipeKey(r)]&&notes[getRecipeKey(r)].trim());
  if(state.mode==="recent") return getRecent().map(getByUrl).filter(Boolean);
  return filteredBase();
}

function renderCounts(){
  document.getElementById("allCount").textContent=state.recipes.length;
  document.getElementById("favCount").textContent=getFavs().length;
  document.getElementById("noteCount").textContent=Object.values(getNotes()).filter(v=>String(v).trim()).length;
  document.getElementById("resultsCount").textContent=currentRecipes().length;
}

function renderChips(){
  const categories=["Tutte", ...new Set(state.recipes.map(r=>r.category).filter(Boolean))];
  categoryEl.innerHTML='<option value="Tutte">Tutte le categorie</option>';
  categories.slice(1).forEach(cat=>{
    const o=document.createElement("option");
    o.value=cat;
    o.textContent=cat;
    categoryEl.appendChild(o);
  });
  categoryEl.value=state.category;
  chipsEl.innerHTML="";
  categories.forEach(cat=>{
    const btn=document.createElement("button");
    btn.className="chip"+(state.category===cat?" active":"");
    btn.textContent=cat;
    btn.onclick=()=>{
      state.category=cat;
      state.mode="all";
      state.onlyFavs=false;
      categoryEl.value=cat;
      updateNav("navAll");
      render();
    };
    chipsEl.appendChild(btn);
  });
}

function renderQuickFilters(){
  quickFiltersEl.innerHTML = "";
  quickFilters.forEach(filter=>{
    const btn = document.createElement("button");
    btn.className = "quick-pill" + (state.quick===filter.id ? " active":"");
    btn.textContent = filter.label;
    btn.onclick = ()=>{
      state.quick = filter.id;
      state.mode="all";
      updateNav("navAll");
      render();
    };
    quickFiltersEl.appendChild(btn);
  });
}

function updateHeaderMeta(items){
  const titleEl=document.getElementById("sectionTitle");
  const infoEl=document.getElementById("activeInfo");
  let title="Archivio ricette";
  let info="Archivio completo";

  if(state.mode==="favorites"){
    title="Preferiti";
    info="Le tue ricette salvate";
  } else if(state.mode==="notes"){
    title="Ricette con note";
    info="Le tue annotazioni personali";
  } else if(state.mode==="recent"){
    title="Recenti";
    info="Le ultime ricette aperte";
  } else {
    const bits=[];
    if(state.quick!=="all"){
      const qf = quickFilters.find(f=>f.id===state.quick);
      if(qf) bits.push(qf.label);
    }
    if(state.category!=="Tutte") bits.push(state.category);
    if(state.search.trim()) bits.push('ricerca: "'+state.search.trim()+'"');
    if(state.onlyFavs) bits.push("solo preferiti");
    info=bits.length?bits.join(" · "):"Archivio completo";
  }

  titleEl.textContent=title;
  infoEl.textContent=info+" · "+items.length+" risultati";
}

function updateNav(activeId){
  document.querySelectorAll(".nav-btn").forEach(btn=>btn.classList.remove("active"));
  document.getElementById(activeId).classList.add("active");
}

function detailsMarkup(r){
  const bits = [
    r.prep_time && ['Preparazione', r.prep_time],
    r.cook_time && ['Cottura', r.cook_time],
    r.rest_time && ['Riposo', r.rest_time],
    r.total_time && ['Totale', r.total_time],
    r.difficulty && ['Difficoltà', r.difficulty],
    r.servings && ['Dosi', r.servings]
  ].filter(Boolean);

  if(!bits.length) return '';

  return `<div class="meta-grid">${bits.map(([k,v])=>`<div class="meta-box"><strong>${escapeHtml(k)}</strong><span>${escapeHtml(v)}</span></div>`).join('')}</div>`;
}

function sectionMarkup(r, field, label, unit){
  const arr = r[field] || [];
  if(!arr.length) return "";
  const recipeKey = getRecipeKey(r);
  const id = field+'-'+slug(recipeKey);
  const list = field === 'steps'
    ? `<ol>${arr.map(i=>`<li>${escapeHtml(i)}</li>`).join("")}</ol>`
    : `<ul>${arr.map(i=>`<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
  return `<div id="${id}" class="section"><div class="section-head" onclick="toggleSectionPublic('${id}')"><div><strong>${label}</strong><br><span>${arr.length} ${unit}</span></div><div class="chev">⌄</div></div>${list}</div>`;
}

function card(r){
  const recipeKey = getRecipeKey(r);
  const notes = getNotes();
  const note = notes[recipeKey] || "";
  const fav = isFav(recipeKey);
  const imageSrc = getRecipeImage(r);
  const recipeUrl = getRecipePageUrl(r);

  return `<article class="card">
    <img class="cover" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(r.title)}" loading="lazy" onerror="this.onerror=null;this.src='${escapeHtml(DEFAULT_RECIPE_IMAGE)}';">
    <div class="card-top">
      <div>
        <h3 class="title">
          ${recipeUrl
            ? `<a href="${escapeHtml(recipeUrl)}" onclick="touchRecentPublic('${encodeURIComponent(recipeKey)}')" style="color:inherit;text-decoration:none;">${escapeHtml(r.title)}</a>`
            : `${escapeHtml(r.title)}`}
        </h3>
        <div class="source">Fonte: ${escapeHtml(r.source || "")}</div>
      </div>
      <button class="fav ${fav?'active':''}" onclick="toggleFavPublic('${encodeURIComponent(recipeKey)}')">${fav?'★':'☆'}</button>
    </div>
    <div class="tags">
      <span class="tag">${escapeHtml(r.category || 'Ricetta')}</span>
      ${r.slug ? `<span class="tag">slug</span>` : ''}
      ${(r.ingredients||[]).length?`<span class="tag">${r.ingredients.length} ingredienti</span>`:''}
      ${(r.steps||[]).length?`<span class="tag">${r.steps.length} passaggi</span>`:''}
      ${note.trim()?`<span class="tag">con nota</span>`:''}
    </div>
    ${detailsMarkup(r)}
    ${sectionMarkup(r,'ingredients','Ingredienti','voci')}
    ${sectionMarkup(r,'steps','Procedimento','passaggi')}
    <div class="actions">
      ${recipeUrl
        ? `<button class="primary" onclick="openRecipePublic('${encodeURIComponent(recipeUrl)}','${encodeURIComponent(recipeKey)}')">Apri ricetta</button>`
        : `<button class="primary" disabled>Ricetta non disponibile</button>`}
      ${r.source
        ? `<button onclick="openRecipePublic('${encodeURIComponent(r.source)}','${encodeURIComponent(recipeKey)}')">Apri fonte</button>`
        : `<button disabled>Nessuna fonte</button>`}
      ${recipeUrl
        ? `<button onclick="copyLinkPublic('${encodeURIComponent(new URL(recipeUrl, window.location.origin).href)}')">Copia link</button>`
        : `<button disabled>Copia link</button>`}
      <button onclick="toggleNotePublic('${encodeURIComponent(recipeKey)}')">${note.trim()?'Modifica nota':'Aggiungi nota'}</button>
    </div>
    <div id="note-preview-${slug(recipeKey)}" class="note-preview" style="${note.trim()?'display:block':'display:none'}">${escapeHtml(note)}</div>
    <div id="note-box-${slug(recipeKey)}" class="note-box">
      <textarea id="note-input-${slug(recipeKey)}" class="note-input" placeholder="Scrivi qui modifiche, idee o promemoria...">${escapeHtml(note)}</textarea>
      <div class="note-actions">
        <button class="primary" onclick="saveNotePublic('${encodeURIComponent(recipeKey)}')">Salva nota</button>
        <button onclick="deleteNotePublic('${encodeURIComponent(recipeKey)}')">Cancella</button>
      </div>
    </div>
  </article>`;
}

function render(){
  renderChips();
  renderQuickFilters();
  renderCounts();

  const items=currentRecipes().sort((a,b)=>a.title.localeCompare(b.title,"it"));
  updateHeaderMeta(items);
  favToggle.classList.toggle("active",state.onlyFavs);
  favToggle.textContent=state.onlyFavs?"Tutti":"Solo preferiti";

  if(!items.length){
    gridEl.innerHTML='<div class="empty">Nessuna ricetta trovata con questi filtri.</div>';
    return;
  }

  gridEl.innerHTML=items.map(card).join("");
}

window.toggleFavPublic=enc=>toggleFav(decodeURIComponent(enc));
window.copyLinkPublic=enc=>copyLink(decodeURIComponent(enc));
window.openRecipePublic=(urlEnc,keyEnc)=>openRecipe(decodeURIComponent(urlEnc), decodeURIComponent(keyEnc));
window.toggleNotePublic=enc=>toggleNote(decodeURIComponent(enc));
window.saveNotePublic=enc=>saveNote(decodeURIComponent(enc));
window.deleteNotePublic=enc=>deleteNote(decodeURIComponent(enc));
window.toggleSectionPublic=id=>toggleSection(id);
window.touchRecentPublic=enc=>touchRecent(decodeURIComponent(enc));

searchEl.addEventListener("input",e=>{
  state.search=e.target.value;
  state.mode="all";
  updateNav("navAll");
  render();
});

categoryEl.addEventListener("change",e=>{
  state.category=e.target.value;
  state.mode="all";
  updateNav("navAll");
  render();
});

favToggle.addEventListener("click",()=>{
  state.onlyFavs=!state.onlyFavs;
  state.mode="all";
  updateNav("navAll");
  render();
});

document.getElementById("navAll").addEventListener("click",()=>{
  state.mode="all";
  state.onlyFavs=false;
  updateNav("navAll");
  render();
});

document.getElementById("navFav").addEventListener("click",()=>{
  state.mode="favorites";
  state.onlyFavs=false;
  updateNav("navFav");
  render();
});

document.getElementById("navNotes").addEventListener("click",()=>{
  state.mode="notes";
  state.onlyFavs=false;
  updateNav("navNotes");
  render();
});

document.getElementById("navRecent").addEventListener("click",()=>{
  state.mode="recent";
  state.onlyFavs=false;
  updateNav("navRecent");
  render();
});

window.addEventListener("scroll",()=>{
  topBtn.classList.toggle("show",window.scrollY>560);
});

topBtn.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));

let deferredPrompt=null;
const installBtn=document.getElementById("installBtn");

window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();
  deferredPrompt=e;
  installBtn.style.display="inline-flex";
});

installBtn.addEventListener("click",async()=>{
  if(!deferredPrompt)return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt=null;
  installBtn.style.display="none";
});

async function boot() {
  let recipes = [];

  try {
    const { data, error } = await window.supabaseClient
      .from('recipes')
      .select('*')
      .eq('status', 'published')
      .order('title', { ascending: true });

    if (error) throw error;

    if (data && data.length) {
      console.log('Ricette caricate da Supabase:', data.length);
      recipes = data;
    } else {
      console.log('Nessuna ricetta pubblicata su Supabase, uso recipes.json');
    }
  } catch (err) {
    console.warn('Supabase non disponibile, uso recipes.json', err);
  }

  if (!recipes.length) {
    try {
      const res = await fetch('./recipes.json');

      if (!res.ok) {
        throw new Error(`Errore fetch recipes.json: ${res.status}`);
      }

      recipes = await res.json();
      console.log('Ricette caricate da recipes.json:', recipes.length);
    } catch (jsonErr) {
      console.error('Impossibile caricare anche recipes.json', jsonErr);
      recipes = [];
    }
  }

  state.recipes = recipes.map(r => ({
    ...r,
    image_url: getRecipeImage(r),
    slug: r.slug || "",
    _haystack: [
      r.title,
      r.category,
      r.source,
      r.slug,
      ...(r.ingredients || []),
      ...(r.steps || [])
    ].join(" ").toLowerCase()
  }));

  render();
}

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js'));
}

boot();