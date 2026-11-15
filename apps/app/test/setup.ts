import "@testing-library/jest-dom/vitest";
import { useRelieve } from "@/relieve/estado";

// Las pruebas de la consulta por área arrancan en Tu zona (#276); las de Relieve eligen su pestaña.
beforeEach(() => useRelieve.setState({ pestana: "zona", focoZona: null }));
