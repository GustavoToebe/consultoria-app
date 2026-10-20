import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import type { ConferenciaDePagamento } from '../../api/financeiroTipos';
import { listarConferencias, marcarConferido } from '../../api/rotas';
import { rotuloDoMotivoDaConferencia, TEXTO_NADA_E_BAIXADO } from '../../dominio/financeiro';
import { centavosParaTela, dataHoraParaTela } from '../../dominio/formatos';
import { rotuloDoMes } from '../../dominio/numeros';
import { espaco, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { ItemDeLista } from '../../ui/ItemDeLista';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Tabela } from '../../ui/Tabela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * "Pagamentos para conferir (N)": pagamentos que a InfinitePay avisou e o app não baixou sozinho (cobrança já cancelada
 * ou paga, valor ou link diferente, e assim por diante) e os estornos que ela informou. Nada é baixado nem desfeito aqui:
 * "Marcar como conferido" só tira o item da lista; se o pagamento for válido, o treinador o registra à mão na cobrança, e
 * se houve estorno ele a ajusta à mão (a cobrança paga continua paga até lá). Some quando não há nada para conferir.
 * Quem monta este cartão confere antes `recebimentoOnlineHabilitado` e `ALUNO_LER`; marcar exige `FINANCEIRO_ALTERAR`.
 * No PC é tabela com o botão na linha; no celular cada aviso é um item que abre uma folha com os dados e o botão (na
 * tabela empilhada o botão espremia o nome).
 */
export function CartaoDeConferencias({ podeAlterar }: { podeAlterar: boolean }) {
  const { avisar } = useAviso();
  const lista = useCarregar('conferencias', () => listarConferencias());
  const { recarregar } = lista;
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  const [alvo, setAlvo] = useState<ConferenciaDePagamento | null>(null);
  const [detalhe, setDetalhe] = useState<ConferenciaDePagamento | null>(null);
  const { width } = useWindowDimensions();
  const celular = width < LARGURA_MENU_LATERAL;
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  // O recebimento online foi desligado no servidor: o cartão some como se o recurso não existisse.
  if (codigoApi(lista.erro) === 'RECEBIMENTO_ONLINE_INDISPONIVEL') return null;
  const itens = lista.dados?.itens ?? [];
  if (lista.erro && itens.length === 0) {
    return <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={recarregar} />;
  }
  if (itens.length === 0) return null;

  const marcar = () => {
    if (!alvo) return;
    setEnviando(true);
    setErro(null);
    marcarConferido(alvo.id).then(
      () => {
        setEnviando(false);
        setAlvo(null);
        avisar('Marcado como conferido.', 'sucesso');
        recarregar();
      },
      (e: unknown) => {
        setEnviando(false);
        // Removido, ou já fora da fila de conferência (409 `AVISO_NAO_CONFERIVEL`): a lista confere de novo. Já conferido
        // em outro lugar a API responde 204 e cai no caminho de sucesso.
        if (codigoApi(e) === 'NAO_ENCONTRADO' || codigoApi(e) === 'AVISO_NAO_CONFERIVEL') {
          setAlvo(null);
          recarregar();
          return;
        }
        setErro(e);
      },
    );
  };

  return (
    <>
      <Cartao titulo={`Pagamentos para conferir (${itens.length})`} descricao={TEXTO_NADA_E_BAIXADO}>
        {celular ? (
          <View accessibilityRole="list" accessibilityLabel="Pagamentos para conferir" style={{ gap: espaco(1) }}>
            {itens.map((c) => (
              <ItemDeLista key={c.id} titulo={c.alunoNome ?? 'Aluno não identificado'}
                detalhe={`Pago ${centavosParaTela(c.valorPagoCentavos)} · ${rotuloDoMotivoDaConferencia(c.motivo)}`}
                aoTocar={() => setDetalhe(c)} rotulo={`Abrir pagamento para conferir de ${c.alunoNome ?? 'aluno não identificado'}`} />
            ))}
          </View>
        ) : (
          <Tabela rotulo="Pagamentos para conferir" linhas={itens} chave={(c) => c.id} larguraMinima={900} colunas={[
            { chave: 'aluno', titulo: 'Aluno', principal: true, flex: 1.4, render: (c) => <Texto variante="bloco" numberOfLines={2}>{c.alunoNome ?? '—'}</Texto> },
            { chave: 'competencia', titulo: 'Competência', flex: 1, render: (c) => <Texto numerico>{rotuloDoMes(c.competencia)}</Texto> },
            { chave: 'cobrada', titulo: 'Valor da cobrança', flex: 1, alinhar: 'direita', render: (c) => <Texto numerico>{centavosParaTela(c.valorCobrancaCentavos)}</Texto> },
            { chave: 'paga', titulo: 'Valor pago', flex: 1, alinhar: 'direita', render: (c) => <Texto numerico>{centavosParaTela(c.valorPagoCentavos)}</Texto> },
            { chave: 'motivo', titulo: 'Motivo', flex: 1.6, render: (c) => <Texto>{rotuloDoMotivoDaConferencia(c.motivo)}</Texto> },
            { chave: 'recebido', titulo: 'Recebido em', flex: 1.2, render: (c) => <Texto numerico>{dataHoraParaTela(c.recebidoEm)}</Texto> },
            ...(podeAlterar ? [{ chave: 'acao', titulo: 'Ação', acao: true, largura: 210, render: (c: ConferenciaDePagamento) => (
              <Botao rotulo="Marcar como conferido" tipo="secundario" rotuloAcessivel={`Marcar como conferido o pagamento de ${c.alunoNome ?? 'aluno não identificado'}`}
                aoTocar={() => { setErro(null); setAlvo(c); }} />
            ) }] : []),
          ]} />
        )}
      </Cartao>
      {detalhe ? (
        <Folha visivel titulo="Pagamento para conferir" aoFechar={() => setDetalhe(null)}
          rodape={podeAlterar ? (
            <Botao rotulo="Marcar como conferido" rotuloAcessivel={`Marcar como conferido o pagamento de ${detalhe.alunoNome ?? 'aluno não identificado'}`}
              aoTocar={() => { const c = detalhe; setDetalhe(null); setErro(null); setAlvo(c); }} />
          ) : undefined}>
          <View style={{ gap: espaco(2) }}>
            <Texto variante="bloco">{detalhe.alunoNome ?? 'Aluno não identificado'}</Texto>
            <Texto>{rotuloDoMotivoDaConferencia(detalhe.motivo)}</Texto>
            <CamposEmLinha>
              <CampoLeitura rotulo="Valor pago" valor={centavosParaTela(detalhe.valorPagoCentavos)} numerico />
              <CampoLeitura rotulo="Valor da cobrança" valor={centavosParaTela(detalhe.valorCobrancaCentavos)} numerico />
              <CampoLeitura rotulo="Competência" valor={rotuloDoMes(detalhe.competencia)} />
              <CampoLeitura rotulo="Recebido em" valor={dataHoraParaTela(detalhe.recebidoEm)} numerico />
            </CamposEmLinha>
            <Texto variante="suave">{TEXTO_NADA_E_BAIXADO}</Texto>
          </View>
        </Folha>
      ) : null}
      <PainelConfirmacao visivel={alvo !== null} titulo="Marcar como conferido?"
        mensagem="O pagamento sai desta lista. Isto não dá baixa nem desfaz uma baixa: se o pagamento for válido, registre-o na cobrança; se houve estorno, ajuste a cobrança à mão."
        rotuloConfirmar="Marcar como conferido" rotuloCancelar="Voltar" carregando={enviando}
        aoConfirmar={marcar} aoCancelar={() => setAlvo(null)}>
        {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </PainelConfirmacao>
    </>
  );
}
