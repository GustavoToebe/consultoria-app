import { aplicarEscolhas, PREFERENCIAS_PADRAO, type Preferencias } from '../dominio/preferencias';

/**
 * As preferências de um usuário, sem React: lê o que está salvo uma vez e grava cada escolha. Escolha feita antes de a
 * leitura terminar não se perde nem apaga o resto: ela vale na hora na tela e, quando a leitura chega, é aplicada
 * por cima do que estava salvo. Duas escolhas seguidas somam (cada uma parte do estado já com a anterior) e as
 * gravações saem em fila, na ordem, então a última escolha é a que fica salva.
 */
export interface ArmazemDePreferencias {
  /** Valor atual; só muda de referência quando muda de fato (serve de `getSnapshot`). */
  obter: () => Preferencias;
  /** `true` quando a leitura do que estava salvo terminou (com ou sem sucesso); antes, `obter` devolve o padrão. */
  lidas: () => boolean;
  escolher: (parcial: Partial<Preferencias>) => void;
  assinar: (aviso: () => void) => () => void;
  /** Começa a leitura do que está salvo (não faz nada se já terminou ou já está lendo). */
  iniciar: () => void;
  /** Para de aplicar a leitura em andamento (o armazém pode ser iniciado de novo). */
  parar: () => void;
}

export function criarArmazemDePreferencias(
  ler: () => Promise<Preferencias>,
  gravar: (preferencias: Preferencias) => Promise<void>,
): ArmazemDePreferencias {
  let atual: Preferencias = PREFERENCIAS_PADRAO;
  let lido = false;
  let lendo = false;
  let geracao = 0;
  let feitasAntes: Partial<Preferencias>[] = [];
  let fila: Promise<void> = Promise.resolve();
  const avisos = new Set<() => void>();

  const avisar = () => avisos.forEach((a) => a());
  const guardar = (preferencias: Preferencias) => {
    fila = fila.then(() => gravar(preferencias)).catch(() => undefined);
  };

  return {
    obter: () => atual,
    lidas: () => lido,
    escolher: (parcial) => {
      atual = aplicarEscolhas(atual, [parcial]);
      if (lido) guardar(atual);
      else feitasAntes.push(parcial);
      avisar();
    },
    assinar: (aviso) => {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    iniciar: () => {
      if (lido || lendo) return;
      lendo = true;
      const minha = ++geracao;
      ler()
        // Leitura que falha vale como "nada salvo": o que a pessoa já escolheu continua valendo.
        .catch(() => ({ ...PREFERENCIAS_PADRAO }))
        .then((salvas) => {
          if (minha !== geracao) return;
          lendo = false;
          lido = true;
          atual = aplicarEscolhas(salvas, feitasAntes);
          if (feitasAntes.length > 0) guardar(atual);
          feitasAntes = [];
          avisar();
        });
    },
    parar: () => {
      geracao += 1;
      lendo = false;
    },
  };
}
