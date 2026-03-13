async function requireAuth() {
  const { data, error } = await window.supabaseClient.auth.getSession();

  if (error) {
    console.error('Errore controllo sessione:', error.message);
    window.location.href = 'login.html';
    return null;
  }

  if (!data.session) {
    window.location.href = 'login.html';
    return null;
  }

  return data.session;
}

async function initAuthUi() {
  const session = await requireAuth();
  if (!session) return;

  const sessionInfo = document.getElementById('sessionInfo');
  const logoutBtn = document.getElementById('logoutBtn');

  if (sessionInfo) {
    sessionInfo.textContent = `Accesso effettuato come: ${session.user.email}`;
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const { error } = await window.supabaseClient.auth.signOut();

      if (error) {
        alert('Errore durante il logout: ' + error.message);
        return;
      }

      window.location.href = 'login.html';
    });
  }
}

initAuthUi();

const fields = {
  title: $('title'),
  category: $('category'),
  prep: $('prep'),
  cook: $('cook'),
  rest: $('rest'),
  total: $('total'),
  servings: $('servings'),
  difficulty: $('difficulty'),
  source: $('source'),
  image: $('image'),
  ingredients: $('ingredients'),
  steps: $('steps'),
  output: $('output'),
  preview: $('preview')
};

function normalizeImagePath(value){
  const v = value.trim();
  if(!v) return "";
  if(v.startsWith("images/")) return v;
  return "images/" + v.replace(/^\/+/, "");
}

function toLines(value){
  return value
    .split("\n")
    .map(v => v.trim())
    .filter(Boolean);
}

function getRecipeObject(){
  return {
    title: fields.title.value.trim(),
    category: fields.category.value.trim(),
    prep_time: fields.prep.value.trim(),
    cook_time: fields.cook.value.trim(),
    rest_time: fields.rest.value.trim(),
    total_time: fields.total.value.trim(),
    servings: fields.servings.value.trim(),
    difficulty: fields.difficulty.value.trim(),
    ingredients: toLines(fields.ingredients.value),
    steps: toLines(fields.steps.value),
    source: fields.source.value.trim(),
    image: normalizeImagePath(fields.image.value)
  };
}

function validate(recipe){
  if(!recipe.title) return "Inserisci il titolo.";
  if(!recipe.category) return "Inserisci la categoria.";
  if(!recipe.ingredients.length) return "Inserisci almeno un ingrediente.";
  if(!recipe.steps.length) return "Inserisci almeno un passaggio.";
  if(!recipe.image) return "Inserisci il percorso immagine.";
  return "";
}

function renderPreview(recipe){
  fields.preview.classList.remove("empty");
  fields.preview.innerHTML = `
    <img class="preview-img" src="${recipe.image || ""}" alt="${recipe.title || "Anteprima"}" onerror="this.style.display='none'">
    <h3>${recipe.title || "Titolo ricetta"}</h3>
    <div class="preview-tags">
      <span class="tag">${recipe.category || "Categoria"}</span>
      ${recipe.prep_time ? `<span class="tag">Prep: ${recipe.prep_time}</span>` : ""}
      ${recipe.cook_time ? `<span class="tag">Cottura: ${recipe.cook_time}</span>` : ""}
      ${recipe.servings ? `<span class="tag">${recipe.servings}</span>` : ""}
      ${recipe.difficulty ? `<span class="tag">${recipe.difficulty}</span>` : ""}
    </div>
    <strong>Ingredienti</strong>
    <ul class="preview-list">
      ${recipe.ingredients.slice(0,6).map(i => `<li>${i}</li>`).join("")}
    </ul>
    <strong>Procedimento</strong>
    <ol class="preview-list">
      ${recipe.steps.slice(0,4).map(i => `<li>${i}</li>`).join("")}
    </ol>
  `;
}

function generate(){
  const recipe = getRecipeObject();
  const error = validate(recipe);
  if(error){
    fields.output.value = error;
    fields.preview.classList.add("empty");
    fields.preview.textContent = error;
    return;
  }
  fields.output.value = JSON.stringify(recipe, null, 2);
  renderPreview(recipe);
}

$('generate').addEventListener('click', generate);

$('copy').addEventListener('click', async () => {
  if(!fields.output.value.trim()) generate();
  if(!fields.output.value.trim()) return;
  try{
    await navigator.clipboard.writeText(fields.output.value);
    $('copy').textContent = 'Copiato';
    setTimeout(() => $('copy').textContent = 'Copia JSON', 1200);
  }catch{
    $('copy').textContent = 'Copia fallita';
    setTimeout(() => $('copy').textContent = 'Copia JSON', 1200);
  }
});

$('clear').addEventListener('click', () => {
  Object.values(fields).forEach(el => {
    if(!el || el.tagName === 'SELECT' || el.id === 'output' || el.id === 'preview') return;
    el.value = '';
  });
  fields.category.selectedIndex = 0;
  fields.difficulty.selectedIndex = 0;
  fields.output.value = '';
  fields.preview.className = 'preview-card empty';
  fields.preview.textContent = 'Compila il form per vedere l’anteprima.';
});

[
  fields.title, fields.category, fields.prep, fields.cook, fields.rest, fields.total,
  fields.servings, fields.difficulty, fields.source, fields.image, fields.ingredients, fields.steps
].forEach(el => el.addEventListener('input', generate));
