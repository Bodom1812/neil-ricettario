let currentSession = null;
let editingRecipeId = null;
window.__adminRecipes = Array.isArray(window.__adminRecipes) ? window.__adminRecipes : [];

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
  if (!session) return null;

  currentSession = session;

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

  return session;
}

const $ = id => document.getElementById(id);

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
  imageFile: $('imageFile'),
  ingredients: $('ingredients'),
  steps: $('steps'),
  output: $('output'),
  preview: $('preview'),
  saveSupabase: $('saveSupabase'),
  refreshRecipes: $('refreshRecipes'),
  adminRecipesList: $('adminRecipesList')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeImagePath(value) {
  const v = (value || '').trim();
  if (!v) return '';
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (v.startsWith('images/')) return v;
  return 'images/' + v.replace(/^\/+/, '');
}

function toLines(value) {
  return (value || '')
    .split('\n')
    .map(v => v.trim())
    .filter(Boolean);
}

function getRecipeObject() {
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
    image_url: normalizeImagePath(fields.image.value),
    status: 'published'
  };
}

function validate(recipe) {
  if (!recipe.title) return 'Inserisci il titolo.';
  if (!recipe.category) return 'Inserisci la categoria.';
  if (!recipe.ingredients.length) return 'Inserisci almeno un ingrediente.';
  if (!recipe.steps.length) return 'Inserisci almeno un passaggio.';

  const existingRecipe = editingRecipeId
    ? (window.__adminRecipes || []).find(r => r.id === editingRecipeId)
    : null;

  const hasExistingImage = !!(existingRecipe && (existingRecipe.image_url || existingRecipe.image));

  if (!recipe.image_url && !fields.imageFile.files.length && !hasExistingImage) {
    return 'Carica un’immagine oppure inserisci un URL/percorso immagine.';
  }

  return '';
}

function renderPreview(recipe) {
  const previewImage = recipe.image_url || '';
  fields.preview.classList.remove('empty');
  fields.preview.innerHTML = `
    <img class="preview-img" src="${escapeHtml(previewImage)}" alt="${escapeHtml(recipe.title || 'Anteprima')}" onerror="this.style.display='none'">
    <h3>${escapeHtml(recipe.title || 'Titolo ricetta')}</h3>
    <div class="preview-tags">
      <span class="tag">${escapeHtml(recipe.category || 'Categoria')}</span>
      ${recipe.prep_time ? `<span class="tag">Prep: ${escapeHtml(recipe.prep_time)}</span>` : ''}
      ${recipe.cook_time ? `<span class="tag">Cottura: ${escapeHtml(recipe.cook_time)}</span>` : ''}
      ${recipe.servings ? `<span class="tag">${escapeHtml(recipe.servings)}</span>` : ''}
      ${recipe.difficulty ? `<span class="tag">${escapeHtml(recipe.difficulty)}</span>` : ''}
      ${recipe.status ? `<span class="tag">${escapeHtml(recipe.status)}</span>` : ''}
      ${editingRecipeId ? `<span class="tag">modifica</span>` : `<span class="tag">nuova</span>`}
    </div>
    <strong>Ingredienti</strong>
    <ul class="preview-list">
      ${recipe.ingredients.slice(0, 6).map(i => `<li>${escapeHtml(i)}</li>`).join('')}
    </ul>
    <strong>Procedimento</strong>
    <ol class="preview-list">
      ${recipe.steps.slice(0, 4).map(i => `<li>${escapeHtml(i)}</li>`).join('')}
    </ol>
  `;
}

function generate() {
  const recipe = getRecipeObject();
  const error = validate(recipe);

  if (error) {
    fields.output.value = error;
    fields.preview.classList.add('empty');
    fields.preview.textContent = error;
    return;
  }

  fields.output.value = JSON.stringify(recipe, null, 2);
  renderPreview(recipe);
}

async function uploadImageIfNeeded() {
  const file = fields.imageFile.files[0];
  if (!file) {
    return normalizeImagePath(fields.image.value);
  }

  const safeName = file.name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');

  const fileName = `${Date.now()}-${safeName}`;

  const { error } = await window.supabaseClient.storage
    .from('recipe-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error('Upload immagine fallito: ' + error.message);
  }

  const { data } = window.supabaseClient.storage
    .from('recipe-images')
    .getPublicUrl(fileName);

  return data.publicUrl;
}

function updateSaveButton() {
  fields.saveSupabase.textContent = editingRecipeId ? 'Aggiorna ricetta' : 'Salva su Supabase';
}

function clearForm(resetOutput = true) {
  [
    fields.title, fields.prep, fields.cook, fields.rest, fields.total,
    fields.servings, fields.source, fields.image, fields.ingredients, fields.steps
  ].forEach(el => {
    if (el) el.value = '';
  });

  if (fields.imageFile) fields.imageFile.value = '';
  if (fields.category) fields.category.selectedIndex = 0;
  if (fields.difficulty) fields.difficulty.selectedIndex = 0;

  if (resetOutput && fields.output) fields.output.value = '';

  if (fields.preview) {
    fields.preview.className = 'preview-card empty';
    fields.preview.textContent = 'Compila il form per vedere l’anteprima.';
  }

  editingRecipeId = null;
  updateSaveButton();
}

function fillFormForEdit(recipe) {
  editingRecipeId = recipe.id || null;

  fields.title.value = recipe.title || '';
  fields.category.value = recipe.category || 'Dolci';
  fields.prep.value = recipe.prep_time || '';
  fields.cook.value = recipe.cook_time || '';
  fields.rest.value = recipe.rest_time || '';
  fields.total.value = recipe.total_time || '';
  fields.servings.value = recipe.servings || '';
  fields.difficulty.value = recipe.difficulty || 'Molto facile';
  fields.source.value = recipe.source || '';
  fields.image.value = recipe.image_url || recipe.image || '';
  fields.ingredients.value = Array.isArray(recipe.ingredients) ? recipe.ingredients.join('\n') : '';
  fields.steps.value = Array.isArray(recipe.steps) ? recipe.steps.join('\n') : '';

  if (fields.imageFile) fields.imageFile.value = '';

  updateSaveButton();
  generate();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  console.log('Modalità modifica attiva. ID ricetta:', editingRecipeId);
}

function recipeRowMarkup(recipe) {
  const imageSrc = recipe.image_url || recipe.image || '';

  return `
    <article style="display:grid;grid-template-columns:120px 1fr auto;gap:14px;align-items:center;border:1px solid var(--line);border-radius:20px;background:rgba(255,255,255,.05);padding:14px;">
      <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(recipe.title || '')}" style="width:120px;height:80px;object-fit:cover;border-radius:14px;border:1px solid var(--line);background:#131a2d;" onerror="this.style.display='none'">
      <div style="min-width:0;">
        <h3 style="margin:0 0 6px;font-size:18px;">${escapeHtml(recipe.title || '')}</h3>
        <div style="font-size:13px;color:var(--muted);line-height:1.5;">
          <div><strong>Categoria:</strong> ${escapeHtml(recipe.category || '-')}</div>
          <div><strong>Fonte:</strong> ${escapeHtml(recipe.source || '-')}</div>
          <div><strong>Status:</strong> ${escapeHtml(recipe.status || '-')}</div>
        </div>
      </div>
      <div style="display:grid;gap:8px;">
        <button type="button" onclick="editRecipePublic('${recipe.id}')">Modifica</button>
        <button type="button" onclick="deleteRecipePublic('${recipe.id}', ${JSON.stringify(recipe.title || '')})">Elimina</button>
      </div>
    </article>
  `;
}

function sortRecipesForAdmin(recipes) {
  return [...recipes].sort((a, b) => {
    const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
    const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
    return bDate - aDate;
  });
}

function renderAdminRecipesList(recipes) {
  if (!fields.adminRecipesList) return;

  if (!recipes || !recipes.length) {
    fields.adminRecipesList.innerHTML = '<div class="preview-card empty">Nessuna ricetta presente.</div>';
    return;
  }

  fields.adminRecipesList.innerHTML = sortRecipesForAdmin(recipes).map(recipeRowMarkup).join('');
}

async function loadAdminRecipes() {
  if (!fields.adminRecipesList) return;

  fields.adminRecipesList.innerHTML = 'Caricamento ricette...';

  try {
    const { data, error } = await window.supabaseClient
      .from('recipes')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    window.__adminRecipes = Array.isArray(data) ? data : [];
    renderAdminRecipesList(window.__adminRecipes);
    console.log('Ricette admin caricate:', window.__adminRecipes.length);
  } catch (err) {
    console.error('Errore loadAdminRecipes:', err);
    fields.adminRecipesList.innerHTML = `<div class="preview-card empty">Errore nel caricamento ricette: ${escapeHtml(err.message)}</div>`;
  }
}

async function saveToSupabase() {
  const recipe = getRecipeObject();
  const errorMsg = validate(recipe);

  if (errorMsg) {
    alert(errorMsg);
    return;
  }

  const session = await requireAuth();
  if (!session) return;

  const btn = fields.saveSupabase;
  const originalEditingId = editingRecipeId;

  try {
    btn.disabled = true;
    btn.textContent = originalEditingId ? 'Aggiornamento...' : 'Salvataggio...';

    let imageUrl = recipe.image_url;

    if (fields.imageFile.files[0]) {
      imageUrl = await uploadImageIfNeeded();
    } else if (originalEditingId) {
      const existingRecipe = (window.__adminRecipes || []).find(r => r.id === originalEditingId);
      if (!imageUrl && existingRecipe?.image_url) {
        imageUrl = existingRecipe.image_url;
      }
    }

    const payload = {
      title: recipe.title,
      category: recipe.category,
      image_url: imageUrl,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      rest_time: recipe.rest_time,
      total_time: recipe.total_time,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      source: recipe.source,
      status: recipe.status
    };

    let result;

    if (originalEditingId) {
      result = await window.supabaseClient
        .from('recipes')
        .update(payload)
        .eq('id', originalEditingId)
        .select()
        .single();
    } else {
      result = await window.supabaseClient
        .from('recipes')
        .insert([
          {
            ...payload,
            created_by: session.user.id
          }
        ])
        .select()
        .single();
    }

    if (result.error) {
      throw new Error((originalEditingId ? 'Aggiornamento ricetta fallito: ' : 'Salvataggio ricetta fallito: ') + result.error.message);
    }

    console.log('Ricetta salvata/aggiornata:', result.data);

    await loadAdminRecipes();
    clearForm(false);
    fields.output.value = JSON.stringify(result.data, null, 2);

    alert(originalEditingId ? 'Ricetta aggiornata con successo.' : 'Ricetta salvata su Supabase con successo.');
  } catch (err) {
    console.error('Errore saveToSupabase:', err);
    alert(err.message || 'Errore durante il salvataggio.');
  } finally {
    btn.disabled = false;
    updateSaveButton();
  }
}

async function deleteRecipe(recipeId, recipeTitle) {
  const session = await requireAuth();
  if (!session) return;

  const confirmDelete = confirm(`Vuoi davvero eliminare la ricetta "${recipeTitle}"?`);
  if (!confirmDelete) return;

  try {
    const { data, error } = await window.supabaseClient
      .from('recipes')
      .delete()
      .eq('id', recipeId)
      .select();

    if (error) {
      throw new Error('Eliminazione fallita: ' + error.message);
    }

    if (!data || !data.length) {
      throw new Error('Nessuna ricetta eliminata. Controlla la policy DELETE in Supabase.');
    }

    if (editingRecipeId === recipeId) {
      clearForm();
    }

    await loadAdminRecipes();
    alert('Ricetta eliminata.');
  } catch (err) {
    console.error('Errore deleteRecipe:', err);
    alert(err.message || 'Errore durante l’eliminazione.');
  }
}

function editRecipeById(recipeId) {
  const recipe = (window.__adminRecipes || []).find(r => r.id === recipeId);

  if (!recipe) {
    alert('Ricetta non trovata.');
    return;
  }

  fillFormForEdit(recipe);
}

$('generate').addEventListener('click', generate);
$('saveSupabase').addEventListener('click', saveToSupabase);

$('copy').addEventListener('click', async () => {
  if (!fields.output.value.trim()) generate();
  if (!fields.output.value.trim()) return;

  try {
    await navigator.clipboard.writeText(fields.output.value);
    $('copy').textContent = 'Copiato';
    setTimeout(() => {
      $('copy').textContent = 'Copia JSON';
    }, 1200);
  } catch {
    $('copy').textContent = 'Copia fallita';
    setTimeout(() => {
      $('copy').textContent = 'Copia JSON';
    }, 1200);
  }
});

$('clear').addEventListener('click', () => {
  clearForm();
});

if (fields.refreshRecipes) {
  fields.refreshRecipes.addEventListener('click', loadAdminRecipes);
}

[
  fields.title,
  fields.category,
  fields.prep,
  fields.cook,
  fields.rest,
  fields.total,
  fields.servings,
  fields.difficulty,
  fields.source,
  fields.image,
  fields.ingredients,
  fields.steps
].forEach(el => {
  if (el) {
    el.addEventListener('input', generate);
  }
});

if (fields.imageFile) {
  fields.imageFile.addEventListener('change', () => {
    const file = fields.imageFile.files[0];

    if (file) {
      fields.image.value = '';
      fields.preview.classList.remove('empty');
      fields.preview.innerHTML = `
        <img class="preview-img" src="${URL.createObjectURL(file)}" alt="Anteprima immagine">
        <h3>${escapeHtml(fields.title.value.trim() || 'Titolo ricetta')}</h3>
        <p>Immagine selezionata: ${escapeHtml(file.name)}</p>
      `;
    } else {
      generate();
    }
  });
}

window.editRecipePublic = editRecipeById;
window.deleteRecipePublic = deleteRecipe;

initAuthUi().then(async () => {
  updateSaveButton();
  generate();
  await loadAdminRecipes();
});
