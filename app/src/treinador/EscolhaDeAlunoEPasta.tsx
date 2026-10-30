import { useState } from 'react';

import { listarAlunos, listarPastas } from '../api/rotas';
import { dadosEmDia } from '../dominio/dadosEmDia';
import { destinosParaAplicar, SEM_PASTA_PARA_APLICAR } from '../dominio/modelos';
import { useSessao } from '../sessao/SessaoProvider';
import { Botao } from '../ui/Botao';
import { Escolha } from '../ui/Escolha';
import { EscolhaEmFolha } from '../ui/EscolhaEmFolha';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

/** Alunos por página de `GET /alunos` (igual à API e à lista de alunos). */
const TAMANHO_PAGINA = 30;

/**
 * Estado de "para qual aluno e em qual pasta": aplicar um modelo e copiar um plano usam as mesmas regras. As listas só
 * valem para a busca, a página e o aluno em tela: enquanto a nova chega, nada da anterior fica para escolher (senão
 * dava para tocar num aluno de outra página ou numa pasta do aluno anterior).
 */
export function useEscolhaDeAlunoEPasta({ alunoInicial, excluirAlunoId }: { alunoInicial?: string; excluirAlunoId?: string } = {}) {
  const { pode } = useSessao();
  const [busca, setBusca] = useState('');
  const [alunoId, setAlunoId] = useState(alunoInicial ?? '');
  // Nulo = o treinador ainda não escolheu; vazio = criar pasta nova.
  const [pastaEscolhida, setPastaEscolhida] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  // O nome do aluno escolhido fica guardado: a lista muda com a busca e a página.
  const [nomeEscolhido, setNomeEscolhido] = useState<string | null>(null);
  const alunos = useCarregar(`alunos-destino:${busca}:${pagina}`, () => listarAlunos({ busca, pagina }));
  const doAlunos = dadosEmDia(alunos.dados, alunos.carregando);
  const itens = (doAlunos?.itens ?? []).filter((a) => a.id !== excluirAlunoId);
  const temMais = !!doAlunos && doAlunos.itens.length > 0 && pagina * TAMANHO_PAGINA + doAlunos.itens.length < doAlunos.total;
  const pastas = useCarregar(`pastas-destino:${alunoId}`, () => (alunoId ? listarPastas(alunoId) : Promise.resolve([])));
  const carregandoPastas = !!alunoId && pastas.carregando;
  const destinos = destinosParaAplicar(pode('PASTA_ALTERAR'), alunoId ? dadosEmDia(pastas.dados, pastas.carregando) ?? null : null);
  const escolhido = pastaEscolhida ?? destinos.padrao;
  const destino = escolhido ?? '';
  const motivo = !alunoId
    ? 'Escolha o aluno.'
    : carregandoPastas
      ? 'Carregando as pastas do aluno.'
      : destinos.semDestino
        ? 'Este aluno não tem pasta aberta para receber a cópia.'
        : escolhido === null
          ? 'Escolha a pasta onde a cópia entra.'
          : undefined;
  return {
    alunoInicial,
    alunoId,
    /** Pasta de destino; vazio = criar pasta nova (só com `PASTA_ALTERAR`). Só vale com `destinoEscolhido`. */
    destino,
    /** O destino já foi escolhido (ou veio marcado porque não havia o que escolher). */
    destinoEscolhido: escolhido !== null,
    destinos,
    motivo,
    nomeDoAluno: alunos.dados?.itens.find((a) => a.id === alunoId)?.nome ?? nomeEscolhido,
    // O resto é do que `EscolhaDeAlunoEPasta` desenha.
    alunos,
    itens,
    temMais,
    busca,
    pagina,
    pastas,
    carregandoPastas,
    mudarBusca: (v: string) => { setBusca(v); setPagina(0); },
    mudarPagina: setPagina,
    escolherAluno: (id: string) => {
      setAlunoId(id);
      setPastaEscolhida(null);
      setNomeEscolhido(alunos.dados?.itens.find((a) => a.id === id)?.nome ?? null);
    },
    escolherPasta: setPastaEscolhida,
  };
}

/** Aluno (a não ser que venha fixo) e, depois dele, o destino da cópia. */
export function EscolhaDeAlunoEPasta({ escolha }: { escolha: ReturnType<typeof useEscolhaDeAlunoEPasta> }) {
  const { alunos, pastas, destinos } = escolha;
  return (
    <>
      {!escolha.alunoInicial ? (
        <EscolhaEmFolha
          rotulo="Aluno"
          titulo="Escolher aluno"
          valor={escolha.alunoId}
          rotuloDoValor={escolha.nomeDoAluno ?? 'Escolher'}
          opcoes={escolha.itens.map((a) => ({ valor: a.id, rotulo: a.nome }))}
          aoMudar={escolha.escolherAluno}
          busca={{ valor: escolha.busca, rotulo: 'Buscar aluno', aoMudar: escolha.mudarBusca }}
          textoVazio="Nenhum aluno encontrado."
          carregando={alunos.carregando}
          rodape={
            <>
              {escolha.pagina > 0 || escolha.temMais ? (
                <LinhaDeAcoes>
                  {escolha.pagina > 0 ? <Botao rotulo="Alunos anteriores" tipo="secundario" desabilitado={alunos.carregando} motivo="Carregando os alunos." aoTocar={() => escolha.mudarPagina(escolha.pagina - 1)} /> : null}
                  {escolha.temMais ? <Botao rotulo="Próximos alunos" tipo="secundario" aoTocar={() => escolha.mudarPagina(escolha.pagina + 1)} /> : null}
                </LinhaDeAcoes>
              ) : null}
              {alunos.erro ? <MensagemErro texto={textoDoErro(alunos.erro)} tentarDeNovo={alunos.recarregar} /> : null}
            </>
          }
        />
      ) : null}
      {escolha.carregandoPastas ? <Esqueleto texto="Carregando pastas" cartoes={1} /> : null}
      {escolha.alunoId && !escolha.carregandoPastas && !destinos.semDestino ? <Escolha rotulo="Onde a cópia entra" valor={escolha.destinoEscolhido ? escolha.destino : null} opcoes={destinos.opcoes} aoMudar={escolha.escolherPasta} /> : null}
      {escolha.alunoId && !escolha.carregandoPastas && destinos.semDestino ? <Texto>{SEM_PASTA_PARA_APLICAR}</Texto> : null}
      {pastas.erro ? <MensagemErro texto={textoDoErro(pastas.erro)} tentarDeNovo={pastas.recarregar} /> : null}
    </>
  );
}
