/// <reference types="astro/client" />

import "astro/astro-jsx";

declare global {
    namespace JSX {
        type Element = HTMLElement;
        interface IntrinsicElements extends astroHTML.JSX.IntrinsicElements {}
    }
}

export {};
