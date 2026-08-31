const OPINIONES_DIR = "src/content/opiniones";
const BRANCH = process.env.GITHUB_BRANCH || "main";

const headers = {
    "Content-Type": "application/json; charset=utf-8",
};

export async function handler(event) {
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 204, headers };
    }

    if (event.httpMethod !== "POST") {
        return json(405, { ok: false, error: "method" });
    }

    const data = parseBody(event);
    if (typeof data["bot-field"] === "string" && data["bot-field"].trim()) {
        return json(200, { ok: true });
    }

    const nombre = cleanText(data.nombre, 80);
    const texto = cleanText(data.texto, 600);
    if (!nombre || !texto) {
        return json(400, { ok: false, error: "invalid" });
    }

    const empresa = cleanText(data.empresa, 80);
    const estrellas = clampStars(data.estrellas);
    const fecha = isoDate();
    const markdown = toMarkdown({ nombre, empresa, estrellas, fecha, texto });
    const unique = Date.now().toString(36).slice(-5);
    const filename = `${fecha}-${slugify(nombre)}-${slugify(empresa) || "opinion"}-${unique}.md`;

    const token = process.env.GITHUB_TOKEN;
    const repo = resolveRepo();
    if (!token || !repo) {
        console.error("Falta GITHUB_TOKEN o GITHUB_REPO");
        return json(500, { ok: false, error: "config" });
    }

    const path = `${OPINIONES_DIR}/${filename}`;
    const response = await fetch(
        `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}`,
        {
            method: "PUT",
            headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${token}`,
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: `Pendiente: opinión de ${nombre}`,
                content: Buffer.from(markdown, "utf8").toString("base64"),
                branch: BRANCH,
            }),
        },
    );

    if (!response.ok) {
        const detail = await response.text();
        console.error("GitHub contents error", response.status, detail);
        return json(502, { ok: false, error: "github" });
    }

    return json(200, { ok: true });
}

function json(statusCode, body) {
    return { statusCode, headers, body: JSON.stringify(body) };
}

function parseBody(event) {
    const raw = event.body || "";
    const text = event.isBase64Encoded ? Buffer.from(raw, "base64").toString("utf8") : raw;
    const type = String(event.headers?.["content-type"] || event.headers?.["Content-Type"] || "");

    if (type.includes("application/x-www-form-urlencoded")) {
        return Object.fromEntries(new URLSearchParams(text));
    }

    try {
        const parsed = JSON.parse(text || "{}");
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function resolveRepo() {
    if (process.env.GITHUB_REPO) {
        return process.env.GITHUB_REPO.replace(/\.git$/, "").replace(/^\/|\/$/g, "");
    }
    const url = process.env.REPOSITORY_URL || "";
    const match = url.match(/github\.com[:/](.+?)(?:\.git)?\/?$/i);
    return match ? match[1] : "";
}

function cleanText(value, max) {
    if (typeof value !== "string") return "";
    return value.replace(/\r\n/g, "\n").trim().slice(0, max);
}

function clampStars(value) {
    const n = Number.parseInt(String(value), 10);
    if (Number.isNaN(n)) return 5;
    return Math.min(5, Math.max(1, n));
}

function isoDate(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.valueOf())) return new Date().toISOString().slice(0, 10);
    return date.toISOString().slice(0, 10);
}

function slugify(value) {
    return value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
}

function yamlString(value) {
    return JSON.stringify(value);
}

function toMarkdown({ nombre, empresa, estrellas, fecha, texto }) {
    const lines = [
        "---",
        `nombre: ${yamlString(nombre)}`,
        empresa ? `empresa: ${yamlString(empresa)}` : null,
        `estrellas: ${estrellas}`,
        "aprobada: false",
        `fecha: ${fecha}`,
        "---",
        "",
        texto.replace(/^---/gm, "—"),
        "",
    ].filter((line) => line !== null);

    return lines.join("\n");
}
