import { Ban, Copy, Download, Ellipsis, Handshake, Link2, RotateCw } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { CobrancaResponse } from '../../api/financeiroTipos';
import { cancelarCobrancasEmLote, exportarCobrancasSelecionadas, gerarLinksEmLote } from '../../api/rotas';
import {
  juntarTentativa, linksGerados, linksParaTentarDeNovo, nomeDoCsvDasSelecionadas, resumoDaAcaoEmLote, textoDaExportacaoDasSelecionadas, type AcaoDoLote, type ResumoDaAcaoEmLote,
} from '../../dominio/acoesEmLote';
import { hojeEmBrasilia, LIMITES, problemaDoLote, referenciaDaCobranca, totalDoLote } from '../../dominio/financeiro';
import { centavosParaTela } from '../../dominio/formatos';
import { motivoDeRenegociarOLoteDesabilitado } from '../../dominio/renegociar';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Divisor } from '../../ui/Divisor';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { baixarCsv } from './baixarCsv';
import { copiarTexto } from './comum';
import { MarcaDoResultado } from './FolhaDoLote';

const quantas = (n: number) => (n === 1 ? '1 cobrança' : `${n} cobranças`);

/**
 * As ações em lote que não são a baixa (Fase 1 do financeiro), num menu secundário ao lado do "Revisar pagamentos" (o único
 * primário da barra): cancelar (`PainelConfirmacao` destrutivo, motivo opcional, não tem volta), gerar os links de pagamento
 * (só com o recebimento online ligado na plataforma) e exportar as selecionadas em CSV. A seleção é a mesma do lote de
 * baixa (só em aberto, que é o que as três aceitam). Cancelar e link mostram o resultado de cada uma, na ordem do pedido;
 * falha parcial nunca aparece como sucesso. Quem chamou recebe as canceladas (`aoCancelar`), que saem da seleção, e mostra
 * o resultado (`aoResultado` + `FolhaDoResultadoDaAcao`): esta barra some quando a seleção esvazia. "Renegociar" (D14) só
 * entrega a seleção a quem chamou (`aoRenegociar`), que abre a `FolhaRenegociar` fora desta barra pelo mesmo motivo.
 */
export function AcoesDoLote({ lote, comLink, aoCancelar, aoRenegociar, aoResultado, estilo }: {
  lote: readonly CobrancaResponse[];
  comLink: boolean;
  aoCancelar: (cancelados: string[]) => void;
  /** Abre a renegociação com a seleção de agora (as que não podem entrar são explicadas na primeira etapa). */
  aoRenegociar?: (selecao: CobrancaResponse[]) => void;
  aoResultado: (resultado: ResultadoDaAcao) => void;
  /** O estilo dos botões da barra (no celular, crescer para a fileira ocupar a largura). */
  estilo?: StyleProp<ViewStyle>;
}) {
  const { avisar } = useAviso();
  const [menu, setMenu] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState<AcaoDoLote | 'EXPORTAR' | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  // O segundo toque chega antes de a tela redesenhar (o `ocupado` do estado ainda é o velho): sem a trava sairiam dois
  // pedidos (dois cancelamentos, links pedidos duas vezes, dois CSVs). Uma trava para as três ações.
  const trava = useRef(false);
  const n = lote.length;
  const problema = problemaDoLote(n);
  const semRenegociar = motivoDeRenegociarOLoteDesabilitado(lote);
  const comecar = (acao: AcaoDoLote | 'EXPORTAR') => {
    if (trava.current) return false;
    trava.current = true;
    setOcupado(acao);
    return true;
  };
  const terminar = () => {
    trava.current = false;
    setOcupado(null);
  };

  const cancelar = () => {
    if (problema || !comecar('CANCELAR')) return;
    const enviadas = [...lote];
    setErro(null);
    cancelarCobrancasEmLote({ itens: enviadas.map((c) => ({ cobrancaId: c.id, versao: c.versao })), motivo: motivo.trim() || null }).then(
      ({ resultados }) => {
        const resumo = resumoDaAcaoEmLote('CANCELAR', enviadas.map((c) => c.id), resultados);
        terminar();
        setCancelando(false);
        aoResultado({ acao: 'CANCELAR', resumo, enviadas });
        aoCancelar(resumo.itens.filter((i) => i.ok).map((i) => i.cobrancaId));
      },
      // O pedido inteiro foi recusado (ou não chegou): fica no painel, com o motivo.
      (e: unknown) => { terminar(); setErro(e); },
    );
  };

  const gerarLinks = () => {
    if (!comecar('LINK')) return;
    const enviadas = [...lote];
    gerarLinksEmLote({ cobrancaIds: enviadas.map((c) => c.id) }).then(
      ({ resultados }) => {
        terminar();
        aoResultado({ acao: 'LINK', resumo: resumoDaAcaoEmLote('LINK', enviadas.map((c) => c.id), resultados), enviadas });
      },
      (e: unknown) => { terminar(); avisar(textoDoErro(e), 'perigo'); },
    );
  };

  const exportar = () => {
    if (!comecar('EXPORTAR')) return;
    exportarCobrancasSelecionadas({ cobrancaIds: lote.map((c) => c.id) })
      .then((texto) => baixarCsv(nomeDoCsvDasSelecionadas(hojeEmBrasilia()), texto))
      .then(() => avisar(textoDaExportacaoDasSelecionadas(n), 'sucesso'), (e: unknown) => avisar(textoDoErro(e), 'perigo'))
      .finally(terminar);
  };

  return (
    <>
      <Botao rotulo="Mais ações" tipo="secundario" Icone={Ellipsis} carregando={ocupado === 'LINK' || ocupado === 'EXPORTAR'}
        desabilitado={!!problema} motivo={problema ?? undefined} aoTocar={() => setMenu(true)} style={estilo} />
      {menu ? (
        <FolhaDeAcoes titulo={`Ações com ${quantas(n)}`} aoFechar={() => setMenu(false)} acoes={[
          comLink && { rotulo: 'Gerar links de pagamento', detalhe: 'Um link da InfinitePay para cada uma, para você mandar ao aluno.', Icone: Link2, aoTocar: gerarLinks },
          { rotulo: 'Exportar selecionadas', detalhe: 'Baixa um CSV só com estas cobranças.', Icone: Download, aoTocar: exportar },
          !!aoRenegociar && {
            rotulo: 'Renegociar', detalhe: semRenegociar ?? 'Junta as cobranças de um aluno num acordo, em parcelas.', Icone: Handshake,
            desabilitado: !!semRenegociar, aoTocar: () => aoRenegociar([...lote]),
          },
          { rotulo: 'Cancelar cobranças', detalhe: 'Deixam de valer. Não tem volta.', Icone: Ban, perigo: true, aoTocar: () => { setMotivo(''); setErro(null); setCancelando(true); } },
        ]} />
      ) : null}
      <PainelConfirmacao visivel={cancelando} perigo titulo={`Cancelar ${quantas(n)}?`}
        mensagem={`${n === 1 ? 'A cobrança deixa' : `As ${n} cobranças deixam`} de valer e ${n === 1 ? 'sai' : 'saem'} das contas de recebimento. Soma dos valores: ${centavosParaTela(totalDoLote(lote)).replace('R$ ', 'R$\u00a0')}. Não tem volta: para cobrar de novo, gere outra cobrança.`}
        rotuloConfirmar={`Cancelar ${quantas(n)}`} rotuloCancelar="Voltar" carregando={ocupado === 'CANCELAR'}
        aoConfirmar={cancelar} aoCancelar={() => { if (ocupado !== 'CANCELAR') setCancelando(false); }}>
        <Campo rotulo="Motivo (opcional)" valor={motivo} aoMudar={setMotivo} linhas={2} maxLength={LIMITES.motivo}
          ajuda="Vai para todas. Só a equipe vê; o aluno não." />
        {erro ? (
          <>
            <MensagemErro texto={textoDoErro(erro)} erro={erro} />
            <Texto variante="suave">Nada foi cancelado por este envio.</Texto>
          </>
        ) : null}
      </PainelConfirmacao>
    </>
  );
}

export interface ResultadoDaAcao { acao: AcaoDoLote; resumo: ResumoDaAcaoEmLote; enviadas: CobrancaResponse[] }

/**
 * Resultado de cada cobrança (✓ ou ✕ com o motivo); nos links, o endereço de cada uma para copiar, e todos de uma vez. Link
 * que falhou por algo que passa (InfinitePay fora, sem resposta) tem "Tentar de novo as que falharam": só essas vão de novo,
 * e o resultado novo entra no lugar delas (os links que já tinham saído continuam).
 */
export function FolhaDoResultadoDaAcao({ acao, resumo: doLote, enviadas, aoFechar }: ResultadoDaAcao & { aoFechar: () => void }) {
  const { avisar } = useAviso();
  const [resumo, setResumo] = useState(doLote);
  const [tentando, setTentando] = useState(false);
  const trava = useRef(false);
  const porId = new Map(enviadas.map((c) => [c.id, c]));
  const links = linksGerados(resumo);
  const deNovo = acao === 'LINK' ? linksParaTentarDeNovo(resumo) : [];
  const copiar = (texto: string, sucesso: string) => {
    // O navegador pode recusar a escrita; os links estão na tela, selecionáveis, para copiar à mão.
    void copiarTexto(texto).then((ok) => avisar(ok ? sucesso : 'Não foi possível copiar sozinho. Selecione o link na lista e copie à mão.', ok ? 'sucesso' : 'neutro'));
  };
  const tentarDeNovo = () => {
    if (trava.current || deNovo.length === 0) return;
    trava.current = true;
    setTentando(true);
    const ids = deNovo;
    gerarLinksEmLote({ cobrancaIds: ids }).then(
      ({ resultados }) => setResumo((antes) => juntarTentativa('LINK', antes, resumoDaAcaoEmLote('LINK', ids, resultados))),
      (e: unknown) => avisar(textoDoErro(e), 'perigo'),
    ).finally(() => {
      trava.current = false;
      setTentando(false);
    });
  };
  return (
    <Folha visivel titulo={acao === 'LINK' ? 'Links de pagamento' : 'Resultado do cancelamento'} aoFechar={aoFechar}
      rodape={links.length > 1 ? (
        <>
          <Botao rotulo="Fechar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo={`Copiar os ${links.length} links`} Icone={Copy} aoTocar={() => copiar(links.join('\n'), 'Links copiados, um por linha.')} />
        </>
      ) : <Botao rotulo="Fechar" aoTocar={aoFechar} />}>
      <View style={estilos.coluna}>
        {/* Âmbar na falha parcial e vermelho quando nada passou: nunca o verde de "tudo certo". */}
        <View aria-live="polite"><Alerta tom={resumo.tom} texto={resumo.texto} /></View>
        {acao === 'CANCELAR' && resumo.falhas > 0 ? <Texto variante="suave">As que falharam continuam selecionadas na lista.</Texto> : null}
        {deNovo.length > 0 ? (
          <LinhaDeAcoes>
            <Botao rotulo={deNovo.length === 1 ? 'Tentar de novo a que falhou' : `Tentar de novo as ${deNovo.length} que falharam`} tipo="secundario"
              Icone={RotateCw} carregando={tentando} aoTocar={tentarDeNovo} />
          </LinhaDeAcoes>
        ) : null}
        <View role="list" accessibilityLabel="Resultado de cada cobrança">
          {resumo.itens.map((r, i) => {
            const c = porId.get(r.cobrancaId);
            const nome = c?.alunoNome ?? 'aluno';
            return (
              <View key={r.cobrancaId} role="listitem">
                {i > 0 ? <Divisor /> : null}
                <View style={estilos.item}>
                  <MarcaDoResultado ok={r.ok} />
                  <View style={estilos.quem}>
                    <Texto variante="bloco" numberOfLines={2}>{c?.alunoNome ?? '—'}</Texto>
                    <Texto variante="suave" numerico>{c ? `${referenciaDaCobranca(c)} · ${centavosParaTela(c.valorCentavos)}` : '—'}</Texto>
                    {r.url ? <Texto variante="pequeno" selectable numberOfLines={2}>{r.url}</Texto>
                      : <Texto variante={r.ok ? 'suave' : 'rotulo'}>{r.ok ? 'Cancelada' : `${acao === 'LINK' ? 'Sem link' : 'Não cancelada'}: ${r.motivo}`}</Texto>}
                  </View>
                  {r.url ? <IconeBotao Icone={Copy} rotulo={`Copiar link de ${nome}`} aoTocar={() => copiar(r.url ?? '', 'Link copiado.')} /> : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), paddingVertical: espaco(1) },
  quem: { flex: 1, minWidth: 0, gap: 2 },
});
