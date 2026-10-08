/** Gravar nunca espera a animação ou o feedback do aparelho. */
export function aoPressionarMarcar({ aoTocar, animar, vibrar }: {
  aoTocar: () => void; animar: () => void; vibrar: () => void;
}) {
  aoTocar();
  animar();
  vibrar();
}
