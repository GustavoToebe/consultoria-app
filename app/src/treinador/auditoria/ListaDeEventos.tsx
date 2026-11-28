import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { EventoAuditoria } from '../../api/equipeTipos';
import { categoriaDaAcao, COR_DA_CATEGORIA } from '../../dominio/categoriasDeAuditoria';
import { horaEmBrasilia, resumoDaLinha, type GrupoDoDia } from '../../dominio/resumoDeAuditoria';
import { useTema } from '../../tema/TemaProvider';
import { BORDA_BLOCO, espaco, fontes, RAIO } from '../../tema/tokens';
import { IniciaisDePerfil } from '../../ui/FotoDePerfil';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { ACOES_AUDITORIA } from '../equipe/acoesAuditoria';

/** Abaixo desta largura (da própria lista) as linhas viram cartões, como a `Tabela` (760 px, quatro colunas). */
const LARGURA_DA_TABELA = 760;
const TAMANHO_DAS_INICIAIS = 28;

export const nomeDaAcao = (codigo: string) => ACOES_AUDITORIA[codigo] ?? 'Ação registrada';

/** A cor da bolinha da categoria: a de identificação, ou `textoSuave` (Acesso e código que o app ainda não conhece). */
export function useCorDaCategoria() {
  const { cores, identificacao } = useTema();
  return (codigo: string) => {
    const categoria = categoriaDaAcao(codigo);
    const chave = categoria ? COR_DA_CATEGORIA[categoria] : null;
    return chave ? identificacao[chave].cor : cores.textoSuave;
  };
}

/** Bolinha da categoria; decorativa (o nome da categoria vai em texto no detalhe). */
export function BolinhaDaCategoria({ cor }: { cor: string }) {
  return <View aria-hidden style={[estilos.bolinha, { backgroundColor: cor }]} />;
}

interface Props {
  grupos: readonly GrupoDoDia[];
  selecionadoId: string | null;
  aoEscolher: (evento: EventoAuditoria) => void;
}

/**
 * Eventos da Auditoria agrupados por dia (27/11). Peça própria em vez da `ui/Tabela`: ela não tem linha de grupo nem linha
 * selecionada, e uma tabela por dia repetiria o cabeçalho e o nome acessível. A partir de 760 px é UMA tabela ("Eventos da
 * auditoria") com o cabeçalho uma vez e um `rowgroup` por dia com o subtítulo (h2); abaixo, uma lista de cartões com o
 * mesmo subtítulo (h2: o cartão não tem mais o título "Eventos", 28/11). A linha inteira abre o detalhe (clique, Enter)
 * e a escolhida fica com a seleção neutra (`sobre`, ação em negrito e o indicador pequeno da marca, como o índice da
 * Ajuda; `aria-selected`).
 */
export function ListaDeEventos({ grupos, selecionadoId, aoEscolher }: Props) {
  const { cores, bordas, marcaPeca } = useTema();
  const corDe = useCorDaCategoria();
  const [largura, setLargura] = useState<number | null>(null);
  const emCartoes = largura !== null && largura < LARGURA_DA_TABELA;
  // Seleção neutra, como o índice da Ajuda: `sobre`, a ação em negrito e o indicador pequeno da marca à esquerda.
  const indicador = <View aria-hidden style={[estilos.indicador, { backgroundColor: marcaPeca }]} />;

  if (largura === null || !emCartoes) {
    return (
      <View role="table" aria-label="Eventos da auditoria" onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
        style={[estilos.tabela, { borderColor: cores.divisor, borderWidth: bordas.bloco }]}>
        {largura === null ? null : (
          <>
            <View role="row" style={[estilos.linha, estilos.cabecalho, { backgroundColor: cores.superficie3, borderColor: cores.bordaCampo }]}>
              {COLUNAS.map((c) => (
                <View key={c.chave} role="columnheader" style={c.estilo}><Texto variante="secao">{c.titulo}</Texto></View>
              ))}
            </View>
            {grupos.map((g, i) => (
              <View key={g.dia} role="rowgroup" aria-label={g.titulo}>
                <View role="row" style={[estilos.dia, i > 0 ? { borderTopWidth: 1, borderColor: cores.divisor } : null, { backgroundColor: cores.superficie2 }]}>
                  <View role="cell"><Texto variante="rotulo" nivel={2}>{g.titulo}</Texto></View>
                </View>
                {g.eventos.map((e) => {
                  const escolhida = e.id === selecionadoId;
                  const resumo = resumoDaLinha(e);
                  return (
                    <Pressable key={e.id} role="row" aria-selected={escolhida} onPress={() => aoEscolher(e)}
                      style={(estado) => [estilos.linha, estilos.evento, { borderTopColor: cores.divisor }, escolhida || sobre(estado) ? { backgroundColor: cores.sobre } : null]}>
                      {escolhida ? indicador : null}
                      <View role="cell" style={COLUNAS[0].estilo}><Texto variante="suave" numerico>{horaEmBrasilia(e.criadoEm)}</Texto></View>
                      <View role="cell" style={[COLUNAS[1].estilo, estilos.comMarca]}>
                        <IniciaisDePerfil nome={e.nomeUsuario} tamanho={TAMANHO_DAS_INICIAIS} />
                        <Texto numberOfLines={1} style={[estilos.encolhe, { fontFamily: fontes.medio }]}>{e.nomeUsuario}</Texto>
                      </View>
                      <View role="cell" style={[COLUNAS[2].estilo, estilos.comMarca]}>
                        <BolinhaDaCategoria cor={corDe(e.acao)} />
                        <Texto style={[estilos.encolhe, escolhida ? { fontFamily: fontes.semi } : null]}>{nomeDaAcao(e.acao)}</Texto>
                      </View>
                      <View role="cell" style={COLUNAS[3].estilo}><Texto variante="suave">{resumo || '—'}</Texto></View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </>
        )}
      </View>
    );
  }

  return (
    <View accessibilityRole="list" aria-label="Eventos da auditoria" onLayout={(e) => setLargura(e.nativeEvent.layout.width)} style={estilos.cartoes}>
      {grupos.map((g) => (
        <View key={g.dia} style={estilos.grupoDeCartoes}>
          <Texto variante="rotulo" nivel={2}>{g.titulo}</Texto>
          {g.eventos.map((e) => {
            const escolhida = e.id === selecionadoId;
            const resumo = resumoDaLinha(e);
            const hora = horaEmBrasilia(e.criadoEm);
            return (
              <Pressable key={e.id} accessibilityRole="button" accessibilityState={{ selected: escolhida }}
                accessibilityLabel={`${hora}, ${nomeDaAcao(e.acao)}, por ${e.nomeUsuario}${resumo ? `, ${resumo}` : ''}`}
                onPress={() => aoEscolher(e)}
                style={(estado) => [estilos.cartao, { backgroundColor: escolhida || sobre(estado) ? cores.sobre : cores.superficie2, borderColor: escolhida ? cores.bordaCampo : cores.divisor }]}>
                {escolhida ? indicador : null}
                <View style={estilos.topoDoCartao}>
                  <View style={[estilos.comMarca, estilos.encolhe]}>
                    <BolinhaDaCategoria cor={corDe(e.acao)} />
                    <Texto style={[estilos.encolhe, { fontFamily: escolhida ? fontes.semi : fontes.medio }]}>{nomeDaAcao(e.acao)}</Texto>
                  </View>
                  <Texto variante="suave" numerico>{hora}</Texto>
                </View>
                <View style={estilos.comMarca}>
                  <IniciaisDePerfil nome={e.nomeUsuario} tamanho={24} />
                  <Texto variante="suave" numberOfLines={2} style={estilos.encolhe}>{/* "R$" colado ao número: no cartão de 390 px ele ficava sozinho no fim da linha (o mesmo das Cobranças). */}
                    {resumo ? `${e.nomeUsuario} · ${resumo.replace(/R\$ /g, 'R$ ')}` : e.nomeUsuario}</Texto>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/**
 * Quando (só a hora: o dia é o subtítulo do grupo), Quem, Ação e Resumo, cada uma com teto (80, 260, 380 e 640 px): em
 * 1920 ou 3440 px o olho não atravessa meia tela entre o nome e a ação, e o que sobra fica no fim da linha, não entre as
 * colunas (o `justifyContent` padrão). Os mínimos somam bem menos que os 760 px do corte para cartões.
 */
const COLUNAS = [
  { chave: 'quando', titulo: 'Quando', estilo: { width: 80, flexShrink: 0 } },
  { chave: 'quem', titulo: 'Quem', estilo: { flex: 1, minWidth: 180, maxWidth: 260 } },
  { chave: 'acao', titulo: 'Ação', estilo: { flex: 1.4, minWidth: 200, maxWidth: 380 } },
  { chave: 'resumo', titulo: 'Resumo', estilo: { flex: 2, minWidth: 160, maxWidth: 640 } },
] as const;

const estilos = StyleSheet.create({
  tabela: { borderWidth: BORDA_BLOCO, borderRadius: RAIO, overflow: 'hidden' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(2), paddingHorizontal: espaco(1.5), minHeight: 48 },
  cabecalho: { borderBottomWidth: 1, minHeight: 40 },
  // O fio em cima de cada linha (também entre o subtítulo do dia e a primeira dele).
  evento: { borderTopWidth: 1, paddingVertical: espaco(0.75) },
  indicador: { position: 'absolute', left: 0, top: '50%', marginTop: -8, width: 3, height: 16, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  dia: { paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.75) },
  comMarca: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  encolhe: { flexShrink: 1, minWidth: 0 },
  bolinha: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  cartoes: { gap: espaco(3) },
  grupoDeCartoes: { gap: espaco(1) },
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.75) },
  topoDoCartao: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espaco(1) },
});
