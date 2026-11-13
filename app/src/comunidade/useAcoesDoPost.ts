import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { ErroApi } from '../api/cliente';
import type { CodigoDeReacao, EnqueteDoMural, PaginaDoMural, PostDoMural } from '../api/comunidadeTipos';
import { comReacao } from '../dominio/comunidade';
import { useAviso } from '../ui/Aviso';
import { textoDoErro } from '../ui/erros';

const codigoDe = (e: unknown) => (e instanceof ErroApi ? e.codigo : undefined);

/**
 * Reagir e votar num post do mural (aluno e equipe; as rotas vêm de quem chama). Sem palpite otimista: o post fica
 * `ocupado` até a resposta, e só então a reação (`comReacao`) ou a enquete devolvida pela API entram na tela, por cima
 * da página que está aberta agora (a resposta atrasada de outro filtro não cobre a lista nova). Enquete encerrada no meio
 * (409 `ENQUETE_ENCERRADA`) ou post que saiu (404): aviso e o mural vem de novo.
 */
export function useAcoesDoPost({ mural, chave, reagir, votar }: {
  mural: { dados: PaginaDoMural | undefined; definir: (d: PaginaDoMural, paraChave?: string) => void; recarregar: () => void };
  chave: string | null;
  reagir?: (postId: string, codigo: CodigoDeReacao, ligar: boolean) => Promise<void>;
  votar?: (postId: string, opcaoIds: string[]) => Promise<EnqueteDoMural>;
}) {
  const { avisar } = useAviso();
  const [ocupados, setOcupados] = useState<ReadonlySet<string>>(new Set());
  const atual = useRef(mural.dados);
  useEffect(() => { atual.current = mural.dados; });

  const trocar = (postId: string, fn: (p: PostDoMural) => PostDoMural) => {
    const pagina = atual.current;
    if (!pagina || chave === null) return;
    mural.definir({ ...pagina, content: pagina.content.map((p) => (p.id === postId ? fn(p) : p)) }, chave);
  };
  const marcar = (postId: string, ligado: boolean) => setOcupados((s) => {
    const novo = new Set(s);
    if (ligado) novo.add(postId); else novo.delete(postId);
    return novo;
  });
  const falhou = (e: unknown) => {
    if (e instanceof ErroApi && e.status === 404) { avisar('Esta publicação saiu do mural.', 'perigo'); mural.recarregar(); return; }
    if (codigoDe(e) === 'ENQUETE_ENCERRADA') { avisar('A enquete foi encerrada. Seu voto não mudou.', 'atencao'); mural.recarregar(); return; }
    avisar(textoDoErro(e), 'perigo');
  };

  const aoReagir = reagir ? (postId: string, codigo: CodigoDeReacao, ligar: boolean) => {
    if (ocupados.has(postId)) return;
    marcar(postId, true);
    reagir(postId, codigo, ligar).then(
      () => trocar(postId, (p) => comReacao(p, codigo, ligar)),
      falhou,
    ).finally(() => marcar(postId, false));
  } : undefined;

  const aoVotar = votar ? (postId: string, opcaoIds: string[]) => {
    if (ocupados.has(postId)) return;
    marcar(postId, true);
    votar(postId, opcaoIds).then(
      (enquete) => {
        trocar(postId, (p) => ({ ...p, enquete }));
        AccessibilityInfo.announceForAccessibility(opcaoIds.length ? 'Voto registrado.' : 'Voto retirado.');
      },
      falhou,
    ).finally(() => marcar(postId, false));
  } : undefined;

  return { ocupados, aoReagir, aoVotar };
}
