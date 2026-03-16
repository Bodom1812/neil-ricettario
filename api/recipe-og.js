export default async function handler(req, res) {
  try {
    const { slug } = req.query || {};

    if (!slug || typeof slug !== "string") {
      return res.status(400).send(buildErrorPage("Slug mancante"));
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    const SITE_URL =
      process.env.SITE_URL || "https://neil-ricettario.vercel.app";

    if (!SUPABASE_URL) {
      return res
        .status(500)
        .send(buildErrorPage("Manca la variabile SUPABASE_URL"));
    }

    if (!SUPABASE_ANON_KEY) {
      return res
        .status(500)
        .send(buildErrorPage("Manca la variabile SUPABASE_ANON_KEY"));
    }

    const recipe = await fetchRecipeBySlug({
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
      slug,
    });

    if (!recipe) {
      return res.status(404).send(buildNotFoundPage(slug, SITE_URL));
    }

    const title = safeText(recipe.title || "Ricetta");
    const description =
      extractDescription(recipe) || buildDescriptionFromTitle(title);
    const imageUrl = safeUrl(
      recipe.image_url || `${SITE_URL}/icons/icon-512.png`,
      SITE_URL
    );
    const canonicalUrl = `${SITE_URL}/recipe/${encodeURIComponent(slug)}`;

    const ingredients = normalizeList(recipe.ingredients);
    const steps = normalizeList(recipe.steps);

    const html = buildRecipePage({
      title,
      description,
      imageUrl,
      canonicalUrl,
      ingredients,
      steps,
      slug,
      siteUrl: SITE_URL,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    return res.status(200).send(html);
  } catch (error) {
    console.error("recipe-og error:", error);

    const message =
      error && error.message
        ? `Errore durante il caricamento della ricetta: ${error.message}`
        : "Errore durante il caricamento della ricetta";

    return res.status(500).send(buildErrorPage(message));
  }
}

async function fetchRecipeBySlug({ supabaseUrl, supabaseAnonKey, slug }) {
  const cleanedBaseUrl = String(supabaseUrl).replace(/\/+$/, "");
  const encodedSlug = encodeURIComponent(slug);

  const url =
    `${cleanedBaseUrl}/rest/v1/recipes` +
    `?select=id,title,slug,image_url,status,ingredients,steps` +
    `&slug=eq.${encodedSlug}` +
    `&status=eq.published` +
    `&limit=1`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Accept: "application/json",
    },
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase REST error ${response.status}: ${rawText}`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (parseError) {
    throw new Error(`Risposta Supabase non valida: ${rawText}`);
  }

  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

function buildRecipePage({
  title,
  description,
  imageUrl,
  canonicalUrl,
  ingredients,
  steps,
  slug,
  siteUrl,
}) {
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const escapedImageUrl = escapeHtml(imageUrl);
  const escapedCanonical = escapeHtml(canonicalUrl);
  const escapedSlug = escapeHtml(slug);
  const ingredientsHtml = buildListHtml(ingredients, false);
  const stepsHtml = buildListHtml(steps, true);
  const homeUrl = escapeHtml(siteUrl || "/");

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${escapedTitle} | Ricettario Neil</title>
  <meta name="description" content="${escapedDescription}" />
  <link rel="canonical" href="${escapedCanonical}" />

  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Ricettario Neil" />
  <meta property="og:title" content="${escapedTitle}" />
  <meta property="og:description" content="${escapedDescription}" />
  <meta property="og:image" content="${escapedImageUrl}" />
  <meta property="og:url" content="${escapedCanonical}" />
  <meta property="og:locale" content="it_IT" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapedTitle}" />
  <meta name="twitter:description" content="${escapedDescription}" />
  <meta name="twitter:image" content="${escapedImageUrl}" />

  <style>
    :root {
      --bg: #faf7f2;
      --surface: #ffffff;
      --text: #222222;
      --muted: #6b6b6b;
      --line: #ece6dc;
      --accent: #222222;
      --shadow: 0 10px 30px rgba(0,0,0,0.08);
      --radius: 20px;
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }

    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 20px 16px 56px;
    }

    .topbar {
      margin-bottom: 20px;
    }

    .toplink {
      color: var(--muted);
      text-decoration: none;
      font-size: 0.95rem;
    }

    .toplink:hover {
      text-decoration: underline;
    }

    .card {
      background: var(--surface);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .hero {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      display: block;
      background: #eee;
    }

    .content {
      padding: 24px;
    }

    .eyebrow {
      display: inline-block;
      margin-bottom: 12px;
      font-size: 0.85rem;
      color: var(--muted);
      background: #f4efe7;
      border-radius: 999px;
      padding: 6px 10px;
    }

    h1 {
      margin: 0 0 12px;
      font-size: clamp(2rem, 4vw, 3rem);
      line-height: 1.1;
    }

    .description {
      margin: 0 0 24px;
      font-size: 1.05rem;
      color: #444;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
      margin-top: 8px;
    }

    @media (min-width: 860px) {
      .grid {
        grid-template-columns: minmax(260px, 320px) 1fr;
        align-items: start;
      }
    }

    .panel {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 20px;
    }

    .panel h2 {
      margin: 0 0 14px;
      font-size: 1.25rem;
      line-height: 1.2;
    }

    ul.ingredients,
    ol.steps {
      margin: 0;
      padding-left: 22px;
    }

    ul.ingredients li,
    ol.steps li {
      margin-bottom: 10px;
    }

    .empty {
      margin: 0;
      color: var(--muted);
    }

    .footer {
      margin-top: 28px;
      color: var(--muted);
      font-size: 0.92rem;
      text-align: center;
    }

    .actions {
      margin-top: 24px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .button {
      display: inline-block;
      padding: 12px 18px;
      border-radius: 999px;
      text-decoration: none;
      background: var(--accent);
      color: #fff;
      font-weight: 600;
    }

    .button.secondary {
      background: #eee6da;
      color: #222;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="topbar">
      <a class="toplink" href="${homeUrl}">← Torna al ricettario</a>
    </div>

    <article class="card">
      <img class="hero" src="${escapedImageUrl}" alt="${escapedTitle}" />
      <div class="content">
        <div class="eyebrow">Ricettario Neil</div>
        <h1>${escapedTitle}</h1>
        <p class="description">${escapedDescription}</p>

        <div class="grid">
          <section class="panel">
            <h2>Ingredienti</h2>
            ${ingredientsHtml}
          </section>

          <section class="panel">
            <h2>Procedimento</h2>
            ${stepsHtml}
          </section>
        </div>

        <div class="actions">
          <a class="button" href="${homeUrl}">Vai alla home</a>
          <a class="button secondary" href="${escapedCanonical}">Link ricetta</a>
        </div>

        <div class="footer">Slug: ${escapedSlug}</div>
      </div>
    </article>
  </div>
</body>
</html>`;
}

function extractDescription(recipe) {
  const steps = normalizeList(recipe.steps);
  if (steps.length > 0) {
    const firstStep = safeText(steps[0]);
    if (firstStep.length <= 160) {
      return firstStep;
    }
    return firstStep.slice(0, 157).trim() + "...";
  }

  const ingredients = normalizeList(recipe.ingredients);
  if (ingredients.length > 0) {
    const firstIngredients = ingredients.slice(0, 4).join(", ");
    const text = `Ingredienti: ${firstIngredients}`;
    return text.length <= 160 ? text : text.slice(0, 157).trim() + "...";
  }

  return "";
}

function buildDescriptionFromTitle(title) {
  return `Scopri la ricetta ${safeText(title || "del giorno")} su Ricettario Neil.`;
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => safeText(extractText(item)))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => safeText(extractText(item)))
          .filter(Boolean);
      }
    } catch (error) {
      // continua come testo normale
    }

    return trimmed
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*[-•\d.)]+\s*/, ""))
      .map((line) => safeText(line))
      .filter(Boolean);
  }

  if (value && typeof value === "object") {
    const text = safeText(extractText(value));
    return text ? [text] : [];
  }

  return [];
}

function extractText(item) {
  if (typeof item === "string") return item;
  if (typeof item === "number") return String(item);
  if (!item || typeof item !== "object") return "";

  if (typeof item.text === "string") return item.text;
  if (typeof item.value === "string") return item.value;
  if (typeof item.name === "string") return item.name;
  if (typeof item.step === "string") return item.step;
  if (typeof item.description === "string") return item.description;

  return JSON.stringify(item);
}

function buildListHtml(items, ordered) {
  if (!Array.isArray(items) || items.length === 0) {
    return `<p class="empty">${
      ordered
        ? "Procedimento non disponibile."
        : "Ingredienti non disponibili."
    }</p>`;
  }

  const tag = ordered ? "ol" : "ul";
  const className = ordered ? "steps" : "ingredients";
  const itemsHtml = items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return `<${tag} class="${className}">${itemsHtml}</${tag}>`;
}

function buildNotFoundPage(slug, siteUrl) {
  const safeSlug = escapeHtml(slug || "");
  const homeUrl = escapeHtml(siteUrl || "/");

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ricetta non trovata | Ricettario Neil</title>
  <meta name="description" content="La ricetta richiesta non è disponibile." />
</head>
<body style="font-family: Arial, Helvetica, sans-serif; margin: 0; background: #faf7f2; color: #222;">
  <div style="max-width: 720px; margin: 0 auto; padding: 40px 20px;">
    <h1>Ricetta non trovata</h1>
    <p>Non ho trovato nessuna ricetta pubblicata con slug: <strong>${safeSlug}</strong></p>
    <p><a href="${homeUrl}">Torna alla home</a></p>
  </div>
</body>
</html>`;
}

function buildErrorPage(message) {
  const safeMessage = escapeHtml(message || "Errore");

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Errore | Ricettario Neil</title>
</head>
<body style="font-family: Arial, Helvetica, sans-serif; margin: 0; background: #faf7f2; color: #222;">
  <div style="max-width: 720px; margin: 0 auto; padding: 40px 20px;">
    <h1>Errore</h1>
    <p>${safeMessage}</p>
  </div>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function safeUrl(value, siteUrl) {
  const raw = String(value || "").trim();

  if (!raw) return `${siteUrl}/icons/icon-512.png`;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${siteUrl}${raw}`;

  return `${siteUrl}/${raw}`;
}