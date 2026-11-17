import type { PodResumo } from '../api/comunidadeTipos';
import { Escolha } from '../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../ui/EscolhaEmFolha';
import { Texto } from '../ui/Texto';

// Valores internos: o `null` da API ("Geral" ou "Sem grupo") e "nada escolhido ainda" não colidem com um id de pod (UUID).
const NULO = '__nulo';
const NENHUM = '__nenhum';

/** Teto de alunos por grupo (o servidor confere e responde 409 `POD_CHEIO`; aqui só para o "N de 12"). */
export const POD_TETO = 12;

/**
 * Escolha de um grupo (pod) da comunidade, só para a equipe: a primeira opção é o `null` da API (`rotuloDoNulo`: "Geral"
 * no mural, "Sem grupo" na ficha). Até oito opções, chips (`Escolha`); acima disso, `EscolhaEmFolha` com busca e o
 * "N de 12" de cada grupo. `valor` `undefined` = nada escolhido (a ficha não sabe o grupo atual); `motivo` trava tudo
 * com a frase embaixo.
 */
export function EscolhaDoGrupo({ rotulo, rotuloDoNulo, grupos, valor, aoMudar, motivo }: {
  rotulo: string;
  rotuloDoNulo: string;
  grupos: readonly PodResumo[];
  valor: string | null | undefined;
  aoMudar: (podId: string | null) => void;
  motivo?: string;
}) {
  const interno = valor === undefined ? NENHUM : valor ?? NULO;
  const mudar = (v: string) => aoMudar(v === NULO ? null : v);
  const opcoes = [{ valor: NULO, rotulo: rotuloDoNulo }, ...grupos.map((p) => ({ valor: p.id, rotulo: p.nome }))];
  if (opcoes.length > OPCOES_PARA_BUSCAR) {
    return (
      <>
        <EscolhaEmFolha rotulo={rotulo} valor={interno} aoMudar={mudar} rotuloDoValor="Escolher" desabilitado={!!motivo}
          opcoes={[opcoes[0], ...grupos.map((p) => ({ valor: p.id, rotulo: p.nome, detalhe: `${p.membros} de ${POD_TETO} alunos` }))]} />
        {motivo ? <Texto variante="pequeno">{motivo}</Texto> : null}
      </>
    );
  }
  return (
    <Escolha rotulo={rotulo} chips valor={interno} aoMudar={mudar}
      opcoes={opcoes.map((o) => (motivo ? { ...o, desabilitada: true, motivo } : o))} />
  );
}
