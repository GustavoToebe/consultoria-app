export interface Guarda {
  /** Marca a tela como "com alteração não salva"; devolve a função que desmarca. */
  registrar: (id: string) => () => void;
  /** Roda `acao` na hora se nada está pendente ou a saída está liberada; senão pede a confirmação (`pedir`). */
  confirmar: (acao: () => void) => void;
  /** Há alguma tela com alteração não salva? */
  pendente: () => boolean;
  /** A pessoa já confirmou a saída: navegar agora não pergunta de novo. */
  liberado: () => boolean;
  /**
   * Libera a saída até a função devolvida ser chamada (chamar de novo não faz nada). Aceita vários ao mesmo tempo:
   * a saída fica liberada enquanto algum estiver aberto.
   */
  liberar: () => () => void;
}

export const SEM_GUARDA: Guarda = {
  registrar: () => () => undefined,
  confirmar: (acao) => acao(),
  pendente: () => false,
  liberado: () => true,
  liberar: () => () => undefined,
};

/** `pedir` recebe a ação a rodar se a pessoa confirmar o "Sair sem salvar?". */
export function criarGuarda(pedir: (acao: () => void) => void): Guarda {
  const pendentes = new Set<string>();
  let liberacoes = 0;
  return {
    registrar: (id) => {
      pendentes.add(id);
      return () => {
        pendentes.delete(id);
      };
    },
    confirmar: (acao) => {
      if (liberacoes > 0 || pendentes.size === 0) acao();
      else pedir(acao);
    },
    pendente: () => pendentes.size > 0,
    liberado: () => liberacoes > 0,
    liberar: () => {
      liberacoes += 1;
      let solto = false;
      return () => {
        if (solto) return;
        solto = true;
        liberacoes -= 1;
      };
    },
  };
}
