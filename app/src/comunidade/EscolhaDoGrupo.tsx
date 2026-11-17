import type { PodResumo } from '../api/comunidadeTipos';
import { motivoDoGrupoCheio, POD_TETO } from '../dominio/comunidade';
import { Escolha } from '../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../ui/EscolhaEmFolha';
import { Texto } from '../ui/Texto';

// Valor interno do `null` da API ("Geral" ou "Sem grupo"): não colide com um id de pod (UUID).
const NULO = '__nulo';

/**
 * Escolha de um grupo (pod) da comunidade, só para a equipe: a primeira opção é o `null` da API (`rotuloDoNulo`: "Geral"
 * no mural, "Sem grupo" na ficha). Até oito opções, chips (`Escolha`); acima disso, `EscolhaEmFolha` com busca e o
 * "N de 12" de cada grupo. `motivo` trava tudo com a frase embaixo. `grupoAtualDoAluno` só vem da ficha (mudar o grupo do
 * aluno ocupa vaga): o grupo cheio fica desabilitado com "Grupo cheio: 12 de 12", menos o atual; o nulo nunca trava.
 * Publicar e filtrar o mural não passam a prop e nada trava por vaga.
 */
export function EscolhaDoGrupo({ rotulo, rotuloDoNulo, grupos, valor, aoMudar, motivo, grupoAtualDoAluno }: {
  rotulo: string;
  rotuloDoNulo: string;
  grupos: readonly PodResumo[];
  valor: string | null;
  aoMudar: (podId: string | null) => void;
  motivo?: string;
  grupoAtualDoAluno?: { podId: string | null };
}) {
  const interno = valor ?? NULO;
  const mudar = (v: string) => aoMudar(v === NULO ? null : v);
  const cheio = (p: PodResumo) => (grupoAtualDoAluno ? motivoDoGrupoCheio(p, grupoAtualDoAluno.podId) : null);
  const nulo = { valor: NULO, rotulo: rotuloDoNulo };
  if (grupos.length + 1 > OPCOES_PARA_BUSCAR) {
    const opcoes = [nulo, ...grupos.map((p) => {
      const m = cheio(p);
      return { valor: p.id, rotulo: p.nome, detalhe: `${p.membros} de ${POD_TETO} alunos`, desabilitada: !!m, motivo: m ?? undefined };
    })];
    return (
      <>
        <EscolhaEmFolha rotulo={rotulo} valor={interno} aoMudar={mudar} rotuloDoValor="Escolher" desabilitado={!!motivo} opcoes={opcoes} />
        {motivo ? <Texto variante="pequeno">{motivo}</Texto> : null}
      </>
    );
  }
  const opcoes = [nulo, ...grupos.map((p) => {
    const m = cheio(p);
    return { valor: p.id, rotulo: p.nome, desabilitada: !!m, motivo: m ?? undefined };
  })];
  return (
    <Escolha rotulo={rotulo} chips valor={interno} aoMudar={mudar}
      opcoes={opcoes.map((o) => (motivo ? { ...o, desabilitada: true, motivo } : o))} />
  );
}
