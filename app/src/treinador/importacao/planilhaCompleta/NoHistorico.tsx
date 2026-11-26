import { Undo2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { desfazerImportacao } from '../../../api/rotas';
import type { DetalheDeImportacao, ImportacaoDesfeita } from '../../../api/tipos';
import { dataHoraParaTela, inteiroComMilhar } from '../../../dominio/formatos';
import { resumoDoDesfazer, textoDaParteDesfeita } from '../../../dominio/planilhaCompleta';
import { abasDoResultado, lerProblemas, problemasSemDetalhe, resumoDosProblemas } from '../../../dominio/resultadoDaPlanilha';
import { useSessao } from '../../../sessao/SessaoProvider';
import { espaco } from '../../../tema/tokens';
import { Botao } from '../../../ui/Botao';
import { Cartao } from '../../../ui/Cartao';
import { CartaoDeIndicador } from '../../../ui/CartaoDeIndicador';
import { Alerta, MensagemErro } from '../../../ui/Estados';
import { GradeDeIndicadores } from '../../../ui/GradeDeIndicadores';
import { LinhaDeAcoes } from '../../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../../ui/PainelConfirmacao';
import { Texto } from '../../../ui/Texto';
import { textoDoErro } from '../../../ui/erros';
import { ResultadoPorAba } from './ResultadoPorAba';

const O_QUE_O_DESFAZER_FAZ = 'Apaga o que a importação criou e ninguém mexeu: planos nunca publicados, pastas vazias, pesos, exercícios sem uso e alunos sem acesso nem registros. O resto fica, com o motivo.';

/**
 * Detalhe de uma importação da planilha completa no histórico (resultado da importação, 23/11): selo, data e arquivo sob o
 * título; o resumo em três indicadores (criados, linhas com ajuste, linhas de fora, contadas por linha); os problemas por
 * aba (o histórico guarda "<aba>: <CÓDIGO>", nunca o valor) com a lista para copiar; e o "Desfazer importação", que apaga
 * só o que ninguém mexeu.
 */
export function DetalheDaPlanilha({ dados, selo }: { dados: DetalheDeImportacao; selo: ReactNode }) {
  const { pode } = useSessao();
  const [perguntar, setPerguntar] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);
  const [desfeita, setDesfeita] = useState<ImportacaoDesfeita | null>(null);
  const [erro, setErro] = useState<unknown>(null);

  const desfazer = () => {
    setDesfazendo(true);
    setErro(null);
    desfazerImportacao(dados.id).then((d) => {
      setDesfeita(d);
      setDesfazendo(false);
      setPerguntar(false);
    }, (e: unknown) => {
      setErro(e);
      setDesfazendo(false);
      setPerguntar(false);
    });
  };

  const partes = desfeita ? desfeita.partes.map(textoDaParteDesfeita).filter((t): t is string => t !== null) : [];
  const problemas = lerProblemas(dados.erros);
  const resumo = resumoDosProblemas(problemas);
  const semDetalhe = problemasSemDetalhe(dados.comErro, dados.erros.length);
  const quando = dataHoraParaTela(dados.criadoEm);
  // Acima de 1.000 problemas o histórico não guarda o resto: a contagem é só dos guardados.
  const teto = semDetalhe > 0 ? ' Contadas nos 1.000 problemas guardados.' : '';
  const atualizados = dados.atualizados > 0
    ? ` ${dados.atualizados} ${dados.atualizados === 1 ? 'aluno que já existia recebeu' : 'alunos que já existiam receberam'} dados.` : '';
  return (
    <View style={estilos.coluna}>
      <View style={estilos.meta}>
        {selo}
        <Texto variante="suave">{`${quando} · arquivo ${dados.nomeArquivo}`}</Texto>
      </View>
      <GradeDeIndicadores minimo={211}>
        <CartaoDeIndicador rotulo="Registros criados" valor={inteiroComMilhar(dados.novos)} estado={dados.novos > 0 ? 'valor' : 'zero'} tom={dados.novos > 0 ? 'sucesso' : 'neutro'}
          detalhe={`Alunos, pesos, exercícios e pastas; treinos e dietas em rascunho.${atualizados}`} />
        <CartaoDeIndicador rotulo="Linhas com ajuste" valor={inteiroComMilhar(resumo.ajustadas)} estado={resumo.ajustadas > 0 ? 'valor' : 'zero'} tom={resumo.ajustadas > 0 ? 'atencao' : 'neutro'}
          detalhe={resumo.ajustadas > 0 ? `Entraram de outro jeito: sem carga, campo “—” ou nome cortado.${teto}` : null} />
        <CartaoDeIndicador rotulo="Linhas que ficaram de fora" valor={inteiroComMilhar(resumo.fora)} estado={resumo.fora > 0 ? 'valor' : 'zero'} tom={resumo.fora > 0 ? 'perigo' : 'neutro'}
          detalhe={resumo.fora > 0 ? `Não entraram: corrija na planilha e importe de novo.${teto}` : null} />
      </GradeDeIndicadores>
      {problemas.length > 0 || semDetalhe > 0 ? (
        <ResultadoPorAba abas={abasDoResultado(problemas)} semDetalhe={semDetalhe}
          tituloDaCopia={`Problemas da importação da planilha completa de ${quando}`} />
      ) : <Texto variante="suave">{dados.novos > 0 ? 'Nenhum problema: tudo entrou como estava na planilha.' : 'Nada foi criado e nenhum problema foi registrado.'}</Texto>}
      {pode('ALUNO_ALTERAR') ? (
        <Cartao titulo="Desfazer importação" descricao={O_QUE_O_DESFAZER_FAZ}>
          {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
          {desfeita ? (
            <>
              <Alerta tom={desfeita.partes.some((p) => p.ficaram > 0) ? 'atencao' : 'sucesso'} texto={resumoDoDesfazer(desfeita)} />
              {partes.map((t) => <Texto key={t}>{t}</Texto>)}
              {desfeita.ficaramAlem > 0 ? <Texto variante="suave">{`E mais ${desfeita.ficaramAlem} itens que ficaram.`}</Texto> : null}
            </>
          ) : null}
          <LinhaDeAcoes>
            <Botao rotulo={desfeita ? 'Desfazer de novo' : 'Desfazer importação'} tipo="perigoTexto" Icone={Undo2} aoTocar={() => setPerguntar(true)} />
          </LinhaDeAcoes>
        </Cartao>
      ) : null}
      <PainelConfirmacao visivel={perguntar} titulo="Desfazer a importação?" perigo carregando={desfazendo}
        mensagem={`${O_QUE_O_DESFAZER_FAZ} Não dá para voltar atrás: para ter de novo, importe a planilha outra vez.`}
        rotuloConfirmar="Desfazer importação" aoConfirmar={desfazer} aoCancelar={() => setPerguntar(false)} />
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(3) },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
});
