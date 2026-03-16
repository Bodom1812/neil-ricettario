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

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res
        .status(500)
        .send(buildErrorPage("Configurazione server incompleta"));
    }

    const recipe = await fetchRecipeBySlug({
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
      slug,
    });

    if (!recipe) {
      return res.status(404).send(buildNotFoundPage(slug, SITE_URL));
    }

    const title = safeText(recipe.title || "Ricetta | Ricettario Neil");
    const description = safeText(
      recipe.description || "Scopri questa ricetta su Ricettario Neil."
    );
    const imageUrl = safeUrl(
      recipe.image_url || `${SITE_URL}/icons/icon-512.png`,
      SITE_URL
    );
    const canonicalUrl = `${SITE_URL}/recipe/${encodeURIComponent(slug)}`;
    const clientRecipeUrl = `${SITE_URL}/recipe.html?slug=${encodeURIComponent(
      slug
    )}`;

    const html = buildRecipePage({
      title,
      description,
      imageUrl,
      canonicalUrl,
      clientRecipeUrl,
      slug,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    return res.status(200).send(html);
  } catch (error) {
    console.error("recipe-og error:", error);
    return res
      .status(500)
      .send(buildErrorPage("Errore durante il caricamento della ricetta"));
  }
}

async function fetchRecipeBySlug({ supabaseUrl, supabaseAnonKey, slug }) {
  const url =
    `${supabaseUrl}/rest/v1/recipes` +
    `?select=id,title,slug,description,image_url,status` +
    `&slug=eq.${encodeURIComponent(slug)}` +
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

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase REST error ${response.status}: ${body}`);
  }

  const data = await response.json();
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

function buildRecipePage({
  title,
  description,
  imageUrl,
  canonicalUrl,
  clientRecipeUrl,
  slug,
}) {
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const escapedImageUrl = escapeHtml(imageUrl);
  const escapedCanonical = escapeHtml(canonicalUrl);
  const escapedClientUrl = escapeHtml(clientRecipeUrl);
  const escapedSlug = escapeHtml(slug);

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

  <meta http-equiv="refresh" content="0; url=${escapedClientUrl}" />

  <style>
    :root {
      color-scheme: light;
    }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: #faf7f2;
      color: #222;
    }
    .wrap {
      max-width: 760px;
      margin: 0 auto;
      padding: 32px 20px 60px;
    }
    .card {
      background: #fff;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.08);
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
    h1 {
      margin: 0 0 12px;
      font-size: 2rem;
      line-height: 1.15;
    }
    p {
      margin: 0 0 16px;
      font-size: 1rem;
      line-height: 1.6;
    }
    a.button {
      display: inline-block;
      padding: 12px 18px;
      border-radius: 999px;
      text-decoration: none;
      background: #222;
      color: #fff;
      font-weight: 600;
    }
    .small {
      margin-top: 14px;
      font-size: 0.92rem;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <img class="hero" src="${escapedImageUrl}" alt="${escapedTitle}" />
      <div class="content">
        <h1>${escapedTitle}</h1>
        <p>${escapedDescription}</p>
        <a class="button" href="${escapedClientUrl}">Apri la ricetta</a>
        <p class="small">Slug: ${escapedSlug}</p>
      </div>
    </div>
  </div>

  <script>
    window.location.replace(${JSON.stringify(clientRecipeUrl)});
  </script>
</body>
</html>`;
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