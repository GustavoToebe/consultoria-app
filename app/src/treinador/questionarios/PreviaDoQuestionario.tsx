import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConteudoQuestionario, RespostaAtualizacao, RespostasAtualizacao } from '../../api/tipos';
import { RodapeDasPaginas, usePaginas } from '../../aluno/atualizacao/PaginasDoQuestionario';
import { alvoDaPergunta, QuestionarioAtualizacao } from '../../aluno/atualizacao/QuestionarioAtualizacao';
import { ITENS_DA_PREVIA } from '../../dominio/editorQuestionario';
import { hojeIso } from '../../dominio/formatos';
import { errosDaPagina, primeiraPaginaComErro } from '../../dominio/paginasDoQuestionario';
import { errosRespostasAtualizacao } from '../../dominio/respostasAtualizacao';
import { espaco } from '../../tema/tokens';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { DicaDeTexto } from '../../ui/DicaDeTexto';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { useRolagem } from '../../ui/RolagemComTopo';
import { Texto } from '../../ui/Texto';

const TOPO = 'previa:topo';
const CAMPOS_FIXOS = 'previa:campos-fixos';
/** `secaoEmFoco.secao` que leva aos campos fixos (o `antes` da Inscrição); -1 são as Instruções, no topo. */
export const SECAO_DOS_CAMPOS_FIXOS = -2;

/**
 * Aba Prévia do editor de questionário: o rascunho como o aluno vê, na largura dele (720 px). Atualização numa rolagem
 * só; anamnese em páginas, com "Avançar" conferindo a página e "Conferir respostas" na última (no lugar do envio). As
 * respostas daqui ficam só na tela.
 */
export function PreviaDoQuestionario({ conteudo, anamnese, respostas, erros, aoMudar, aoMudarErros, aoLimpar, secaoEmFoco, antes }: {
  conteudo: ConteudoQuestionario;
  anamnese: boolean;
  respostas: RespostasAtualizacao;
  erros: Record<string, string> | null;
  aoMudar: (id: string, valor: RespostaAtualizacao) => void;
  aoMudarErros: (erros: Record<string, string> | null) => void;
  /** Apaga as respostas e os erros da prévia. */
  aoLimpar: () => void;
  /**
   * Prévia ao vivo da tela larga: a seção que o treinador está editando. Cada `vez` nova leva a prévia até ela (na
   * anamnese, à página dela; nas outras, à primeira pergunta dela), na rolagem da própria coluna.
   */
  secaoEmFoco?: { secao: number; vez: number } | null;
  /** Antes das perguntas (na Inscrição, os campos fixos da página pública). */
  antes?: ReactNode;
}) {
  const { avisar } = useAviso();
  const rolagem = useRolagem();
  const paginas = usePaginas(anamnese ? conteudo : null, respostas, 0);
  // Sincroniza a rolagem da coluna (fora do React) com a seção editada; só uma `vez` nova move a prévia, não cada tecla.
  const tratada = useRef<number | null>(null);
  const temAntes = !!antes;
  useEffect(() => {
    if (!secaoEmFoco || tratada.current === secaoEmFoco.vez) return;
    tratada.current = secaoEmFoco.vez;
    // Seção -1: as Instruções, que ficam no topo (na anamnese, na primeira página).
    if (anamnese) {
      const posicao = secaoEmFoco.secao < 0 ? 0 : paginas.paginas.indexOf(secaoEmFoco.secao);
      if (posicao >= 0 && posicao !== paginas.posicao) { paginas.irPara(posicao); aoMudarErros(null); }
      rolagem.rolarAte([TOPO]);
      return;
    }
    const primeira = conteudo.secoes[secaoEmFoco.secao]?.perguntas[0];
    if (secaoEmFoco.secao === SECAO_DOS_CAMPOS_FIXOS) rolagem.rolarAte([temAntes ? CAMPOS_FIXOS : TOPO]);
    else if (secaoEmFoco.secao < 0) rolagem.rolarAte([TOPO]);
    else if (primeira) rolagem.rolarAte([alvoDaPergunta(primeira.id)]);
  }, [secaoEmFoco, anamnese, paginas, rolagem, conteudo, aoMudarErros, temAntes]);

  const irPara = (posicao: number) => {
    paginas.irPara(posicao);
    rolagem.rolarAte([TOPO]);
  };
  const mostrar = (novos: Record<string, string>, mensagem: string) => {
    aoMudarErros(novos);
    avisar(mensagem, 'perigo');
    const primeiro = Object.keys(novos)[0];
    if (primeiro) rolagem.rolarAte([alvoDaPergunta(primeiro)]);
  };
  // Itens do plano: a lista fictícia (o editor não tem o plano de um aluno), a mesma que o campo mostra.
  const errosDe = () => errosRespostasAtualizacao(conteudo, respostas, false, {}, hojeIso(), ITENS_DA_PREVIA);
  const conferir = () => {
    const todos = errosDe();
    if (!Object.keys(todos).length) {
      aoMudarErros({});
      avisar('Estas respostas seriam aceitas.', 'sucesso');
      return;
    }
    if (!anamnese) { mostrar(todos, 'Há respostas que o aluno não conseguiria enviar.'); return; }
    const posicao = primeiraPaginaComErro(conteudo, paginas.paginas, todos);
    if (posicao !== null && posicao !== paginas.posicao) paginas.irPara(posicao);
    mostrar(posicao === null ? todos : errosDaPagina(conteudo, paginas.paginas[posicao], todos), 'Há respostas que o aluno não conseguiria enviar.');
  };
  const avancar = () => {
    if (paginas.secao === null) return;
    const daPagina = errosDaPagina(conteudo, paginas.secao, errosDe());
    if (Object.keys(daPagina).length) { mostrar(daPagina, 'O aluno não conseguiria avançar: confira os campos indicados.'); return; }
    aoMudarErros(null);
    irPara(paginas.posicao + 1);
  };
  // "Limpar" também zera o que se digitou no `antes` (os campos fixos guardam o próprio estado).
  const [rodada, setRodada] = useState(0);
  const [dicaAberta, setDicaAberta] = useState(false);
  const limpar = <Botao rotulo="Limpar respostas" tipo="fantasma" aoTocar={() => { aoLimpar(); setRodada((n) => n + 1); if (anamnese) irPara(0); }} />;

  return <View style={estilos.previa}>
    <AlvoDeRolagem chave={TOPO}>
      {/* Título e explicação numa linha (28/11): a explicação inteira fica no ⓘ. Aberto, o cartão sobe de camada para o
          balão não ficar sob os cartões de baixo. */}
      <View style={dicaAberta ? estilos.porCima : null}>
        <Cartao titulo="Prévia · como o aluno vê o rascunho" acoes={<DicaDeTexto rotulo="Sobre a prévia" aoMudar={setDicaAberta} texto={anamnese
          ? 'É assim que o aluno vê o rascunho, uma parte por página, na largura da tela dele. As respostas daqui não são salvas nem enviadas a ninguém.'
          : 'É assim que o aluno vê o rascunho, na largura da tela dele. As respostas daqui não são salvas nem enviadas a ninguém.'} />}>
          {(!anamnese || paginas.posicao === 0) ? conteudo.instrucoes.map((texto, i) => <Texto key={i}>{texto}</Texto>) : null}
        </Cartao>
      </View>
    </AlvoDeRolagem>
    {antes ? <AlvoDeRolagem chave={CAMPOS_FIXOS}><Fragment key={rodada}>{antes}</Fragment></AlvoDeRolagem> : null}
    {anamnese ? <>
      {paginas.secao !== null ? <QuestionarioAtualizacao modelo={conteudo} respostas={respostas} erros={erros ?? {}} aoMudar={aoMudar} itens={ITENS_DA_PREVIA}
        pagina={{ secao: paginas.secao, posicao: paginas.posicao, total: paginas.total }} />
        : <Texto variante="suave">Nenhuma seção visível ainda. Adicione perguntas no editor.</Texto>}
      {paginas.total > 0 ? <RodapeDasPaginas posicao={paginas.posicao} total={paginas.total} rotuloFinal="Conferir respostas"
        aoVoltar={() => { aoMudarErros(null); irPara(paginas.posicao - 1); }} aoAvancar={avancar} aoConcluir={conferir} /> : null}
      <LinhaDeAcoes>{limpar}</LinhaDeAcoes>
    </> : <>
      <QuestionarioAtualizacao modelo={conteudo} dataAtualizacao={hojeIso()} respostas={respostas} erros={erros ?? {}} aoMudar={aoMudar} itens={ITENS_DA_PREVIA} />
      <LinhaDeAcoes>
        <Botao rotulo="Conferir respostas" tipo="secundario" aoTocar={conferir} />
        {limpar}
      </LinhaDeAcoes>
    </>}
  </View>;
}

const estilos = StyleSheet.create({
  // O aluno vê o questionário em até 720 px: a prévia usa a mesma largura.
  previa: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: espaco(3) },
  porCima: { zIndex: 10 },
});
