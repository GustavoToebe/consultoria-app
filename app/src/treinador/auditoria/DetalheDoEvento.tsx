import { X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import type { EventoAuditoria } from '../../api/equipeTipos';
import { categoriaDaAcao, ROTULO_DA_CATEGORIA } from '../../dominio/categoriasDeAuditoria';
import { rotaDoObjeto, rotuloDoTipo, textoDoObjeto } from '../../dominio/objetoDaAuditoria';
import { quandoCompleto } from '../../dominio/resumoDeAuditoria';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LINHA_DA_FAIXA, RAIO } from '../../tema/tokens';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinkTexto } from '../../ui/LinkTexto';
import { Texto } from '../../ui/Texto';
import { BolinhaDaCategoria, nomeDaAcao, useCorDaCategoria } from './ListaDeEventos';

/** Largura do detalhe fixo ao lado da tabela, a partir da faixa `larga` (o pedido: ~420 px). */
export const LARGURA_DO_PAINEL_DO_EVENTO = 420;
const TITULO = 'Detalhe do evento';

/**
 * O que a auditoria guarda de um evento, e nada além: a ação (com a categoria em texto), quem (nome · perfil, quando a API
 * manda o perfil), quando (data e hora de
 * Brasília, com segundos), o objeto afetado com o link para abri-lo quando ele ainda existe e há tela para ele, e a origem.
 * A API não guarda valores de antes e depois, IP nem aparelho além da origem, então não há campo para eles. Objeto e
 * origem vazios (um login não tem objeto) não aparecem: um "Objeto —" só ocupa lugar (28/11).
 */
function ConteudoDoEvento({ evento }: { evento: EventoAuditoria }) {
  const corDe = useCorDaCategoria();
  const categoria = categoriaDaAcao(evento.acao);
  const objeto = textoDoObjeto(evento);
  const rota = rotaDoObjeto(evento);
  const tipo = rotuloDoTipo(evento.entidade);
  const origem = evento.origem?.trim();
  return (
    <>
      <View style={estilos.acao}>
        <Texto variante="bloco" nivel={3}>{nomeDaAcao(evento.acao)}</Texto>
        {categoria ? (
          <View style={estilos.categoria}>
            <BolinhaDaCategoria cor={corDe(evento.acao)} />
            <Texto variante="suave">{ROTULO_DA_CATEGORIA[categoria]}</Texto>
          </View>
        ) : null}
      </View>
      <CampoLeitura rotulo="Quem" valor={evento.usuarioPerfil ? `${evento.nomeUsuario} · ${evento.usuarioPerfil}` : evento.nomeUsuario} />
      <CampoLeitura rotulo="Quando" valor={quandoCompleto(evento.criadoEm)} numerico />
      {/* O link depende do nome do objeto (`rotaDoObjeto`): sem objeto, não há link a perder. */}
      {objeto ? (
        <View>
          <CampoLeitura rotulo="Objeto" valor={objeto} />
          {rota ? <LinkTexto href={rota} texto={tipo === 'Aluno' ? 'Abrir ficha do aluno' : `Abrir ${(tipo ?? 'objeto').toLocaleLowerCase('pt-BR')}`} /> : null}
        </View>
      ) : null}
      {origem ? <CampoLeitura rotulo="Origem" valor={origem} /> : null}
    </>
  );
}

/**
 * `position: sticky` existe no react-native-web (CSS), mas não no tipo do React Native (o mesmo de `PainelDaCobranca`): o
 * painel acompanha a rolagem da página com a altura da área visível (`height`, não `maxHeight`: sem evento o texto fica no
 * meio e não sobra vazio embaixo dele); o corpo rola sozinho quando o detalhe não cabe.
 */
const grudado = (alturaDaJanela: number) =>
  (Platform.OS === 'web' ? { position: 'sticky', top: espaco(2), height: alturaDaJanela - espaco(4) } : {}) as unknown as ViewStyle;

/**
 * O detalhe num painel fixo à direita da tabela (a partir da faixa `larga`, 27/11), no molde do `PainelDaCobranca`: região
 * com o título como nome (não é diálogo: a tabela continua usável ao lado), corpo que rola sozinho. Sem evento escolhido,
 * diz o que fazer. Ao escolher um evento (ou outro, que remonta o conteúdo) o foco vai ao título; "Fechar" e o Esc
 * devolvem o foco à linha que abriu.
 */
export function PainelDoEvento({ evento, aoFechar }: { evento: EventoAuditoria | null; aoFechar: () => void }) {
  const { cores, bordas } = useTema();
  const { height } = useWindowDimensions();
  return (
    <View role="region" aria-label={TITULO}
      style={[estilos.painel, grudado(height), { backgroundColor: cores.superficie, borderColor: cores.divisor, borderWidth: bordas.bloco }]}>
      {evento ? <CorpoDoPainel key={evento.id} evento={evento} aoFechar={aoFechar} /> : (
        <View style={estilos.vazio}><Texto variante="suave" style={estilos.centro}>Escolha um evento para ver o detalhe.</Texto></View>
      )}
    </View>
  );
}

function CorpoDoPainel({ evento, aoFechar }: { evento: EventoAuditoria; aoFechar: () => void }) {
  const { cores } = useTema();
  const tituloRef = useRef<View>(null);
  // Quem tinha o foco ao abrir (a linha), lido no primeiro render, antes de o foco vir para cá.
  const [quemAbriu] = useState(() => (Platform.OS === 'web' ? (document.activeElement as HTMLElement | null) : null));
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    (tituloRef.current as unknown as HTMLElement | null)?.focus?.();
  }, []);
  const fechar = () => {
    aoFechar();
    if (quemAbriu?.isConnected) requestAnimationFrame(() => quemAbriu.focus());
  };
  const teclado = Platform.OS === 'web' ? {
    onKeyDown: (e: { key: string }) => { if (e.key === 'Escape') fechar(); },
  } : {};
  return (
    <View style={estilos.corpoDoPainel} {...teclado}>
      <View style={[estilos.topo, { backgroundColor: cores.superficie3, borderBottomColor: cores.bordaCampo }]}>
        <View ref={tituloRef} style={estilos.titulo} {...(Platform.OS === 'web' ? { tabIndex: -1 } : {})}>
          <Texto variante="bloco" nivel={2}>{TITULO}</Texto>
        </View>
        <IconeBotao Icone={X} rotulo="Fechar" aoTocar={fechar} moldura />
      </View>
      <ScrollView style={estilos.rolagem} contentContainerStyle={estilos.conteudo}><ConteudoDoEvento evento={evento} /></ScrollView>
    </View>
  );
}

/** Abaixo da faixa `larga` (ou com "Detalhes abrem: No centro"), o mesmo conteúdo numa `Folha` de detalhe. */
export function FolhaDoEvento({ evento, aoFechar }: { evento: EventoAuditoria | null; aoFechar: () => void }): ReactNode {
  return (
    <Folha visivel={!!evento} detalhe titulo={TITULO} aoFechar={aoFechar}>
      {evento ? <View style={estilos.conteudoDaFolha}><ConteudoDoEvento evento={evento} /></View> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  painel: { width: LARGURA_DO_PAINEL_DO_EVENTO, flexShrink: 0, alignSelf: 'flex-start', borderRadius: RAIO, overflow: 'hidden' },
  corpoDoPainel: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
  topo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1),
    paddingLeft: espaco(2), paddingRight: espaco(1.5), paddingVertical: espaco(1), borderBottomWidth: LINHA_DA_FAIXA,
  },
  titulo: { flex: 1 },
  rolagem: { flexShrink: 1 },
  conteudo: { padding: espaco(2), gap: espaco(2) },
  conteudoDaFolha: { gap: espaco(2) },
  vazio: { flexGrow: 1, padding: espaco(3), minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  centro: { textAlign: 'center' },
  acao: { gap: espaco(0.5) },
  categoria: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
});
