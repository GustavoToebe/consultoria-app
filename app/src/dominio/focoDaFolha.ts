/** Quanto antes de a Folha abrir o clique do leitor de tela ainda conta como o que a abriu. */
export const JANELA_DO_GATILHO_MS = 2000;

/** Espera depois de o painel sair: a camada do `Modal` precisa ter ido embora para o foco não ser engolido. */
export const ATRASO_DO_FOCO_MS = 400;

/** O último clique serve de gatilho só se existe e foi logo antes de a Folha abrir. */
export function gatilhoRecente(clique: { quando: number } | null, agora: number): boolean {
  return clique !== null && agora - clique.quando >= 0 && agora - clique.quando <= JANELA_DO_GATILHO_MS;
}

/** Devolve o foco só com leitor de tela ligado e gatilho ainda na tela; sem gatilho (ou já desmontado) não faz nada. */
export function deveDevolverFoco(leitorAtivo: boolean, gatilho: { conectado: boolean } | null): boolean {
  return leitorAtivo && gatilho !== null && gatilho.conectado;
}
