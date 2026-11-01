import { FileStack, Undo2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { desfazerImportacao } from '../../../api/rotas';
import type { DetalheDeImportacao, ImportacaoDesfeita } from '../../../api/tipos';
import { dataHoraParaTela } from '../../../dominio/formatos';
import { CAMINHO_PLANILHA_COMPLETA, errosDoHistorico, resumoDoDesfazer, textoDaParteDesfeita } from '../../../dominio/planilhaCompleta';
import { useSessao } from '../../../sessao/SessaoProvider';
import { espaco } from '../../../tema/tokens';
import { Botao } from '../../../ui/Botao';
import { Cartao } from '../../../ui/Cartao';
import { Alerta, MensagemErro } from '../../../ui/Estados';
import { useSaidaGuardada } from '../../../ui/GuardaDeSaida';
import { ItemDeLista } from '../../../ui/ItemDeLista';
import { LinhaDeAcoes } from '../../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../../ui/PainelConfirmacao';
import { Texto } from '../../../ui/Texto';
import { textoDoErro } from '../../../ui/erros';
import { ProblemasAgrupados } from './ProblemasAgrupados';

/**
 * O caminho para a planilha completa, ao lado dos destinos de uma aba. Só para quem pode criar alunos (a API confere as
 * outras partes uma a uma). Sair do assistente de uma aba com algo escolhido pergunta antes.
 */
export function CartaoDaPlanilhaCompleta() {
  const { pode } = useSessao();
  const router = useRouter();
  const { confirmar } = useSaidaGuardada();
  if (!pode('ALUNO_ALTERAR')) return null;
  return (
    <ItemDeLista titulo="Planilha completa (alunos, pesos, treinos e dietas)" Icone={FileStack}
      detalhe="Várias abas ligadas de uma vez, como a planilha de outra plataforma. Treinos e dietas entram em rascunho."
      href={CAMINHO_PLANILHA_COMPLETA} aoTocar={() => confirmar(() => router.push(CAMINHO_PLANILHA_COMPLETA))} />
  );
}

/**
 * Detalhe de uma importação da planilha completa no histórico: o que foi criado, os problemas agrupados por aba e motivo
 * (o histórico guarda "<aba>: <CÓDIGO>", nunca o valor) e o "Desfazer importação", que apaga só o que ninguém mexeu.
 */
export function DetalheDaPlanilha({ dados }: { dados: DetalheDeImportacao }) {
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
  return (
    <View style={estilos.coluna}>
      <Texto variante="suave">{`Planilha completa · ${dataHoraParaTela(dados.criadoEm)} · arquivo ${dados.nomeArquivo}`}</Texto>
      <Texto>{`${dados.novos} ${dados.novos === 1 ? 'registro criado' : 'registros criados'} (alunos, pesos, exercícios e pastas)${dados.atualizados > 0 ? `; ${dados.atualizados} ${dados.atualizados === 1 ? 'aluno que já existia recebeu' : 'alunos que já existiam receberam'} dados` : ''}. Treinos e dietas ficaram em rascunho.`}</Texto>
      {dados.erros.length > 0 ? (
        <Cartao titulo="Problemas" descricao="O que ficou de fora, foi cortado ou não foi entendido.">
          <ProblemasAgrupados erros={errosDoHistorico(dados.erros)} alem={0} />
        </Cartao>
      ) : null}
      {pode('ALUNO_ALTERAR') ? (
        <Cartao titulo="Desfazer importação" descricao="Apaga o que a importação criou e ninguém mexeu: planos nunca publicados, pastas vazias, pesos, exercícios sem uso e alunos sem acesso nem registros. O resto fica, com o motivo.">
          {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
          {desfeita ? (
            <>
              <Alerta tom={desfeita.partes.some((p) => p.ficaram > 0) ? 'atencao' : 'sucesso'} texto={resumoDoDesfazer(desfeita)} />
              {partes.map((t) => <Texto key={t}>{t}</Texto>)}
              {desfeita.ficaramAlem > 0 ? <Texto variante="suave">{`E mais ${desfeita.ficaramAlem} itens que ficaram.`}</Texto> : null}
            </>
          ) : null}
          <LinhaDeAcoes>
            <Botao rotulo={desfeita ? 'Desfazer de novo' : 'Desfazer importação'} tipo="secundario" Icone={Undo2} aoTocar={() => setPerguntar(true)} />
          </LinhaDeAcoes>
        </Cartao>
      ) : null}
      <PainelConfirmacao visivel={perguntar} titulo="Desfazer a importação?" perigo carregando={desfazendo}
        mensagem="Apaga o que esta importação criou e ninguém mexeu. Não dá para voltar atrás: para ter de novo, importe a planilha outra vez."
        rotuloConfirmar="Desfazer importação" aoConfirmar={desfazer} aoCancelar={() => setPerguntar(false)} />
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
});
