import { create } from "zustand";

export type Idioma = "es" | "en";
export type Tema = "oscuro" | "claro";

export const TITULO_APP: Record<Idioma, string> = {
  es: "Charmy · Fuego en Argentina y Cono Sur",
  en: "Charmy · Fire in Argentina and the Southern Cone",
};

function leerIdiomaGuardado(): Idioma {
  try {
    return localStorage.getItem("charmy-idioma") === "en" ? "en" : "es";
  } catch {
    return "es";
  }
}

function leerTemaGuardado(): Tema {
  try {
    return localStorage.getItem("charmy-tema") === "claro" ? "claro" : "oscuro";
  } catch {
    return "oscuro";
  }
}

function aplicarIdiomaDom(idioma: Idioma) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = idioma;
  document.title = TITULO_APP[idioma];
}

function aplicarTemaDom(tema: Tema) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.tema = tema;
}

export interface EstadoIdioma {
  idioma: Idioma;
  tema: Tema;
  ponerIdioma: (idioma: Idioma) => void;
  alternarIdioma: () => void;
  ponerTema: (tema: Tema) => void;
  alternarTema: () => void;
  sincronizarPreferencias: () => void;
}

const idiomaInicial = leerIdiomaGuardado();
const temaInicial = leerTemaGuardado();
aplicarIdiomaDom(idiomaInicial);
aplicarTemaDom(temaInicial);

export const useIdioma = create<EstadoIdioma>()((set, get) => ({
  idioma: idiomaInicial,
  tema: temaInicial,
  ponerIdioma: (idioma) => {
    try {
      localStorage.setItem("charmy-idioma", idioma);
    } catch {}
    aplicarIdiomaDom(idioma);
    set({ idioma });
  },
  alternarIdioma: () => {
    const siguiente: Idioma = get().idioma === "es" ? "en" : "es";
    get().ponerIdioma(siguiente);
  },
  ponerTema: (tema) => {
    try {
      localStorage.setItem("charmy-tema", tema);
    } catch {}
    aplicarTemaDom(tema);
    set({ tema });
  },
  alternarTema: () => {
    const siguiente: Tema = get().tema === "oscuro" ? "claro" : "oscuro";
    get().ponerTema(siguiente);
  },
  sincronizarPreferencias: () => {
    const idioma = leerIdiomaGuardado();
    const tema = leerTemaGuardado();
    aplicarIdiomaDom(idioma);
    aplicarTemaDom(tema);
    set({ idioma, tema });
  },
}));

/** Reinicia idioma ("es") y tema ("oscuro") al estado inicial. */
export function reiniciarPreferencias() {
  try {
    localStorage.removeItem("charmy-idioma");
    localStorage.removeItem("charmy-tema");
  } catch {}
  aplicarIdiomaDom("es");
  aplicarTemaDom("oscuro");
  useIdioma.setState({ idioma: "es", tema: "oscuro" });
}

/** Devuelve el valor en español o en inglés según el idioma activo. */
export function t<T = string>(es: T, en: T): T {
  return useIdioma.getState().idioma === "en" ? en : es;
}

export function enIngles(): boolean {
  return useIdioma.getState().idioma === "en";
}

export function localeActual(): string {
  return useIdioma.getState().idioma === "en" ? "en-US" : "es-AR";
}
