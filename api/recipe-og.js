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

  const data = JSON.parse(rawText);
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

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: title,
    image: imageUrl,
    description: description,
    author: {
      "@type": "Person",
      name: "Neil"
    },
    publisher: {
      "@type": "Organization",
      name: "Ricettario Neil"
    },
    recipeIngredient: ingredients,
    recipeInstructions: steps.map((s) => ({
      "@type": "HowToStep",
      text: s
    }))
  });

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>

<title>${escapedTitle} | Ricettario Neil</title>
<meta name="description" content="${escapedDescription}"/>
<link rel="canonical" href="${escapedCanonical}"/>

<meta property="og:type" content="article"/>
<meta property="og:site_name" content="Ricettario Neil"/>
<meta property="og:title" content="${escapedTitle}"/>
<meta property="og:description" content="${escapedDescription}"/>
<meta property="og:image" content="${escapedImageUrl}"/>
<meta property="og:url" content="${escapedCanonical}"/>

<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapedTitle}"/>
<meta name="twitter:description" content="${escapedDescription}"/>
<meta name="twitter:image" content="${escapedImageUrl}"/>

<script type="application/ld+json">
${jsonLd}
</script>

<style>
body{margin:0;font-family:Arial;background:#faf7f2;color:#222}
.container{max-width:960px;margin:auto;padding:20px}
.card{background:#fff;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,.08);overflow:hidden}
.hero{width:100%;aspect-ratio:16/9;object-fit:cover}
.content{padding:24px}
h1{margin:0 0 12px;font-size:2rem}
.grid{display:grid;grid-template-columns:1fr;gap:20px}
@media(min-width:860px){.grid{grid-template-columns:320px 1fr}}
.panel{border:1px solid #ece6dc;border-radius:18px;padding:20px}
ul,ol{padding-left:22px}
.footer{margin-top:28px;text-align:center;color:#6b6b6b}
.button{display:inline-block;padding:12px 18px;border-radius:999px;background:#222;color:#fff;text-decoration:none}
</style>
</head>

<body>
<div class="container">
<a href="${homeUrl}">← Torna al ricettario</a>

<article class="card">
<img class="hero" src="${escapedImageUrl}" alt="${escapedTitle}"/>

<div class="content">
<h1>${escapedTitle}</h1>
<p>${escapedDescription}</p>

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

<div class="footer">Slug: ${escapedSlug}</div>

</div>
</article>
</div>
</body>
</html>`;
}