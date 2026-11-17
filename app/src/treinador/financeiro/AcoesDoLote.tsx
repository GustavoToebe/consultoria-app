import * as Clipboard from 'expo-clipboard';
import { Ban, Copy, Download, Ellipsis, Link2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CobrancaResponse } from '../../api/financeiroTipos';
import { cancelarCobrancasEmLote, exportarCobrancasSelecionadas, gerarLinksEmLote } from '../../api/rotas';
import {
  linksGerados, nomeDoCsvDasSelecionadas, resumoDaAcaoEmLote, textoDaExportacaoDasSelecionadas, type AcaoDoLote, type ResumoDaAcaoEmLote,
} from '../../dominio/acoesEmLote';
import { hojeEmBrasilia, LIMITES, problemaDoLote, referenciaDaCobranca, totalDoLote } from '../../dominio/financeiro';
import { centavosParaTela } from '../../dominio/formatos';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Divisor } from '../../ui/Divisor';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { baixarCsv } from './baixarCsv';
import { MarcaDoResultado } from './FolhaDoLote';

const quantas = (n: number) => (n === 1 ? '1 cobrança' : `${n} cobranças`);

/**
 * As ações em lote que não são a baixa (Fase 1 do financeiro), num menu secundário ao lado do "Revisar pagamentos" (o único
 * primário da barra): cancelar (`PainelConfirmacao` destrutivo, motivo opcional, não tem volta), gerar os links de pagamento
 * (só com o recebimento online ligado na plataforma) e exportar as selecionadas em CSV. A seleção é a mesma do lote de
 * baixa (só em aberto, que é o que as três aceitam). Cancelar e link mostram o resultado de cada uma, na ordem do pedido;
 * falha parcial nunca aparece como sucesso. Quem chamou recebe as canceladas (`aoCancelar`), que saem da seleção, e mostra
 * o resultado (`aoResultado` + `FolhaDoResultadoDaAcao`): esta barra some quando a seleção esvazia.
 */
export function AcoesDoLote({ lote, comLink, aoCancelar, aoResultado }: {
  lote: readonly CobrancaResponse[];
  comLink: boolean;
  aoCancelar: (cancelados: string[]) => void;
  aoResultado: (resultado: ResultadoDaAcao) => void;
}) {
  const { avisar } = useAviso();
  const [menu, setMenu] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState<AcaoDoLote | 'EXPORTAR' | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const n = lote.length;
  const problema = problemaDoLote(n);

  const cancelar = () => {
    if (ocupado || problema) return;
    const enviadas = [...lote];
    setOcupado('CANCELAR');
    setErro(null);
    cancelarCobrancasEmLote({ itens: enviadas.map((c) => ({ cobrancaId: c.id, versao: c.versao })), motivo: motivo.trim() || null }).then(
      ({ resultados }) => {
        const resumo = resumoDaAcaoEmLote('CANCELAR', enviadas.map((c) => c.id), resultados);
        setOcupado(null);
        setCancelando(false);
        aoResultado({ acao: 'CANCELAR', resumo, enviadas });
        aoCancelar(resumo.itens.filter((i) => i.ok).map((i) => i.cobrancaId));
      },
      // O pedido inteiro foi recusado (ou não chegou): fica no painel, com o motivo.
      (e: unknown) => { setOcupado(null); setErro(e); },
    );
  };

  const gerarLinks = () => {
    const enviadas = [...lote];
    setOcupado('LINK');
    gerarLinksEmLote({ cobrancaIds: enviadas.map((c) => c.id) }).then(
      ({ resultados }) => {
        setOcupado(null);
        aoResultado({ acao: 'LINK', resumo: resumoDaAcaoEmLote('LINK', enviadas.map((c) => c.id), resultados), enviadas });
      },
      (e: unknown) => { setOcupado(null); avisar(textoDoErro(e), 'perigo'); },
    );
  };

  const exportar = () => {
    setOcupado('EXPORTAR');
    exportarCobrancasSelecionadas({ cobrancaIds: lote.map((c) => c.id) })
      .then((texto) => baixarCsv(nomeDoCsvDasSelecionadas(hojeEmBrasilia()), texto))
      .then(() => avisar(textoDaExportacaoDasSelecionadas(n), 'sucesso'), (e: unknown) => avisar(textoDoErro(e), 'perigo'))
      .finally(() => setOcupado(null));
  };

  return (
    <>
      <Botao rotulo="Mais ações" tipo="secundario" Icone={Ellipsis} carregando={ocupado === 'LINK' || ocupado === 'EXPORTAR'}
        desabilitado={!!problema} motivo={problema ?? undefined} aoTocar={() => setMenu(true)} />
      {menu ? (
        <FolhaDeAcoes titulo={`Ações com ${quantas(n)}`} aoFechar={() => setMenu(false)} acoes={[
          comLink && { rotulo: 'Gerar links de pagamento', detalhe: 'Um link da InfinitePay para cada uma, para você mandar ao aluno.', Icone: Link2, aoTocar: gerarLinks },
          { rotulo: 'Exportar selecionadas', detalhe: 'Baixa um CSV só com estas cobranças.', Icone: Download, aoTocar: exportar },
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

/** Resultado de cada cobrança (✓ ou ✕ com o motivo); nos links, o endereço de cada uma para copiar, e todos de uma vez. */
export function FolhaDoResultadoDaAcao({ acao, resumo, enviadas, aoFechar }: ResultadoDaAcao & { aoFechar: () => void }) {
  const { avisar } = useAviso();
  const porId = new Map(enviadas.map((c) => [c.id, c]));
  const links = linksGerados(resumo);
  const copiar = (texto: string, sucesso: string) => {
    // O navegador pode recusar a escrita; os links estão na tela, selecionáveis, para copiar à mão.
    Clipboard.setStringAsync(texto).then(
      () => avisar(sucesso, 'sucesso'),
      () => avisar('Não foi possível copiar sozinho. Selecione o link e copie à mão.', 'neutro'),
    );
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
