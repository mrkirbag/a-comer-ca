import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const PRODUCTS_PATH = path.join(ROOT, "src", "data", "products.json");
const IMG_CACHE_DIR = path.join(ROOT, "scripts", ".temp-img-cache");
const HTML_TEMP_PATH = path.join(ROOT, "scripts", ".catalog-print-temp.html");
const OUTPUT_PUBLIC_PDF = path.join(PUBLIC_DIR, "catalogo-a-comer.pdf");
const OUTPUT_ROOT_PDF = path.join(ROOT, "catalogo-a-comer.pdf");

// 1. Ensure optimized JPEG images exist so the resulting PDF is lightweight (~5 MB instead of 94 MB)
console.log("Preparing optimized images for PDF...");
execFileSync(
    "python",
    [
        "-c",
        `
import json, os
from PIL import Image

with open('src/data/products.json', 'r', encoding='utf-8') as f:
    products = json.load(f)

out_dir = 'scripts/.temp-img-cache'
os.makedirs(out_dir, exist_ok=True)

bg_color = (251, 244, 229) # #fbf4e5 soft cream matching card-photo-wrap
unique_imgs = set(p['image'] for p in products if p.get('image'))

for rel in unique_imgs:
    src = os.path.join('public', rel.lstrip('/'))
    key = rel.lstrip('/').replace('/', '__').replace('.webp', '.jpg').replace('.png', '.jpg')
    dst = os.path.join(out_dir, key)
    if not os.path.exists(dst) or os.path.getmtime(src) > os.path.getmtime(dst):
        with Image.open(src) as im:
            im = im.convert('RGBA')
            im.thumbnail((420, 420), Image.Resampling.LANCZOS)
            bg = Image.new('RGB', im.size, bg_color)
            bg.paste(im, mask=im.split()[3])
            bg.save(dst, 'JPEG', quality=88, optimize=True)

logo_dst = os.path.join(out_dir, 'brand__logo.jpg')
if not os.path.exists(logo_dst):
    with Image.open('public/brand/logo.webp') as logo:
        logo = logo.convert('RGBA')
        logo.thumbnail((900, 350), Image.Resampling.LANCZOS)
        bg = Image.new('RGB', logo.size, (255, 255, 255))
        bg.paste(logo, mask=logo.split()[3])
        bg.save(logo_dst, 'JPEG', quality=95, optimize=True)
`,
    ],
    { stdio: "inherit" }
);

const categories = [
    { id: "equipos", name: "Maquinarias y Equipos", badge: "Maquinarias" },
    { id: "utensilios", name: "Utensilios", badge: "Utensilios" },
    { id: "menajes", name: "Menajes", badge: "Menajes" },
    { id: "insumos", name: "Insumos y Materia Prima", badge: "Insumos" },
    { id: "desechables", name: "Desechables", badge: "Desechables" },
    { id: "limpieza", name: "Mantenimiento y Limpieza", badge: "Limpieza" },
];

const categoryMap = new Map(categories.map((c, idx) => [c.id, { ...c, order: idx }]));

const rawProducts = JSON.parse(fs.readFileSync(PRODUCTS_PATH, "utf-8"));

// Sort products by official category order while preserving internal catalog order
const products = [...rawProducts].sort((a, b) => {
    const orderA = categoryMap.get(a.category)?.order ?? 99;
    const orderB = categoryMap.get(b.category)?.order ?? 99;
    return orderA - orderB;
});

const ITEMS_PER_PAGE = 12; // 2 columns x 6 rows = 12 products per page -> 256 / 12 = 22 pages (<= 25 pages)
const pages = [];
for (let i = 0; i < products.length; i += ITEMS_PER_PAGE) {
    pages.push(products.slice(i, i + ITEMS_PER_PAGE));
}

function toFileUrl(relPublicPath) {
    const cleanRel = relPublicPath.replace(/^\/+/, "");
    const fullPath = path.join(PUBLIC_DIR, cleanRel);
    return pathToFileURL(fullPath).href;
}

function toCachedImgUrl(relPublicPath) {
    const key = relPublicPath
        .replace(/^\/+/, "")
        .replace(/\//g, "__")
        .replace(/\.webp$/i, ".jpg")
        .replace(/\.png$/i, ".jpg");
    const cachedPath = path.join(IMG_CACHE_DIR, key);
    if (fs.existsSync(cachedPath)) {
        return pathToFileURL(cachedPath).href;
    }
    return toFileUrl(relPublicPath);
}

function escapeHtml(str = "") {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

const logoUrl = pathToFileURL(path.join(IMG_CACHE_DIR, "brand__logo.jpg")).href;
const fontLatoReg = toFileUrl("/fonts/Lato-Regular.woff2");
const fontMontReg = toFileUrl("/fonts/Montserrat-Regular.woff2");
const fontMontSemi = toFileUrl("/fonts/Montserrat-SemiBold.woff2");
const fontMontBold = toFileUrl("/fonts/Montserrat-Bold.woff2");
const fontMontExtra = toFileUrl("/fonts/Montserrat-ExtraBold.woff2");
const fontOleo = toFileUrl("/fonts/OleoScript-Regular.woff2");

function renderPresentations(product) {
    const basePres = (product.presentation || "").trim();
    const listPres = Array.isArray(product.presentations)
        ? product.presentations.map((s) => s.trim()).filter(Boolean)
        : [];

    if (listPres.length > 1) {
        const pills = listPres
            .map((p) => `<span class="pres-pill">${escapeHtml(p)}</span>`)
            .join("");
        return `
            <div class="pres-box pres-box--pills">
                <span class="pres-label">Presentaciones:</span>
                <div class="pres-pills">${pills}</div>
            </div>
        `;
    }

    const displayPres = basePres || (listPres[0] ?? "Estándar");
    return `
        <div class="pres-box">
            <span class="pres-label">Presentación:</span>
            <span class="pres-main">${escapeHtml(displayPres)}</span>
        </div>
    `;
}

function renderExtras(product) {
    let html = "";
    if (Array.isArray(product.colors) && product.colors.length > 0) {
        const swatches = product.colors
            .map(
                (c) =>
                    `<span class="color-chip"><span class="color-dot" style="background:${escapeHtml(c.hex)}"></span>${escapeHtml(c.name)}</span>`
            )
            .join("");
        html += `<div class="extras-row"><span class="extras-label">Tonos (${product.colors.length}):</span> ${swatches}</div>`;
    }
    if (Array.isArray(product.flavors) && product.flavors.length > 0) {
        html += `<div class="extras-row"><span class="extras-label">Sabores (${product.flavors.length}):</span> <span class="extras-text">${escapeHtml(product.flavors.join(", "))}</span></div>`;
    }
    return html;
}

function renderCard(product, globalIndex) {
    const catInfo = categoryMap.get(product.category);
    const catLabel = [catInfo?.badge || product.category, product.subCategory, product.subSubCategory]
        .filter(Boolean)
        .join(" › ");

    const imgUrl = product.image ? toCachedImgUrl(product.image) : "";
    const features = Array.isArray(product.features) ? product.features : [];
    const totalChars =
        (product.name?.length || 0) +
        features.join(" ").length +
        (product.presentations ? product.presentations.join(" ").length : 0) +
        (product.colors ? product.colors.length * 12 : 0) +
        (product.flavors ? product.flavors.join(", ").length : 0);

    const compactClass = totalChars > 360 ? "card--dense" : totalChars > 260 ? "card--medium" : "";

    const featuresHtml = features.map((f) => `<li>${escapeHtml(f)}</li>`).join("");

    return `
        <article class="product-card ${compactClass}">
            <div class="card-photo-wrap">
                <span class="card-index">#${String(globalIndex + 1).padStart(3, "0")}</span>
                ${
                    imgUrl
                        ? `<img src="${imgUrl}" alt="${escapeHtml(product.name)}" class="card-photo" />`
                        : `<div class="card-no-photo">Sin foto</div>`
                }
            </div>
            <div class="card-body">
                <div class="card-meta">
                    <span class="brand-badge">Marca: ${escapeHtml(product.brand || "A-Comer")}</span>
                    <span class="cat-tag">${escapeHtml(catLabel)}</span>
                </div>
                <h2 class="card-title">${escapeHtml(product.name)}</h2>
                ${renderPresentations(product)}
                <div class="features-wrap">
                    <span class="features-title">Características:</span>
                    <ul class="features-list">
                        ${featuresHtml}
                    </ul>
                </div>
                ${renderExtras(product)}
            </div>
        </article>
    `;
}

const totalPages = pages.length;

const pagesHtml = pages
    .map((pageProducts, pageIdx) => {
        const pageNum = pageIdx + 1;
        const pageCats = Array.from(
            new Set(pageProducts.map((p) => categoryMap.get(p.category)?.name || p.category))
        );
        const pageCatsLabel = pageCats.join(" • ");
        const pageCatsShort = Array.from(
            new Set(pageProducts.map((p) => categoryMap.get(p.category)?.badge || p.category))
        ).join(" • ");

        const cardsHtml = pageProducts
            .map((p, idx) => renderCard(p, pageIdx * ITEMS_PER_PAGE + idx))
            .join("\n");

        const isLastPage = pageNum === totalPages;
        const closingBannerHtml = isLastPage
            ? `
            <div class="closing-banner">
                <div class="closing-left">
                    <img src="${logoUrl}" alt="A-Comer C.A." class="closing-logo" />
                    <div>
                        <div class="closing-kicker">Más de 43 años siendo el aliado gastronómico del occidente venezolano</div>
                        <h3 class="closing-heading">Andina de Comercialización C.A. — A-Comer C.A.</h3>
                        <p class="closing-desc">
                            Solicita tu cotización personalizada por WhatsApp o visítanos en nuestra sede en San Cristóbal.
                            Brindamos asesoría técnica, fichas de producto y atención post-venta garantizada.
                        </p>
                    </div>
                </div>
                <div class="closing-right">
                    <div class="closing-contact-item"><strong>Ventas / WhatsApp:</strong> 0424-7978932</div>
                    <div class="closing-contact-item"><strong>Administración:</strong> 0424-7605859</div>
                    <div class="closing-contact-item"><strong>Dirección:</strong> Calle 5, N° 8-80, Sector La Concordia, San Cristóbal, Táchira</div>
                    <div class="closing-contact-item"><strong>Horario:</strong> Lunes a Viernes 8:00 AM - 5:00 PM</div>
                    <div class="closing-contact-item"><strong>Web / Instagram:</strong> a-comerca.com • @acomer.ca</div>
                </div>
            </div>
        `
            : "";

        return `
        <section class="page" id="page-${pageNum}">
            <!-- MEMBRETE OFICIAL EN CADA HOJA -->
            <header class="letterhead">
                <div class="lh-brand">
                    <img src="${logoUrl}" alt="Logo A-Comer C.A." class="lh-logo" />
                </div>
                <div class="lh-center">
                    <div class="lh-company-row">
                        <span class="lh-company">ANDINA DE COMERCIALIZACIÓN C.A.</span>
                        <span class="lh-rif">RIF: J-09010600-6</span>
                    </div>
                    <div class="lh-title">CATÁLOGO GENERAL DE PRODUCTOS E INSUMOS GASTRONÓMICOS</div>
                    <div class="lh-contact">
                        Calle 5, N° 8-80, La Concordia, San Cristóbal, Táchira &bull;
                        Ventas: 0424-7978932 / Admón: 0424-7605859 &bull; a-comerca.com
                    </div>
                </div>
                <div class="lh-right">
                    <div class="lh-page-pill">Página ${pageNum} de ${totalPages}</div>
                    <div class="lh-cat-pill">${escapeHtml(pageCats.length > 1 ? pageCatsShort : pageCatsLabel)}</div>
                </div>
            </header>
            <div class="lh-divider">
                <span class="lh-line-burgundy"></span>
                <span class="lh-line-copper"></span>
                <span class="lh-line-olive"></span>
            </div>

            <!-- GRILLA DE PRODUCTOS -->
            <main class="products-grid ${isLastPage ? "products-grid--last" : ""}">
                ${cardsHtml}
            </main>

            ${closingBannerHtml}

            <!-- PIE DE PÁGINA -->
            <footer class="page-footer">
                <span><strong>A-Comer C.A.</strong> — Andina de Comercialización C.A. • Todos los productos del catálogo (${products.length} ítems)</span>
                <span>Sección: <strong>${escapeHtml(pageCatsLabel)}</strong></span>
                <span>WhatsApp Ventas: <strong>0424-7978932</strong> &nbsp;•&nbsp; Hoja ${pageNum} / ${totalPages}</span>
            </footer>
        </section>
        `;
    })
    .join("\n");

const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <title>Catálogo de Productos — A-Comer C.A.</title>
    <style>
        @font-face {
            font-family: "Lato";
            src: url("${fontLatoReg}") format("woff2");
            font-weight: 400;
            font-style: normal;
        }
        @font-face {
            font-family: "Montserrat";
            src: url("${fontMontReg}") format("woff2");
            font-weight: 400;
            font-style: normal;
        }
        @font-face {
            font-family: "Montserrat";
            src: url("${fontMontSemi}") format("woff2");
            font-weight: 600;
            font-style: normal;
        }
        @font-face {
            font-family: "Montserrat";
            src: url("${fontMontBold}") format("woff2");
            font-weight: 700;
            font-style: normal;
        }
        @font-face {
            font-family: "Montserrat";
            src: url("${fontMontExtra}") format("woff2");
            font-weight: 800;
            font-style: normal;
        }
        @font-face {
            font-family: "Oleo Script";
            src: url("${fontOleo}") format("woff2");
            font-weight: 400;
            font-style: normal;
        }

        :root {
            --burgundy: #7a0010;
            --burgundy-dark: #58000b;
            --copper: #c08a7c;
            --olive: #58694c;
            --cream: #fdf8ed;
            --cream-soft: #faf2e1;
            --grey: #2b2b2b;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        @page {
            size: A4 portrait;
            margin: 0;
        }

        html, body {
            width: 210mm;
            background: #ffffff;
            color: var(--grey);
            font-family: "Lato", sans-serif;
            -webkit-font-smoothing: antialiased;
        }

        .page {
            width: 210mm;
            height: 297mm;
            padding: 4.2mm 5.2mm 3.8mm 5.2mm;
            background: var(--cream);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-after: always;
            break-after: page;
            overflow: hidden;
            position: relative;
        }

        .page:last-child {
            page-break-after: auto;
            break-after: auto;
        }

        /* MEMBRETE (HEADER) */
        .letterhead {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 3mm;
            background: #ffffff;
            border: 0.3mm solid rgba(122, 0, 16, 0.22);
            border-radius: 2.2mm;
            padding: 1.6mm 3mm;
            height: 15.8mm;
            flex-shrink: 0;
            box-shadow: 0 0.5mm 1.5mm rgba(122, 0, 16, 0.05);
        }

        .lh-brand {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            padding-right: 2.5mm;
            border-right: 0.3mm solid rgba(122, 0, 16, 0.15);
        }

        .lh-logo {
            height: 12mm;
            width: auto;
            object-fit: contain;
            display: block;
        }

        .lh-center {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 0.4mm;
        }

        .lh-company-row {
            display: flex;
            align-items: center;
            gap: 2mm;
        }

        .lh-company {
            font-family: "Montserrat", sans-serif;
            font-size: 7.4pt;
            font-weight: 800;
            color: var(--burgundy);
            letter-spacing: 0.04em;
        }

        .lh-rif {
            font-family: "Montserrat", sans-serif;
            font-size: 6pt;
            font-weight: 700;
            color: var(--olive);
            background: rgba(88, 105, 76, 0.12);
            padding: 0.3mm 1.5mm;
            border-radius: 1mm;
        }

        .lh-title {
            font-family: "Montserrat", sans-serif;
            font-size: 6.4pt;
            font-weight: 700;
            color: #444444;
            letter-spacing: 0.03em;
        }

        .lh-contact {
            font-size: 5.2pt;
            color: #555555;
            white-space: nowrap;
        }

        .lh-right {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            justify-content: center;
            gap: 1mm;
            flex-shrink: 0;
        }

        .lh-page-pill {
            font-family: "Montserrat", sans-serif;
            font-size: 6.8pt;
            font-weight: 800;
            color: var(--cream);
            background: var(--burgundy);
            padding: 0.7mm 2.4mm;
            border-radius: 99px;
            letter-spacing: 0.03em;
        }

        .lh-cat-pill {
            font-family: "Montserrat", sans-serif;
            font-size: 5.4pt;
            font-weight: 700;
            color: var(--olive);
            background: rgba(88, 105, 76, 0.14);
            border: 0.2mm solid rgba(88, 105, 76, 0.3);
            padding: 0.4mm 2mm;
            border-radius: 99px;
            white-space: nowrap;
            text-transform: uppercase;
        }

        .lh-divider {
            display: flex;
            height: 0.8mm;
            width: 100%;
            margin: 0.9mm 0 1.2mm 0;
            border-radius: 99px;
            overflow: hidden;
            flex-shrink: 0;
        }

        .lh-line-burgundy {
            flex: 3;
            background: var(--burgundy);
        }
        .lh-line-copper {
            flex: 2;
            background: var(--copper);
        }
        .lh-line-olive {
            flex: 1.5;
            background: var(--olive);
        }

        /* GRILLA 2 COLUMNAS x 6 FILAS = 12 PRODUCTOS POR HOJA */
        .products-grid {
            flex: 1;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            grid-template-rows: repeat(6, minmax(0, 1fr));
            column-gap: 2.2mm;
            row-gap: 1.55mm;
            min-height: 0;
        }

        .products-grid--last {
            flex: 0 0 auto;
            grid-template-rows: repeat(1, 43mm);
            margin-bottom: 3mm;
        }

        .product-card {
            background: #ffffff;
            border: 0.28mm solid rgba(122, 0, 16, 0.2);
            border-radius: 2mm;
            padding: 1.3mm 1.7mm;
            display: flex;
            align-items: stretch;
            gap: 1.9mm;
            min-width: 0;
            min-height: 0;
            overflow: hidden;
            box-shadow: 0 0.3mm 0.8mm rgba(0, 0, 0, 0.025);
        }

        .card-photo-wrap {
            width: 24mm;
            flex-shrink: 0;
            background: #fbf4e5;
            border: 0.22mm solid rgba(122, 0, 16, 0.12);
            border-radius: 1.5mm;
            padding: 0.9mm;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
        }

        .card-index {
            position: absolute;
            top: 0.7mm;
            left: 0.7mm;
            font-family: "Montserrat", sans-serif;
            font-size: 4.7pt;
            font-weight: 700;
            color: rgba(122, 0, 16, 0.6);
            background: rgba(255, 255, 255, 0.9);
            padding: 0.2mm 0.9mm;
            border-radius: 0.7mm;
            line-height: 1;
        }

        .card-photo {
            max-width: 100%;
            max-height: 36mm;
            width: auto;
            height: auto;
            object-fit: contain;
            display: block;
        }

        .card-body {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            gap: 0.45mm;
            overflow: hidden;
        }

        .card-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1.2mm;
            flex-wrap: nowrap;
            flex-shrink: 0;
        }

        .brand-badge {
            font-family: "Montserrat", sans-serif;
            font-size: 5.4pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            color: #ffffff;
            background: var(--burgundy);
            padding: 0.25mm 1.3mm;
            border-radius: 0.9mm;
            white-space: nowrap;
            flex-shrink: 0;
        }

        .cat-tag {
            font-family: "Montserrat", sans-serif;
            font-size: 5pt;
            font-weight: 700;
            color: var(--olive);
            background: rgba(88, 105, 76, 0.12);
            padding: 0.22mm 1.1mm;
            border-radius: 0.8mm;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .card-title {
            font-family: "Montserrat", sans-serif;
            font-size: 7.2pt;
            font-weight: 800;
            color: var(--burgundy);
            line-height: 1.12;
            letter-spacing: -0.01em;
            flex-shrink: 0;
        }

        /* PRESENTACIONES */
        .pres-box {
            background: var(--cream-soft);
            border-left: 0.65mm solid var(--copper);
            padding: 0.45mm 1.1mm;
            border-radius: 0 1mm 1mm 0;
            font-size: 6.4pt;
            line-height: 1.18;
            flex-shrink: 0;
        }

        .pres-box--pills {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 0.5mm;
        }

        .pres-label {
            font-family: "Montserrat", sans-serif;
            font-weight: 800;
            color: var(--burgundy);
            text-transform: uppercase;
            font-size: 5.9pt;
            margin-right: 0.5mm;
        }

        .pres-main {
            font-weight: 700;
            color: #1f1f1f;
            font-size: 6.4pt;
        }

        .pres-pills {
            display: inline-flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.5mm;
        }

        .pres-pill {
            font-family: "Montserrat", sans-serif;
            font-size: 5.7pt;
            font-weight: 700;
            color: var(--burgundy);
            background: #ffffff;
            border: 0.2mm solid rgba(122, 0, 16, 0.3);
            padding: 0.15mm 1.05mm;
            border-radius: 0.7mm;
            line-height: 1.15;
        }

        /* CARACTERÍSTICAS */
        .features-wrap {
            display: flex;
            flex-direction: column;
            gap: 0.2mm;
            min-height: 0;
        }

        .features-title {
            font-family: "Montserrat", sans-serif;
            font-size: 5.7pt;
            font-weight: 800;
            text-transform: uppercase;
            color: var(--olive);
            letter-spacing: 0.02em;
        }

        .features-list {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 0.22mm;
        }

        .features-list li {
            font-size: 6.35pt;
            line-height: 1.17;
            color: #262626;
            position: relative;
            padding-left: 1.9mm;
        }

        .features-list li::before {
            content: "•";
            position: absolute;
            left: 0.2mm;
            top: 0;
            color: var(--burgundy);
            font-weight: 900;
        }

        /* EXTRAS: COLORES Y SABORES */
        .extras-row {
            margin-top: 0.15mm;
            font-size: 5.1pt;
            line-height: 1.14;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.4mm;
            background: rgba(88, 105, 76, 0.08);
            padding: 0.3mm 0.9mm;
            border-radius: 0.7mm;
        }

        .extras-label {
            font-family: "Montserrat", sans-serif;
            font-weight: 800;
            color: var(--olive);
        }

        .extras-text {
            color: #333333;
        }

        .color-chip {
            display: inline-flex;
            align-items: center;
            gap: 0.35mm;
            background: #ffffff;
            border: 0.15mm solid rgba(0,0,0,0.15);
            padding: 0.08mm 0.65mm;
            border-radius: 0.5mm;
            font-size: 4.5pt;
            font-weight: 700;
        }

        .color-dot {
            width: 1.2mm;
            height: 1.2mm;
            border-radius: 50%;
            border: 0.1mm solid rgba(0,0,0,0.25);
            display: inline-block;
        }

        /* AJUSTE AUTOMÁTICO PARA TARJETAS CON MUCHO TEXTO */
        .card--medium .card-title {
            font-size: 6.8pt;
        }
        .card--medium .features-list li {
            font-size: 5.95pt;
            line-height: 1.14;
        }
        .card--medium .pres-box,
        .card--medium .pres-main {
            font-size: 6.0pt;
            padding: 0.35mm 0.95mm;
        }
        .card--medium .pres-label {
            font-size: 5.6pt;
        }
        .card--medium .pres-pill {
            font-size: 5.4pt;
        }

        .card--dense .card-title {
            font-size: 6.4pt;
            line-height: 1.09;
        }
        .card--dense .features-list li {
            font-size: 5.5pt;
            line-height: 1.11;
        }
        .card--dense .pres-box,
        .card--dense .pres-main {
            font-size: 5.65pt;
            padding: 0.3mm 0.85mm;
        }
        .card--dense .pres-label {
            font-size: 5.3pt;
        }
        .card--dense .pres-pill {
            font-size: 5.1pt;
            padding: 0.1mm 0.8mm;
        }

        /* BANNER DE CIERRE EN ÚLTIMA PÁGINA */
        .closing-banner {
            margin-top: auto;
            margin-bottom: 2mm;
            background: #ffffff;
            border: 0.35mm solid rgba(122, 0, 16, 0.25);
            border-top: 1.2mm solid var(--burgundy);
            border-radius: 2.5mm;
            padding: 4mm 5mm;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 5mm;
        }

        .closing-left {
            display: flex;
            align-items: center;
            gap: 4mm;
            flex: 1.3;
        }

        .closing-logo {
            height: 18mm;
            width: auto;
            object-fit: contain;
            flex-shrink: 0;
        }

        .closing-kicker {
            font-family: "Montserrat", sans-serif;
            font-size: 5.8pt;
            font-weight: 800;
            text-transform: uppercase;
            color: var(--olive);
            letter-spacing: 0.04em;
        }

        .closing-heading {
            font-family: "Montserrat", sans-serif;
            font-size: 9.5pt;
            font-weight: 800;
            color: var(--burgundy);
            margin: 0.6mm 0;
        }

        .closing-desc {
            font-size: 6.5pt;
            line-height: 1.35;
            color: #444444;
        }

        .closing-right {
            flex: 1;
            background: var(--cream);
            border: 0.25mm solid rgba(122, 0, 16, 0.15);
            border-radius: 1.8mm;
            padding: 2.5mm 3.5mm;
            display: flex;
            flex-direction: column;
            gap: 1mm;
            font-size: 6.2pt;
            color: #333333;
        }

        .closing-contact-item strong {
            font-family: "Montserrat", sans-serif;
            color: var(--burgundy);
        }

        /* FOOTER */
        .page-footer {
            margin-top: 1mm;
            padding-top: 0.8mm;
            border-top: 0.25mm solid rgba(122, 0, 16, 0.2);
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 5.5pt;
            color: #555555;
            flex-shrink: 0;
        }

        .page-footer strong {
            font-family: "Montserrat", sans-serif;
            color: var(--burgundy);
        }
    </style>
</head>
<body>
${pagesHtml}
<script>
    // Auto-adjust any card whose content slightly exceeds the fixed card height
    document.querySelectorAll('.product-card .card-body').forEach((body) => {
        let scale = 1.0;
        while (body.scrollHeight > body.clientHeight + 1 && scale > 0.78) {
            scale -= 0.03;
            body.style.gap = (0.4 * scale) + 'mm';
            const title = body.querySelector('.card-title');
            if (title) title.style.fontSize = (6.8 * scale) + 'pt';
            const pres = body.querySelector('.pres-box');
            if (pres) pres.style.fontSize = (5.9 * scale) + 'pt';
            const presMain = body.querySelector('.pres-main');
            if (presMain) presMain.style.fontSize = (5.9 * scale) + 'pt';
            const presLabel = body.querySelector('.pres-label');
            if (presLabel) presLabel.style.fontSize = (5.5 * scale) + 'pt';
            body.querySelectorAll('.features-list li').forEach((li) => {
                li.style.fontSize = (5.8 * scale) + 'pt';
                li.style.lineHeight = '1.11';
            });
            body.querySelectorAll('.pres-pill').forEach((pill) => {
                pill.style.fontSize = (5.3 * scale) + 'pt';
            });
        }
    });
</script>
</body>
</html>`;

fs.mkdirSync(path.dirname(HTML_TEMP_PATH), { recursive: true });
fs.writeFileSync(HTML_TEMP_PATH, fullHtml, "utf-8");
console.log(`Generated HTML template with ${products.length} products across ${totalPages} pages.`);

const browsers = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

const browserExe = browsers.find((b) => fs.existsSync(b));
if (!browserExe) {
    throw new Error("No Chromium browser (Edge/Chrome) found to render PDF.");
}

const tempProfileDir = path.join(ROOT, "scripts", ".temp-browser-profile");
fs.mkdirSync(tempProfileDir, { recursive: true });

const htmlUrl = pathToFileURL(HTML_TEMP_PATH).href;
console.log(`Rendering PDF with: ${browserExe}`);

try {
    execFileSync(
        browserExe,
        [
            "--headless=new",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
            "--disable-extensions",
            "--disable-background-networking",
            "--disable-sync",
            "--no-first-run",
            `--user-data-dir=${tempProfileDir}`,
            "--no-pdf-header-footer",
            "--print-to-pdf-no-header",
            `--print-to-pdf=${OUTPUT_PUBLIC_PDF}`,
            htmlUrl,
        ],
        { stdio: "inherit" }
    );
} finally {
    fs.rmSync(tempProfileDir, { recursive: true, force: true });
}

fs.copyFileSync(OUTPUT_PUBLIC_PDF, OUTPUT_ROOT_PDF);
fs.unlinkSync(HTML_TEMP_PATH);
fs.rmSync(IMG_CACHE_DIR, { recursive: true, force: true });

const stats = fs.statSync(OUTPUT_PUBLIC_PDF);
console.log(`PDF successfully generated:`);
console.log(` - ${OUTPUT_ROOT_PDF} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
console.log(` - ${OUTPUT_PUBLIC_PDF} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
