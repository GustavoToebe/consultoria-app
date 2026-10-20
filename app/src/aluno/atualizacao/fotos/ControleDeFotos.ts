import { createContext, useContext } from 'react';

import type { OrigemDaFoto } from './prepararFoto';

/** Uma foto na tela: já enviada ao servidor (id) ou ainda no aparelho (nome do arquivo na pasta privada do app). */
export type ItemDeFoto = { tipo: 'enviada'; id: string } | { tipo: 'local'; nome: string };

/**
 * O que a pergunta FOTOS precisa do formulário da atualização do aluno. Sem este contexto (tela do treinador) a pergunta
 * só mostra as fotos enviadas.
 */
export interface ControleDeFotos {
  usuarioId: string;
  /** `null` = ainda não se sabe (primeira abertura sem internet); `false` = desligado no servidor. */
  habilitado: boolean | null;
  /** Teto do servidor por pergunta; cada pergunta pode aceitar menos (`maximoDeFotos`). */
  maximoPorPergunta: number;
  online: boolean;
  /** Celular: guarda a foto no aparelho e sobe no envio. Web: precisa de internet e sobe na hora. */
  guardaNoAparelho: boolean;
  /** O aluno pode mexer nas fotos (atualização aberta e liberada). */
  editavel: boolean;
  ocupado: boolean;
  locais: Readonly<Record<string, string[]>>;
  /** `limite`: fotos que esta pergunta aceita (o `max` dela, já limitado pelo teto do servidor). */
  anexar: (perguntaId: string, origem: OrigemDaFoto, limite: number) => Promise<void>;
  remover: (perguntaId: string, item: ItemDeFoto) => Promise<void>;
}

export const ContextoDeFotos = createContext<ControleDeFotos | null>(null);
export const useControleDeFotos = () => useContext(ContextoDeFotos);
