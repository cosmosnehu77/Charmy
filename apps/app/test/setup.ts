import "@testing-library/jest-dom/vitest";
import { useApp } from "@/estado/app";

// Las pruebas de antes de F4-R1 son de la consulta por área; las de Relieve eligen su vista.
beforeEach(() => useApp.setState({ vista: "consulta" }));
