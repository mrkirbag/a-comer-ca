export interface ProductColorOption {
    name: string;
    hex: string;
    code?: string;
    brand?: string;
}

export interface ProductFlavorOption {
    name: string;
    image?: string;
}

export interface Product {
    id: string;
    name: string;
    brand: string;
    category: string;
    subCategory: string;
    subSubCategory?: string;
    image: string;
    description?: string;
    features?: string[];
    presentation?: string;
    usage?: string;
    colors?: ProductColorOption[];
    flavors?: string[];
    flavorOptions?: ProductFlavorOption[];
    presentations?: string[];
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
    },
    {
        id: "insumos",
        name: "Insumos y Materia Prima",
        description: "Colorantes vegetales, pigmentos metalizados comestibles y esencias saborizantes concentradas para repostería y panadería.",
        image: "/imagenes-proveedores/indelma.webp",
        badge: "Insumos"
    },
    {
        id: "limpieza",
        name: "Mantenimiento y Limpieza",
        description: "Dispensadores institucionales, carros de limpieza, secadores de manos, alcohol sólido y señalización de seguridad para hostelería y cocina.",
        image: "/uploads/limpieza/carro-multiuso-deluxe.webp",
        badge: "Limpieza"
    }
];

