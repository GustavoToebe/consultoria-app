import { Check, Copy, Download } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { gerarConvitesEmLote, type ResultadoDoConvite } from '../../api/convitesEmLote';
import {
  AVISO_DO_CSV, AVISO_DOS_LINKS, csvDosConvites, dividirEmLotesDe100, linkDoWhatsApp, mensagemDaConfirmacao, mensagemDoConvite,
  MOTIVO_SEM_TELEFONE, nomeDoCsv, resumoDosResultados, textoDoLoteQueFalhou, textoDoProgresso, type ConviteGerado,
} from '../../dominio/convitesEmLote';
import { hojeIso, SEM_DADO } from '../../dominio/formatos';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, LARGURA_FOLHA_LARGA } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Alerta } from '../../ui/Estados';
import { erroDeConexao, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { iconeWhatsApp } from '../../ui/IconeWhatsApp';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { baixarCsv } from '../financeiro/baixarCsv';
import { copiarTexto } from '../financeiro/comum';

interface Falha { numero: number; total: number; ids: string[]; motivo: string }
/** Confirmar (com os ids desta rodada), gerando (lote a lote, em sequência) ou pronto (a folha com o resultado). */
type Fase = { tipo: 'confirmar'; ids: string[] } | { tipo: 'gerando'; feitos: number; total: number } | { tipo: 'pronto' };

interface Props {
  /** Os marcados na lista (qualquer quantidade: o app divide em chamadas de 100). */
  alunoIds: string[];
  /** Cancelou a confirmação ou fechou a folha: o estado (e os links) some junto. */
  aoFechar: () => void;
}

/**
 * Convite de acesso em lote: confirmação → chamadas de 100 em sequência, com o progresso → folha "Convites gerados". Lote que
 * falhou fica listado com "Tentar de novo" só para ele, que passa pela confirmação de novo (gerar outra vez invalida o link
 * anterior). Os links vivem só neste estado: nada no aparelho, no endereço ou em log; fechar descarta.
 */
export function ConvitesEmLote({ alunoIds, aoFechar }: Props) {
  const { marca } = useSessao();
  const { avisar } = useAviso();
  const [fase, setFase] = useState<Fase>({ tipo: 'confirmar', ids: alunoIds });
  const [resultados, setResultados] = useState<ReadonlyMap<string, ResultadoDoConvite>>(new Map());
  const [falhas, setFalhas] = useState<Falha[]>([]);
  const [jaGerou, setJaGerou] = useState(false);
  const [enviados, setEnviados] = useState<ReadonlySet<string>>(new Set());

  const gerando = fase.tipo === 'gerando';
  // Trava síncrona: dois toques antes do próximo desenho gerariam duas vezes (e o segundo invalidaria os links do primeiro).
  const emAndamento = useRef(false);
  const gerar = async (ids: string[]) => {
    if (emAndamento.current || ids.length === 0) return;
    emAndamento.current = true;
    const lotes = dividirEmLotesDe100(ids);
    const novasFalhas: Falha[] = [];
    let feitos = 0;
    setFase({ tipo: 'gerando', feitos, total: ids.length });
    for (const [i, lote] of lotes.entries()) {
      try {
        const r = await gerarConvitesEmLote(lote);
        setResultados((antes) => new Map([...antes, ...r.resultados.map((x) => [x.alunoId, x] as const)]));
      } catch (e) {
        novasFalhas.push({ numero: i + 1, total: lotes.length, ids: lote, motivo: erroDeConexao(e) ? 'Sem conexão: confira a internet.' : textoDoErro(e) });
      }
      feitos += lote.length;
      setFase({ tipo: 'gerando', feitos, total: ids.length });
    }
    // A rodada cobre exatamente as falhas anteriores (o "Tentar de novo" só pede elas): as novas substituem as antigas.
    setFalhas(novasFalhas);
    setJaGerou(true);
    setFase({ tipo: 'pronto' });
    emAndamento.current = false;
  };

  const cancelarConfirmacao = () => {
    if (gerando) return;
    if (jaGerou) setFase({ tipo: 'pronto' });
    else aoFechar();
  };
  const fechar = () => { if (!gerando) aoFechar(); };

  const idsQueFalharam = new Set(falhas.flatMap((f) => f.ids));
  const resumo = resumoDosResultados(alunoIds.filter((id) => !idsQueFalharam.has(id)), [...resultados.values()]);
  const consultoria = marca?.nome ?? null;

  const baixar = () => {
    baixarCsv(nomeDoCsv(hojeIso()), csvDosConvites(resumo.gerados)).then(
      () => avisar('CSV dos convites baixado.', 'sucesso'),
      (e: unknown) => avisar(e instanceof Error ? e.message : 'Não foi possível baixar o arquivo.', 'perigo'),
    );
  };
  const marcarEnviado = (id: string, marcado: boolean) => setEnviados((antes) => {
    const novo = new Set(antes);
    if (marcado) novo.add(id); else novo.delete(id);
    return novo;
  });

  const idsDaConfirmacao = fase.tipo === 'confirmar' ? fase.ids : [];
  const painel = (
    <PainelConfirmacao
      visivel={fase.tipo !== 'pronto'}
      titulo="Gerar convites de acesso?"
      mensagem={mensagemDaConfirmacao(fase.tipo === 'gerando' ? fase.total : idsDaConfirmacao.length)}
      rotuloConfirmar="Gerar convites"
      carregando={gerando}
      aoConfirmar={() => { void gerar(idsDaConfirmacao); }}
      aoCancelar={cancelarConfirmacao}>
      {fase.tipo === 'gerando' ? (
        <Texto numerico accessibilityLiveRegion="polite" aria-live="polite">{textoDoProgresso(fase.feitos, fase.total)}</Texto>
      ) : null}
    </PainelConfirmacao>
  );

  if (!jaGerou) return painel;
  const qtdFalhas = idsQueFalharam.size;
  return (
    // shortcut: centenas de linhas numa rolagem só (sem lista virtual dentro da Folha); trocar por FlatList se a folha pesar com 500+ convites.
    <Folha visivel titulo="Convites gerados" aoFechar={fechar} largura={LARGURA_FOLHA_LARGA} telaCheiaNoCelular
      faixa={<Texto variante="pequeno">{AVISO_DOS_LINKS}</Texto>}
      statusDoRodape={resumo.gerados.length ? <Texto variante="pequeno">{AVISO_DO_CSV}.</Texto> : undefined}
      rodape={(
        <>
          {/* O aviso do arquivo só entra no nome com arquivo a baixar, como no rodapé; vazio, o nome é só "Baixar CSV" e o motivo explica. */}
          <Botao rotulo="Baixar CSV" rotuloAcessivel={resumo.gerados.length ? `Baixar CSV. ${AVISO_DO_CSV}.` : undefined} tipo="secundario" Icone={Download}
            desabilitado={resumo.gerados.length === 0 || gerando} motivo={gerando ? undefined : 'Nenhum convite gerado.'} aoTocar={baixar} />
          <Botao rotulo="Concluir" desabilitado={gerando} aoTocar={fechar} />
        </>
      )}>
      <View style={estilos.resumo}>
        <Texto variante="bloco" numerico>{resumo.linhas[0]}</Texto>
        {resumo.linhas.length > 1 ? <Texto variante="suave" numerico>{resumo.linhas.slice(1).join(' · ')}</Texto> : null}
      </View>

      {falhas.length ? (
        <Alerta tom="perigo" titulo={qtdFalhas === 1 ? '1 aluno ficou sem convite' : `${qtdFalhas} alunos ficaram sem convite`}>
          {falhas.map((f) => <Texto key={f.numero} numerico>{`${textoDoLoteQueFalhou(f.numero, f.total, f.ids.length)} ${f.motivo}`}</Texto>)}
          <LinhaDeAcoes>
            <Botao rotulo={`Tentar de novo (${qtdFalhas})`} tipo="secundario" desabilitado={gerando}
              aoTocar={() => setFase({ tipo: 'confirmar', ids: falhas.flatMap((f) => f.ids) })} />
          </LinhaDeAcoes>
        </Alerta>
      ) : null}

      {resumo.gerados.length ? (
        <View>
          {resumo.gerados.map((c, i) => (
            <LinhaDoConvite key={c.alunoId} convite={c} consultoria={consultoria} primeira={i === 0}
              enviado={enviados.has(c.alunoId)} aoMarcar={(m) => marcarEnviado(c.alunoId, m)} />
          ))}
        </View>
      ) : null}

      {resumo.naoGerados.length ? (
        <View style={estilos.secao}>
          <Texto variante="bloco" nivel={3}>Não gerados</Texto>
          {resumo.naoGerados.map((n, i) => (
            <LinhaNaoGerado key={n.alunoId} nome={n.nome ?? SEM_DADO} motivo={n.motivo} primeira={i === 0} />
          ))}
        </View>
      ) : null}
      {painel}
    </Folha>
  );
}

/**
 * Um convite: nome, telefone e validade; "Enviar pelo WhatsApp" (`wa.me` com a mensagem, fora do app, sem token; sem telefone
 * válido fica desabilitado com o motivo), "Copiar mensagem" e o "Enviado", que é só uma marca visual desta folha (não vai à
 * API e não marca sozinho ao abrir o WhatsApp).
 */
function LinhaDoConvite({ convite, consultoria, enviado, aoMarcar, primeira }: {
  convite: ConviteGerado; consultoria: string | null; enviado: boolean; aoMarcar: (marcado: boolean) => void; primeira: boolean;
}) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const mensagem = mensagemDoConvite({ nome: convite.nome, consultoria, link: convite.link, validade: convite.validade });
  const whatsapp = linkDoWhatsApp(convite.telefone, mensagem);
  const abrir = () => { if (whatsapp) Linking.openURL(whatsapp).catch(() => avisar('Não foi possível abrir o WhatsApp.', 'perigo')); };
  const copiar = () => {
    void copiarTexto(mensagem).then((ok) => avisar(ok ? 'Mensagem copiada.' : 'Não foi possível copiar. Selecione o link e copie à mão.', ok ? 'sucesso' : 'perigo'));
  };
  return (
    <View style={[estilos.linha, primeira ? null : { borderTopWidth: 1, borderTopColor: cores.divisor }]}>
      <View style={estilos.dados}>
        <Texto variante="bloco" numberOfLines={2}>{convite.nome}</Texto>
        <Texto variante="suave" numerico>{`${convite.telefone ?? 'Sem telefone'} · Válido até ${convite.validade}`}</Texto>
        <Texto variante="pequeno" selectable numberOfLines={1}>{convite.link}</Texto>
      </View>
      <LinhaDeAcoes>
        <Botao rotulo="Enviar pelo WhatsApp" rotuloAcessivel={`Enviar pelo WhatsApp para ${convite.nome}`} tipo="secundario"
          Icone={iconeWhatsApp(!!whatsapp)} desabilitado={!whatsapp} motivo={MOTIVO_SEM_TELEFONE} aoTocar={abrir} />
        <Botao rotulo="Copiar mensagem" rotuloAcessivel={`Copiar mensagem para ${convite.nome}`} tipo="fantasma" Icone={Copy} aoTocar={copiar} />
        <MarcaDeEnviado nome={convite.nome} marcado={enviado} aoMudar={aoMarcar} />
      </LinhaDeAcoes>
    </View>
  );
}

/**
 * Caixa "Enviado" compacta. Componente local porque a `CaixaSelecao` usa o texto visível como nome acessível ("Enviado" se
 * repetiria em toda linha) e é uma linha inteira com borda, pesada para ficar ao lado dos botões.
 */
function MarcaDeEnviado({ nome, marcado, aoMudar }: { nome: string; marcado: boolean; aoMudar: (marcado: boolean) => void }) {
  const { cores } = useTema();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={`Enviado para ${nome}`} aria-checked={marcado}
      accessibilityState={{ checked: marcado }} onPress={() => aoMudar(!marcado)}
      style={({ pressed }) => [estilos.enviado, pressed ? { backgroundColor: cores.sobre } : null]}>
      <View style={[estilos.caixa, { backgroundColor: marcado ? cores.texto : cores.campo, borderColor: marcado ? cores.texto : cores.bordaCampo }]}>
        {marcado ? <Check size={16} color={cores.fundo} /> : null}
      </View>
      <Texto>Enviado</Texto>
    </Pressable>
  );
}

function LinhaNaoGerado({ nome, motivo, primeira }: { nome: string; motivo: string; primeira: boolean }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.naoGerado, primeira ? null : { borderTopWidth: 1, borderTopColor: cores.divisor }]}>
      <Texto numberOfLines={2}>{nome}</Texto>
      <Texto variante="suave">{motivo}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  resumo: { gap: espaco(0.5) },
  secao: { gap: espaco(1), marginTop: espaco(1.5) },
  linha: { gap: espaco(1), paddingVertical: espaco(1.5) },
  dados: { gap: espaco(0.5), minWidth: 0 },
  naoGerado: { gap: espaco(0.25), paddingVertical: espaco(1) },
  enviado: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1), borderRadius: 8 },
  caixa: { width: 22, height: 22, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});
