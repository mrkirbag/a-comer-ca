export interface Product {
    id: string;
    name: string;
    brand: string;
    category: string;
    subCategory: string;
    image: string;
    description?: string;
    features?: string[];
    presentation?: string;
    usage?: string;
}

export interface CatalogCategory {
    id: string;
    name: string;
    description: string;
    image: string;
    badge: string;
}

export const catalogCategories: CatalogCategory[] = [
    {
        id: "equipos",
        name: "Maquinarias y Equipos",
        description: "Hornos industriales, batidoras planetarias, molinos, rebanadoras y equipos de alta producción gastronómica.",
        image: "/imagenes-proveedores/coldelec.webp",
        badge: "Maquinarias"
    },
    {
        id: "utensilios",
        name: "Utensilios",
        description: "Bandejas para pan, moldes para repostería y ollas de aluminio gastronómico de alta durabilidad.",
        image: "/imagenes-proveedores/alumware.webp",
        badge: "Menaje"
    },
    {
        id: "menajes",
        name: "Menajes",
        description: "Cristalería de vidrio templado, copas, jarras, bandejas de servicio, salseras, tobos y accesorios de mesa en acero inoxidable.",
        image: "/imagenes-proveedores/vidosa.webp",
        badge: "Menaje"
    }
];
