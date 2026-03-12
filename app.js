let recipes = []
let filteredRecipes = []

async function loadRecipes() {

const res = await fetch('./recipes.json?v=6', {
cache: "no-store"
})

recipes = await res.json()

filteredRecipes = recipes

renderRecipes()
createFilters()

}

function renderRecipes() {

const container = document.getElementById("recipes")

container.innerHTML = ""

filteredRecipes.forEach(recipe => {

const card = document.createElement("div")

card.className = "recipe-card"

card.innerHTML = `
<img src="${recipe.image}" alt="${recipe.title}">
<h2>${recipe.title}</h2>
<p>${recipe.category}</p>
`

card.onclick = () => openRecipe(recipe)

container.appendChild(card)

})

}

function openRecipe(recipe) {

let ingredients = recipe.ingredients
.map(i => `<li>${i}</li>`)
.join("")

let steps = recipe.steps
.map(s => `<li>${s}</li>`)
.join("")

document.body.innerHTML = `
<button onclick="location.reload()">← Torna</button>

<h1>${recipe.title}</h1>

<img src="${recipe.image}" style="width:100%;max-width:600px">

<h3>Ingredienti</h3>
<ul>${ingredients}</ul>

<h3>Preparazione</h3>
<ol>${steps}</ol>
`

}

function createFilters(){

const categories = [...new Set(recipes.map(r => r.category))]

const container = document.getElementById("filters")

container.innerHTML = ""

categories.forEach(cat => {

const btn = document.createElement("button")

btn.innerText = cat

btn.onclick = () => {

filteredRecipes = recipes.filter(r => r.category === cat)

renderRecipes()

}

container.appendChild(btn)

})

}

document
.getElementById("search")
.addEventListener("input", e => {

const text = e.target.value.toLowerCase()

filteredRecipes = recipes.filter(r =>
r.title.toLowerCase().includes(text)
)

renderRecipes()

})

loadRecipes()
