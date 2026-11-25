import { CreditCard, ExternalLink, QrCode } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { lerDetalhesAsaasMinhaConta } from '../../api/minhaContaAsaas';
import { linkDePagamento } from '../../api/rotas';

import type { CobrancaDaConta, ConsumoDoPlano, ItemDoConsumo, MinhaConta } from '../../api/tipos';
import { calcularResumoAbatimentoSplit, type ResumoAbatimentoSplit } from '../../dominio/checkoutTransparente';
import { pagarPermitidoNaPlataforma, plataformaDoApp } from '../../dominio/financeiro';
import { centavosParaTela, dataParaTela, dataHoraParaTela, moedaParaTela, SEM_DADO } from '../../dominio/formatos';
import {
  competenciaParaTela,
  contatosOrdenados,
  enderecoParaTela,
  estadoDoConsumoParaTela,
  fracaoDoConsumo,
  periodicidadeParaTela,
  podePagar,
  resumoFinanceiro,
  situacaoComercialParaTela,
  situacaoDaCobrancaParaTela,
  usoParaTela,
} from '../../dominio/minhaConta';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { BarraProgresso } from '../../ui/BarraProgresso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Vazio } from '../../ui/Estados';
import { Grade } from '../../ui/Grade';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { FolhaPagamentoCentralAsaas } from './FolhaPagamentoCentralAsaas';

/** Rótulo pequeno em cima, valor embaixo; ausência de dado é "—". */
function Dado({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <View style={estilos.dado}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <Texto>{valor ? valor : SEM_DADO}</Texto>
    </View>
  );
}

/** Aba Cadastro: dados da consultoria como a Central os tem (aqui só consulta). */
export function AbaCadastro({ conta }: { conta: MinhaConta }) {
  const { cores } = useTema();
  const { cliente } = conta;
  const endereco = enderecoParaTela(cliente.endereco);
  const contatos = contatosOrdenados(cliente.contatos);
  return (
    <View style={estilos.coluna}>
      <Cartao titulo="Consultoria" descricao="Dados cadastrais de contratação. Para alterar, fale com o suporte.">
        <Dado rotulo="Nome" valor={cliente.nome} />
        <Dado rotulo="Documento" valor={cliente.documento} />
        <View style={estilos.dado}>
          <Texto variante="rotulo">Endereço</Texto>
          {endereco.length === 0 ? <Texto>{SEM_DADO}</Texto> : endereco.map((l) => <Texto key={l}>{l}</Texto>)}
        </View>
      </Cartao>
      <Cartao titulo="Contatos">
        {contatos.length === 0 ? <Texto variante="suave">Nenhum contato cadastrado.</Texto> : (
          <Grade>
            {contatos.map((c, i) => (
              <View key={`${c.email ?? c.nome ?? i}`}
                style={[estilos.item, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
                <Texto variante="bloco">{c.nome ?? SEM_DADO}</Texto>
                <Texto variante="suave">{c.email ?? SEM_DADO}</Texto>
                <Texto variante="suave">{c.telefone ?? SEM_DADO}</Texto>
                {c.principal ? <Selo texto="Principal" tipo="neutro" /> : null}
              </View>
            ))}
          </Grade>
        )}
      </Cartao>
    </View>
  );
}

/** Aba Assinatura: contratação e adicionais. */
export function AbaPlano({ conta }: { conta: MinhaConta }) {
  const { cores } = useTema();
  const c = conta.contratacao;
  const situacao = situacaoComercialParaTela(c.situacaoComercial);
  return (
    <View style={estilos.coluna}>
      <Cartao titulo={c.planoNome ?? 'Plano'} acoes={<Selo texto={situacao.texto} tipo={situacao.tipo} />}>
        <Grade>
          <Dado rotulo="Valor" valor={moedaParaTela(c.valor)} />
          <Dado rotulo="Periodicidade" valor={periodicidadeParaTela(c.periodicidade)} />
          <Dado rotulo="Vencimento" valor={c.diaVencimento ? `Todo dia ${c.diaVencimento}` : null} />
          <Dado rotulo="Início" valor={dataParaTela(c.inicio)} />
          <Dado rotulo="Vigente até" valor={c.vigenteAte ? dataParaTela(c.vigenteAte) : 'Sem data de término'} />
          <Dado rotulo="Instância" valor={c.nomeInstancia} />
        </Grade>
      </Cartao>
      <Cartao titulo="Adicionais">
        {(c.adicionais ?? []).length === 0 ? <Texto variante="suave">Nenhum adicional contratado.</Texto> : (
          <Grade>
            {(c.adicionais ?? []).map((a) => (
              <View key={a.nome} style={[estilos.item, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
                <Texto variante="bloco">{a.nome}</Texto>
                <Texto variante="suave" numerico>Quantidade: {a.quantidade}</Texto>
              </View>
            ))}
          </Grade>
        )}
      </Cartao>
    </View>
  );
}

/**
 * "Pagar" pede à API o link do checkout da Central (contingência InfinitePay/Mercado Pago) e abre fora do app, sem token nem cookie.
 * A baixa só acontece quando a Central confirma o pagamento: a lista atualiza ao abrir a tela de novo.
 */
function BotaoPagarLinkExterno({ cobrancaId, discreto = false }: { cobrancaId: string; discreto?: boolean }) {
  const { avisar } = useAviso();
  const [abrindo, setAbrindo] = useState(false);
  const pagar = () => {
    setAbrindo(true);
    linkDePagamento(cobrancaId)
      .then(({ url }) => Linking.openURL(url))
      .catch((erro: unknown) => avisar(textoDoErro(erro), 'perigo'))
      .finally(() => setAbrindo(false));
  };
  return (
    <Botao
      rotulo={discreto ? 'Pagar por link externo' : 'Pagar'}
      Icone={discreto ? ExternalLink : CreditCard}
      tipo={discreto ? 'fantasma' : 'secundario'}
      carregando={abrindo}
      aoTocar={pagar}
    />
  );
}

function LinhaDeCobranca({
  c,
  previa,
  suportaCheckoutTransparente,
  aoAbrirCheckoutTransparente,
}: {
  c: CobrancaDaConta;
  previa: boolean;
  suportaCheckoutTransparente: boolean;
  aoAbrirCheckoutTransparente: (c: CobrancaDaConta) => void;
}) {
  const { cores } = useTema();
  const { pagarNoIos, pagarNoAndroid } = useSessao();
  const situacao = situacaoDaCobrancaParaTela(c);
  const mostrarPagamento = podePagar(c, previa) && pagarPermitidoNaPlataforma(plataformaDoApp(Platform.OS), { pagarNoIos, pagarNoAndroid });
  return (
    <View style={[estilos.item, estilos.cobranca, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      {/* Competência e valor primeiro; vencimento e situação juntos; o pagamento é apoio. O valor fica neutro: só o selo sinaliza. */}
      <Texto variante="bloco" numerico>{`${competenciaParaTela(c.competenciaInicio, c.competenciaFim)} · ${moedaParaTela(c.valor)}`}</Texto>
      <View style={estilos.tituloDaLinha}>
        <Texto variante="suave" numerico>{`Vencimento: ${dataParaTela(c.vencimento) || SEM_DADO}`}</Texto>
        <Selo texto={situacao.texto} tipo={situacao.tipo} />
      </View>
      {c.pagoEm ? <Texto variante="suave" numerico>{`Paga em ${dataParaTela(c.pagoEm)}`}</Texto> : null}
      {/* No celular o "Pagar" segue a chave da plataforma; sem ela a linha só informa vencimento e pagamento. */}
      {mostrarPagamento ? (
        suportaCheckoutTransparente ? (
          <LinhaDeAcoes alinhar="inicio">
            <Botao
              rotulo="Pagar no app"
              Icone={QrCode}
              tipo="secundario"
              aoTocar={() => aoAbrirCheckoutTransparente(c)}
            />
            <BotaoPagarLinkExterno cobrancaId={c.id} discreto />
          </LinhaDeAcoes>
        ) : (
          <BotaoPagarLinkExterno cobrancaId={c.id} />
        )
      ) : null}
    </View>
  );
}

function CartaoPoliticaSplit({ resumo }: { resumo: ResumoAbatimentoSplit }) {
  const { cores } = useTema();
  return (
    <Cartao
      titulo={resumo.tituloModo}
      descricao={resumo.descricaoModo}
      acoes={
        <Selo
          texto={resumo.quitadoNoMes ? 'Fatura quitada pelo Split' : `Split ${resumo.percentualFormatado}`}
          tipo={resumo.quitadoNoMes ? 'sucesso' : 'neutro'}
        />
      }
    >
      {resumo.modo === 'ABATER_MENSALIDADE' ? (
        <View style={estilos.splitBloco}>
          <Grade>
            <Dado rotulo="Fatura mensal" valor={centavosParaTela(resumo.metaMensalCentavos)} />
            <Dado rotulo="Abatido pelas cobranças no mês" valor={centavosParaTela(resumo.abatidoMesCentavos)} />
            <Dado rotulo="Saldo restante no mês" valor={centavosParaTela(resumo.restanteAbaterCentavos)} />
          </Grade>
          <View style={estilos.splitProgresso}>
            <View style={estilos.tituloDaLinha}>
              <Texto variante="pequeno">Progresso do abatimento automático</Texto>
              <Texto variante="pequeno" numerico>{`${resumo.progressoPercentual}%`}</Texto>
            </View>
            <BarraProgresso
              feitas={resumo.progressoPercentual}
              total={100}
              cor={resumo.quitadoNoMes ? cores.sucesso : cores.acao}
              rotulo="Progresso do abatimento da mensalidade pelo Split"
              valorEmTexto={`${resumo.progressoPercentual}% abatido`}
            />
          </View>
        </View>
      ) : (
        <Dado rotulo="Percentual retido por cobrança" valor={resumo.percentualFormatado} />
      )}
    </Cartao>
  );
}

/** Aba Faturas: política de Split (quando ativa) e cobranças da mais recente para a mais antiga. */
export function AbaFinanceiro({ conta, aoAtualizar }: { conta: MinhaConta; aoAtualizar?: () => void }) {
  const [cobrancaCheckout, setCobrancaCheckout] = useState<CobrancaDaConta | null>(null);
  const detalhesAsaas = lerDetalhesAsaasMinhaConta(conta);
  const resumoSplit = calcularResumoAbatimentoSplit(detalhesAsaas.politicaSplit);
  const resumo = resumoFinanceiro(conta.cobrancas);
  const contatoPrincipal = contatosOrdenados(conta.cliente.contatos)[0];
  const descricao = resumo.vencidas > 0
    ? `${resumo.vencidas} ${resumo.vencidas === 1 ? 'cobrança vencida' : 'cobranças vencidas'} · ${resumo.emAberto} em aberto`
    : `${resumo.emAberto} em aberto`;
  return (
    <View style={estilos.coluna}>
      {resumoSplit ? <CartaoPoliticaSplit resumo={resumoSplit} /> : null}
      {conta.cobrancas.length === 0 ? (
        <Vazio titulo="Sem cobranças" texto="Nenhuma cobrança registrada para esta consultoria." />
      ) : (
        <Cartao titulo="Cobranças" descricao={descricao}>
          <Grade>
            {conta.cobrancas.map((c) => (
              <LinhaDeCobranca
                key={c.id}
                c={c}
                previa={conta.previa}
                suportaCheckoutTransparente={detalhesAsaas.suportaCheckoutTransparente}
                aoAbrirCheckoutTransparente={setCobrancaCheckout}
              />
            ))}
          </Grade>
        </Cartao>
      )}
      <FolhaPagamentoCentralAsaas
        cobranca={cobrancaCheckout}
        documentoPadrao={conta.cliente.documento}
        emailPadrao={contatoPrincipal?.email}
        telefonePadrao={contatoPrincipal?.telefone}
        cepPadrao={conta.cliente.endereco?.cep}
        aoFechar={() => setCobrancaCheckout(null)}
        aoConfirmarPagamento={() => aoAtualizar?.()}
      />
    </View>
  );
}

function LinhaDeConsumo({ item }: { item: ItemDoConsumo }) {
  const { cores } = useTema();
  const estado = estadoDoConsumoParaTela(item.estado);
  const fracao = fracaoDoConsumo(item);
  const cor = item.estado === 'EXCEDIDO' ? cores.perigo : item.estado === 'SEM_LIMITE_CONFIGURADO' ? undefined
    : item.estado === 'DISPONIVEL' ? cores.sucesso : cores.atencao;
  return (
    <View style={[estilos.item, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <View style={estilos.tituloDaLinha}>
        <Texto variante="bloco">{item.nome}</Texto>
        <Selo texto={estado.texto} tipo={estado.tipo} />
      </View>
      <Texto numerico>{usoParaTela(item)}</Texto>
      {fracao === null ? null : <BarraProgresso feitas={Math.round(fracao * 1000)} total={1000} cor={cor} />}
      {item.disponivel === null ? null : <Texto variante="suave" numerico>Disponível: {item.disponivel}</Texto>}
    </View>
  );
}

/** Consumo do plano: uso real contra os limites. Sem limite configurado não há barra nem "disponível". */
export function CartaoConsumo({ consumo }: { consumo: ConsumoDoPlano }) {
  return (
    <Cartao titulo="Consumo do plano"
      descricao={`Uso atual comparado aos limites do plano. Atualizado em ${dataHoraParaTela(consumo.consultadoEm)}.`}>
      <Grade>{consumo.itens.map((i) => <LinhaDeConsumo key={i.codigo} item={i} />)}</Grade>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(3) },
  dado: { gap: 2 },
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.5) },
  cobranca: { gap: espaco(0.5) },
  tituloDaLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
  splitBloco: { gap: espaco(1.5) },
  splitProgresso: { gap: espaco(0.5) },
});
