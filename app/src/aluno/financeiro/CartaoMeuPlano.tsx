import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CobrancaDoAluno } from '../../api/financeiroTipos';
import { rotuloDaForma, rotuloDaPeriodicidade, seloDaCobranca, seloDaContratacao } from '../../dominio/financeiro';
import { centavosParaTela, dataParaTela } from '../../dominio/formatos';
import { rotuloDoMes } from '../../dominio/numeros';
import { espaco, RAIO } from '../../tema/tokens';
import { useTema } from '../../tema/TemaProvider';
import { Botao } from '../../ui/Botao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useFinanceiroDoAluno, useRecarregarFinanceiroAoFocar } from './FinanceiroDoAlunoProvider';

const HISTORICO_VISIVEL = 6;

/**
 * "Meu plano" na Conta do aluno: o plano comercial com o treinador (nome, valor, periodicidade, próximo vencimento), as
 * cobranças em aberto e o histórico. Só leitura e só online: nada fica guardado no aparelho. Não há botão de pagar: o
 * treinador combina a forma de pagamento e dá a baixa. Não leva observação interna nem quem registrou o pagamento.
 * Aparece só com o módulo de pagamentos ligado para a consultoria.
 */
export function CartaoMeuPlano() {
  const { habilitado, online, dados, erro, carregando, recarregar } = useFinanceiroDoAluno();
  const [todas, setTodas] = useState(false);
  useRecarregarFinanceiroAoFocar();
  if (!habilitado) return null;
  if (!online) {
    return (
      <Cartao titulo="Meu plano">
        <Texto variante="suave">Os dados do seu plano aparecem quando você estiver conectado à internet.</Texto>
      </Cartao>
    );
  }
  const historico = dados?.historico ?? [];
  const visiveis = todas ? historico : historico.slice(0, HISTORICO_VISIVEL);
  return (
    <Cartao titulo="Meu plano" descricao="Seu plano comercial com o seu treinador.">
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados ? (
        <>
          {dados.plano ? (
            <View style={estilos.bloco}>
              <View style={estilos.linha}>
                <Texto variante="bloco" style={estilos.nome}>{dados.plano.planoNome ?? 'Plano'}</Texto>
                <Selo texto={seloDaContratacao(dados.plano.situacao).rotulo} tipo={seloDaContratacao(dados.plano.situacao).tom} />
              </View>
              <CampoLeitura rotulo="Valor" valor={centavosParaTela(dados.plano.valorCentavos)} numerico />
              <CampoLeitura rotulo="Periodicidade" valor={rotuloDaPeriodicidade(dados.plano.periodicidade)} />
              <CampoLeitura rotulo="Próximo vencimento" valor={dados.plano.proximoVencimento ? dataParaTela(dados.plano.proximoVencimento) : null} numerico />
            </View>
          ) : (
            <Texto variante="suave">Você ainda não tem um plano comercial contratado com o seu treinador.</Texto>
          )}
          {dados.abertas.length > 0 ? (
            <View style={estilos.bloco}>
              <Texto variante="rotulo">Em aberto</Texto>
              {dados.abertas.map((c) => <LinhaDaCobranca key={c.id} cobranca={c} />)}
              <Texto variante="suave">Seu treinador vai combinar a forma de pagamento com você e registrar quando receber.</Texto>
            </View>
          ) : null}
          {historico.length > 0 ? (
            <View style={estilos.bloco}>
              <Texto variante="rotulo">Histórico</Texto>
              {visiveis.map((c) => <LinhaDaCobranca key={c.id} cobranca={c} />)}
              {historico.length > HISTORICO_VISIVEL && !todas ? <Botao rotulo="Ver todas" tipo="fantasma" aoTocar={() => setTodas(true)} /> : null}
            </View>
          ) : null}
          {dados.plano && dados.abertas.length === 0 && historico.length === 0 ? <Texto variante="suave">Ainda não há cobranças.</Texto> : null}
        </>
      ) : null}
    </Cartao>
  );
}

function LinhaDaCobranca({ cobranca }: { cobranca: CobrancaDoAluno }) {
  const { cores } = useTema();
  const selo = seloDaCobranca(cobranca);
  const detalhe = cobranca.situacao === 'PAGA'
    ? `Pago em ${dataParaTela(cobranca.pagoEm)}${cobranca.forma ? ` · ${rotuloDaForma(cobranca.forma)}` : ''}`
    : `Vence em ${dataParaTela(cobranca.vencimento)}`;
  const mes = rotuloDoMes(cobranca.competencia);
  return (
    <View accessible accessibilityLabel={`${mes}, ${centavosParaTela(cobranca.valorCentavos)}, ${selo.rotulo}. ${detalhe}`}
      style={[estilos.cobranca, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <View style={estilos.linha}>
        <Texto variante="bloco">{mes}</Texto>
        <Selo texto={selo.rotulo} tipo={selo.tom} />
      </View>
      <Texto numerico>{centavosParaTela(cobranca.valorCentavos)}</Texto>
      <Texto variante="suave">{detalhe}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  nome: { flexShrink: 1 },
  cobranca: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.25) },
});
