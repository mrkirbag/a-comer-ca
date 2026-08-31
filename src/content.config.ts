import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const opiniones = defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/opiniones" }),
    schema: z.object({
        nombre: z.string(),
        empresa: z.string().optional(),
        estrellas: z.number().int().min(1).max(5),
        aprobada: z.boolean().default(false),
        fecha: z.coerce.date(),
    }),
});

export const collections = { opiniones };
