import { StyleSheet, View } from 'react-native';

import type { ConteudoQuestionario, RespostaAtualizacao, RespostasAtualizacao } from '../../api/tipos';
import { RodapeDasPaginas, usePaginas } from '../../aluno/atualizacao/PaginasDoQuestionario';
import { alvoDaPergunta, QuestionarioAtualizacao } from '../../aluno/atualizacao/QuestionarioAtualizacao';
import { hojeIso } from '../../dominio/formatos';
import { errosDaPagina, primeiraPaginaComErro } from '../../dominio/paginasDoQuestionario';
import { errosRespostasAtualizacao } from '../../dominio/respostasAtualizacao';
import { espaco } from '../../tema/tokens';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { useRolagem } from '../../ui/RolagemComTopo';
import { Texto } from '../../ui/Texto';

const TOPO = 'previa:topo';

/**
 * Aba Prévia do editor de questionário: o rascunho como o aluno vê, na largura dele (720 px). Atualização numa rolagem
 * só; anamnese em páginas, com "Avançar" conferindo a página e "Conferir respostas" na última (no lugar do envio). As
 * respostas daqui ficam só na tela.
 */
export function PreviaDoQuestionario({ conteudo, anamnese, respostas, erros, aoMudar, aoMudarErros, aoLimpar }: {
  conteudo: ConteudoQuestionario;
  anamnese: boolean;
  respostas: RespostasAtualizacao;
  erros: Record<string, string> | null;
  aoMudar: (id: string, valor: RespostaAtualizacao) => void;
  aoMudarErros: (erros: Record<string, string> | null) => void;
  /** Apaga as respostas e os erros da prévia. */
  aoLimpar: () => void;
}) {
  const { avisar } = useAviso();
  const rolagem = useRolagem();
  const paginas = usePaginas(anamnese ? conteudo : null, respostas, 0);

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
  const conferir = () => {
    const todos = errosRespostasAtualizacao(conteudo, respostas);
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
    const daPagina = errosDaPagina(conteudo, paginas.secao, errosRespostasAtualizacao(conteudo, respostas));
    if (Object.keys(daPagina).length) { mostrar(daPagina, 'O aluno não conseguiria avançar: confira os campos indicados.'); return; }
    aoMudarErros(null);
    irPara(paginas.posicao + 1);
  };
  const limpar = <Botao rotulo="Limpar respostas" tipo="fantasma" aoTocar={() => { aoLimpar(); if (anamnese) irPara(0); }} />;

  return <View style={estilos.previa}>
    <AlvoDeRolagem chave={TOPO}>
      <Cartao titulo="Prévia" descricao={anamnese
        ? 'É assim que o aluno vê o rascunho, uma parte por página, na largura da tela dele. As respostas daqui não são salvas nem enviadas a ninguém.'
        : 'É assim que o aluno vê o rascunho, na largura da tela dele. As respostas daqui não são salvas nem enviadas a ninguém.'}>
        {(!anamnese || paginas.posicao === 0) ? conteudo.instrucoes.map((texto, i) => <Texto key={i}>{texto}</Texto>) : null}
      </Cartao>
    </AlvoDeRolagem>
    {anamnese ? <>
      {paginas.secao !== null ? <QuestionarioAtualizacao modelo={conteudo} respostas={respostas} erros={erros ?? {}} aoMudar={aoMudar}
        pagina={{ secao: paginas.secao, posicao: paginas.posicao, total: paginas.total }} />
        : <Texto variante="suave">Nenhuma seção visível ainda. Adicione perguntas na aba Editar.</Texto>}
      {paginas.total > 0 ? <RodapeDasPaginas posicao={paginas.posicao} total={paginas.total} rotuloFinal="Conferir respostas"
        aoVoltar={() => { aoMudarErros(null); irPara(paginas.posicao - 1); }} aoAvancar={avancar} aoConcluir={conferir} /> : null}
      <LinhaDeAcoes>{limpar}</LinhaDeAcoes>
    </> : <>
      <QuestionarioAtualizacao modelo={conteudo} dataAtualizacao={hojeIso()} respostas={respostas} erros={erros ?? {}} aoMudar={aoMudar} />
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
});
