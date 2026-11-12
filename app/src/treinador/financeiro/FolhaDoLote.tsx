import { Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CobrancaResponse, FormaDePagamento } from '../../api/financeiroTipos';
import { listarCobrancasDoAluno, registrarPagamentosEmLote } from '../../api/rotas';
import {
  FORMAS_MANUAIS, hojeEmBrasilia, LIMITES, podeEntrarNoLote, problemaDoLote, resumoDoLote, rotuloDaForma, totalDoLote,
  validarBaixa, type ResumoDoLote,
} from '../../dominio/financeiro';
import { centavosParaTela, dataDaTela, dataParaTela } from '../../dominio/formatos';
import { rotuloDoMes } from '../../dominio/numeros';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoData } from '../../ui/Campos';
import { Divisor } from '../../ui/Divisor';
import { Escolha } from '../../ui/Escolha';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';

const OPCOES_DE_FORMA = FORMAS_MANUAIS.map((f) => ({ valor: f.valor as FormaDePagamento | null, rotulo: f.rotulo }));

/**
 * Registrar pagamentos em lote (`POST /cobrancas/baixa-em-lote`). A revisão é obrigatória: a folha lista cada cobrança
 * (aluno, competência, vencimento, valor), o total dos valores mostrados e os campos de data e forma, que valem para todas;
 * o envio ainda passa por um `PainelConfirmacao`. O valor nunca vai no pedido (é o do servidor). Depois, o resultado de
 * cada uma (✓ ou ✕ com o motivo); falha parcial aparece em âmbar ("2 de 3 registrados"), nunca como sucesso. "Tentar de
 * novo" relê só as que falharam (versão nova; a que não está mais em aberto sai com aviso) e volta à revisão.
 * Quem chamou guarda a seleção: `aoTirar` tira uma, `aoRegistrar` recebe as que deram certo (saem da seleção e a lista
 * recarrega) e `aoTrocar` põe as relidas no lugar.
 */
export function FolhaDoLote({ itens, aoTirar, aoRegistrar, aoTrocar, aoFechar }: {
  itens: readonly CobrancaResponse[];
  aoTirar: (id: string) => void;
  aoRegistrar: (registrados: string[]) => void;
  aoTrocar: (novos: CobrancaResponse[]) => void;
  aoFechar: () => void;
}) {
  const [data, setData] = useState(dataParaTela(hojeEmBrasilia()));
  const [forma, setForma] = useState<FormaDePagamento | null>('PIX_DIRETO');
  const [observacao, setObservacao] = useState('');
  const [tentou, setTentou] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  /** O resultado do último envio, com as cobranças como estavam (os nomes não somem quando saem da seleção). */
  const [resultado, setResultado] = useState<{ resumo: ResumoDoLote; enviadas: CobrancaResponse[] } | null>(null);
  const [saidas, setSaidas] = useState<string | null>(null);
  const [relendo, setRelendo] = useState(false);

  const hoje = hojeEmBrasilia();
  const iso = dataDaTela(data);
  const erroDaBaixa = validarBaixa({ data: iso ?? null, forma }, hoje);
  const problema = problemaDoLote(itens.length);
  const total = totalDoLote(itens);
  const n = itens.length;
  const rotuloDoEnvio = n === 1 ? 'Registrar 1 pagamento' : `Registrar ${n} pagamentos`;

  const revisar = () => {
    setTentou(true);
    if (erroDaBaixa || problema) return;
    setErro(null);
    setConfirmando(true);
  };

  const enviar = () => {
    if (!iso || !forma || problema) return;
    const enviadas = [...itens];
    setEnviando(true);
    setErro(null);
    registrarPagamentosEmLote({
      itens: enviadas.map((c) => ({ cobrancaId: c.id, versao: c.versao })), data: iso, forma, observacao: observacao.trim() || null,
    }).then(
      ({ resultados }) => {
        const resumo = resumoDoLote(enviadas.map((c) => c.id), resultados);
        setEnviando(false);
        setConfirmando(false);
        setSaidas(null);
        setResultado({ resumo, enviadas });
        aoRegistrar(resumo.itens.filter((i) => i.ok).map((i) => i.cobrancaId));
      },
      (e: unknown) => {
        // O pedido inteiro foi recusado (ou não chegou): nada foi registrado por este envio. Repetir é seguro (já paga = ok).
        setEnviando(false);
        setErro(e);
      },
    );
  };

  /** Relê as que falharam (versão atual); só as ainda em aberto voltam à revisão. */
  const tentarDeNovo = () => {
    setRelendo(true);
    setErro(null);
    const alunos = [...new Set(itens.map((c) => c.alunoId))];
    Promise.all(alunos.map((id) => listarCobrancasDoAluno(id))).then(
      (listas) => {
        const atuais = new Map(listas.flat().map((c) => [c.id, c]));
        const novos = itens.map((c) => atuais.get(c.id)).filter((c): c is CobrancaResponse => !!c && podeEntrarNoLote(c));
        const fora = n - novos.length;
        setRelendo(false);
        setSaidas(fora === 0 ? null : fora === 1 ? '1 cobrança saiu do lote: não está mais em aberto.'
          : `${fora} cobranças saíram do lote: não estão mais em aberto.`);
        setResultado(null);
        setTentou(false);
        aoTrocar(novos);
      },
      (e: unknown) => { setRelendo(false); setErro(e); },
    );
  };

  if (resultado) {
    const { resumo, enviadas } = resultado;
    const porId = new Map(enviadas.map((c) => [c.id, c]));
    return (
      <Folha visivel titulo="Resultado do registro" aoFechar={aoFechar}
        rodape={resumo.falhas > 0 ? (
          <>
            <Botao rotulo="Fechar" tipo="secundario" aoTocar={aoFechar} desabilitado={relendo} />
            <Botao rotulo={resumo.falhas === 1 ? 'Tentar de novo a que falhou' : `Tentar de novo as ${resumo.falhas} que falharam`}
              carregando={relendo} aoTocar={tentarDeNovo} />
          </>
        ) : <Botao rotulo="Fechar" aoTocar={aoFechar} />}>
        <View style={estilos.coluna}>
          {/* Âmbar na falha parcial e vermelho quando nada passou: nunca o verde de "tudo certo". */}
          <View aria-live="polite"><Alerta tom={resumo.tom} texto={resumo.texto} /></View>
          {resumo.falhas > 0 ? (
            <Texto variante="suave">As que falharam continuam selecionadas na lista. Tentar de novo relê cada uma antes de enviar.</Texto>
          ) : null}
          <View role="list" accessibilityLabel="Resultado de cada cobrança" style={estilos.lista}>
            {resumo.itens.map((r, i) => {
              const c = porId.get(r.cobrancaId);
              return (
                <View key={r.cobrancaId} role="listitem" style={estilos.itemComDivisor}>
                  {i > 0 ? <Divisor /> : null}
                  <View style={estilos.item}>
                    <MarcaDoResultado ok={r.ok} />
                    <View style={estilos.quem}>
                      <Texto variante="bloco" numberOfLines={2}>{c?.alunoNome ?? '—'}</Texto>
                      <Texto variante="suave" numerico>{c ? rotuloDoMes(c.competencia) : '—'} · {c ? centavosParaTela(c.valorCentavos) : '—'}</Texto>
                      <Texto variante={r.ok ? 'suave' : 'rotulo'}>{r.ok ? (r.motivo ?? 'Registrado') : `Não registrado: ${r.motivo}`}</Texto>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
          {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
        </View>
      </Folha>
    );
  }

  const dataInvalida = tentou && (!iso || iso > hoje) ? erroDaBaixa : null;
  return (
    <Folha visivel titulo="Revisar pagamentos" aoFechar={aoFechar}
      rodape={(
        <>
          <Botao rotulo="Voltar" tipo="secundario" aoTocar={aoFechar} desabilitado={enviando} />
          <Botao rotulo={rotuloDoEnvio} aoTocar={revisar} desabilitado={!!problema} motivo={problema ?? undefined} />
        </>
      )}>
      <View style={estilos.coluna}>
        {saidas ? <Alerta tom="atencao" texto={saidas} /> : null}
        <Texto variante="suave">
          Confira as cobranças. A mesma data e a mesma forma valem para todas; o valor de cada uma é o da cobrança.
        </Texto>
        {n === 0 ? <Texto>Nenhuma cobrança no lote.</Texto> : (
          <View role="list" accessibilityLabel="Cobranças do lote" style={estilos.lista}>
            {itens.map((c, i) => (
              <View key={c.id} role="listitem" style={estilos.itemComDivisor}>
                {i > 0 ? <Divisor /> : null}
                <View style={estilos.item}>
                  <View style={estilos.quem}>
                    <Texto variante="bloco" numberOfLines={2}>{c.alunoNome ?? '—'}</Texto>
                    <Texto variante="suave" numerico>{rotuloDoMes(c.competencia)} · vence {dataParaTela(c.vencimento)}</Texto>
                  </View>
                  <Texto numerico style={estilos.valor}>{centavosParaTela(c.valorCentavos)}</Texto>
                  <IconeBotao Icone={X} rotulo={`Tirar do lote: ${c.alunoNome ?? 'aluno'}, ${rotuloDoMes(c.competencia)}`}
                    aoTocar={() => aoTirar(c.id)} desabilitado={enviando} />
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={estilos.total} accessibilityLabel={`Total: ${centavosParaTela(total)}, soma dos valores mostrados`}>
          <View style={estilos.quem}>
            <Texto variante="rotulo">Total</Texto>
            <Texto variante="pequeno">Soma dos valores mostrados</Texto>
          </View>
          <Texto variante="destaque" numerico>{centavosParaTela(total)}</Texto>
        </View>
        <Divisor />
        {/* Empilhadas como na baixa de uma cobrança: as quatro formas não cabem ao lado da data na folha. */}
        <CampoData rotulo="Data do pagamento" valor={data} aoMudar={setData} erro={dataInvalida} />
        <Escolha rotulo="Forma de pagamento" opcoes={OPCOES_DE_FORMA} valor={forma} aoMudar={setForma} />
        <Campo rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} linhas={2} maxLength={LIMITES.observacao}
          ajuda="Vai para todas as cobranças do lote. Só a equipe vê; o aluno não." />
        {erro && !confirmando ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </View>
      <PainelConfirmacao visivel={confirmando} titulo={`${rotuloDoEnvio}?`}
        mensagem={`Cada cobrança recebe a baixa de ${data}, forma ${rotuloDaForma(forma)}. Soma dos valores: ${centavosParaTela(total)}. Para desfazer, é uma a uma, na folha da cobrança.`}
        rotuloConfirmar={rotuloDoEnvio} rotuloCancelar="Voltar" carregando={enviando}
        aoConfirmar={enviar} aoCancelar={() => { setConfirmando(false); setErro(null); }}>
        {erro && confirmando ? (
          <>
            <MensagemErro texto={textoDoErro(erro)} erro={erro} />
            <Texto variante="suave">Nada foi registrado por este envio. Pode tentar de novo: o que já estiver pago não é registrado duas vezes.</Texto>
          </>
        ) : null}
      </PainelConfirmacao>
    </Folha>
  );
}

/** ✓ ou ✕ ao lado do nome; o texto embaixo diz o que houve (a cor e o ícone nunca falam sozinhos). */
function MarcaDoResultado({ ok }: { ok: boolean }) {
  const { cores } = useTema();
  const Icone = ok ? Check : X;
  return <View style={estilos.marca}><Icone size={20} color={ok ? cores.sucesso : cores.perigo} strokeWidth={2.5} aria-hidden /></View>;
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  lista: { gap: 0 },
  itemComDivisor: { gap: 0 },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), paddingVertical: espaco(1) },
  quem: { flex: 1, minWidth: 0, gap: 2 },
  valor: { flexShrink: 0 },
  total: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  marca: { width: 24, alignItems: 'center', alignSelf: 'flex-start', paddingTop: 2 },
});
