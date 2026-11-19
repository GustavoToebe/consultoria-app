import { ArrowLeftRight, CircleAlert, Ellipsis, ExternalLink, type LucideIcon, PlayCircle, Trash2 } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AVISO_CURTO_DO_LINK_INVALIDO, AVISO_DO_LINK_INVALIDO, estadoDoVideo, type ItemMobilidade, TEXTO_DO_VIDEO_ADICIONADO } from '../../dominio/mobilidade';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO_CONTROLE } from '../../tema/tokens';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
import { AlcaDeArraste, ItemArrastavel, LARGURA_DA_ALCA, useArrasteDaLista } from '../../ui/ArrasteDaLista';
import { useAviso } from '../../ui/Aviso';
import { Campo } from '../../ui/Campo';
import { IconeBotao } from '../../ui/IconeBotao';
import { NumeroInvertido } from '../../ui/NumeroInvertido';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { acoesDeMover } from '../acoesDeMover';
import { FolhaDeAcoes } from '../FolhaDeAcoes';

type Modo = 'tabela' | 'empilhado';

/**
 * Largura (medida) da lista de itens a partir da qual eles viram tabela: alça, número, as mínimas de Nome, Prescrição e
 * Vídeo, o ⋯, os vãos e o recuo da faixa. É a área dos itens dentro do painel; o painel tem ~40 px a mais (o recuo do
 * cartão), então a tabela aparece a partir de ~700 px de painel (1280 com o menu aberto já cabe).
 */
const LARGURA_DA_TABELA = 600;
const VAO = espaco(1);
const RECUO_DA_FAIXA = espaco(1);
const CONTORNO_DA_FAIXA = 1;
const LARGURA_DO_NUMERO = 28;

/**
 * Itens da seção no padrão da tabela da dieta (19/11): cabeçalho das colunas uma vez (fora do leitor de tela: cada campo
 * tem o nome dele), cada item numa faixa `superficie2` de cantos 12, a 6 px um do outro, com a alça e o número no começo
 * e o ⋯ (mover e excluir) no fim. Estreita (o celular, o painel abaixo de ~700 px), cada item vira o cartão empilhado,
 * com os rótulos à vista. Arrastar pela alça usa a mesma regra do ⋯ (`aoMover`).
 */
export function ItensDaSecao({ itens, focarUid, aoMudar, aoMover, aoRemover }: {
  itens: ItemMobilidade[];
  /** Item recém-adicionado: o campo Nome dele nasce com o foco. */
  focarUid: string | null;
  aoMudar: (indice: number, parcial: Partial<ItemMobilidade>) => void;
  aoMover: (de: number, para: number) => void;
  aoRemover: (indice: number) => void;
}) {
  const [largura, setLargura] = useState(0);
  const modo: Modo = largura >= LARGURA_DA_TABELA ? 'tabela' : 'empilhado';
  const arraste = useArrasteDaLista({ total: itens.length, folga: 3, aoSoltar: aoMover });
  return (
    <View style={estilos.itens} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      {modo === 'tabela' && itens.length ? <CabecalhoDasColunas /> : null}
      {itens.map((it, ii) => (
        <ItemArrastavel key={it.uid} arraste={arraste} indice={ii}>
          <LinhaDoItem modo={modo} item={it} posicao={ii} total={itens.length} focar={it.uid === focarUid}
            alca={<AlcaDeArraste arraste={arraste} indice={ii} />}
            aoMudar={(parcial) => aoMudar(ii, parcial)} aoMover={(d) => aoMover(ii, ii + d)} aoRemover={() => aoRemover(ii)} />
        </ItemArrastavel>
      ))}
    </View>
  );
}

/** "#", "Nome", "Prescrição" e "Vídeo" em cima das colunas, com o mesmo recuo da faixa. */
function CabecalhoDasColunas() {
  return (
    <View aria-hidden style={[estilos.linhaDaTabela, estilos.cabecalho]}>
      <View style={estilos.colunaDaAlca} />
      <View style={estilos.colunaDoNumero}><Texto variante="rotulo">#</Texto></View>
      <View style={estilos.colunaDoNome}><Texto variante="rotulo">Nome</Texto></View>
      <View style={estilos.colunaDaPrescricao}><Texto variante="rotulo">Prescrição</Texto></View>
      <View style={estilos.colunaDoVideo}><Texto variante="rotulo">Vídeo</Texto></View>
      <View style={estilos.colunaDasAcoes} />
    </View>
  );
}

/**
 * Um item: nome, prescrição em texto e o vídeo (só link do YouTube). O nome acessível dos campos é o de antes ("Nome do
 * item 2"), também na tabela, onde o rótulo fica oculto e sobe para o cabeçalho. O contorno da faixa existe sempre
 * (transparente), para nada pular quando o item ganha pendência.
 */
function LinhaDoItem({ modo, item: it, posicao, total, focar, alca, aoMudar, aoMover, aoRemover }: {
  modo: Modo;
  item: ItemMobilidade;
  posicao: number;
  total: number;
  focar: boolean;
  alca: ReactNode;
  aoMudar: (parcial: Partial<ItemMobilidade>) => void;
  aoMover: (delta: -1 | 1) => void;
  aoRemover: () => void;
}) {
  const { cores } = useTema();
  const [menu, setMenu] = useState(false);
  const n = posicao + 1;
  // O nome das ações leva o item: "Subir Gato-vaca", nunca "Subir item" igual em todos.
  const nome = it.nome.trim() || `item ${n}`;
  const tabela = modo === 'tabela';
  const video = estadoDoVideo(it.videoUrl);
  const semNome = !it.nome.trim();
  const acoes = [
    ...acoesDeMover({ nome, posicao, total, aoMover }),
    { rotulo: 'Excluir item', detalhe: `Remover ${nome}. Dá para desfazer logo depois.`, Icone: Trash2, perigo: true, aoTocar: aoRemover },
  ];

  const campoNome = (
    <Campo rotulo="Nome" rotuloOculto={tabela} rotuloAcessivel={`Nome do item ${n}`} valor={it.nome} maxLength={120} placeholder="Ex.: Gato-vaca"
      autoFocus={focar} erro={semNome ? 'Informe o nome.' : null} aoMudar={(v) => aoMudar({ nome: v })} />
  );
  const campoPrescricao = (
    <Campo rotulo="Prescrição" rotuloOculto={tabela} rotuloAcessivel={`Prescrição do item ${n}`} valor={it.prescricao} maxLength={120}
      placeholder="Ex.: 2 x 20s cada lado" aoMudar={(v) => aoMudar({ prescricao: v })} />
  );
  const campoVideo = <VideoDoItem tabela={tabela} uid={it.uid} numero={n} url={it.videoUrl} aoMudar={(videoUrl) => aoMudar({ videoUrl })} />;
  const mais = <IconeBotao Icone={Ellipsis} rotulo={`Mais ações de ${nome}`} aoTocar={() => setMenu(true)} />;
  // Nome vazio e link inválido são erro (vermelho, 4.5; D8 decidida em 19/11): os dois travam o salvar.
  const contorno = semNome || video === 'invalido' ? cores.perigo : 'transparent';

  return (
    <View style={[estilos.faixa, { backgroundColor: cores.superficie2, borderColor: contorno }]}>
      {tabela ? (
        <View style={estilos.linhaDaTabela}>
          <View style={estilos.colunaDaAlca}>{alca}</View>
          <View style={[estilos.colunaDoNumero, estilos.noMeio]}><NumeroInvertido numero={n} invertido={false} /></View>
          <View style={estilos.colunaDoNome}>{campoNome}</View>
          <View style={estilos.colunaDaPrescricao}>{campoPrescricao}</View>
          <View style={estilos.colunaDoVideo}>{campoVideo}</View>
          <View style={[estilos.colunaDasAcoes, estilos.noMeio]}>{mais}</View>
        </View>
      ) : (
        <View style={estilos.empilhado}>
          {/* Em cima, a alça, o número, o Nome e o ⋯; embaixo, Prescrição e Vídeo na largura toda. */}
          <View style={estilos.linhaDeCima}>
            <View style={estilos.alcaEmpilhada}>{alca}</View>
            <View style={estilos.numeroEmpilhado}><NumeroInvertido numero={n} invertido={false} /></View>
            <View style={estilos.cresce}>{campoNome}</View>
            <View style={estilos.maisEmpilhado}>{mais}</View>
          </View>
          <View style={estilos.camposDeBaixo}>
            <View style={estilos.campoDeBaixo}>{campoPrescricao}</View>
            <View style={estilos.campoDoVideo}>{campoVideo}</View>
          </View>
        </View>
      )}
      {menu ? <FolhaDeAcoes titulo={it.nome.trim() || 'Item sem nome'} aoFechar={() => setMenu(false)} acoes={acoes} /> : null}
    </View>
  );
}

/**
 * Vídeo do item: vazio, o campo com "Cole o link do YouTube"; com link válido e fora do foco, uma linha compacta
 * ("Vídeo adicionado", Abrir em nova aba e Trocar); link inválido, o campo em erro (borda vermelha, `aria-invalid`) e o
 * selo de perigo embaixo, ligado ao campo (`aria-describedby`). Na tabela o placeholder e o selo são curtos ("Link do
 * YouTube", "Link inválido"), para caber na coluna sem cortar nem quebrar. Enquanto o campo tem o foco ele não vira a
 * linha compacta (o link ainda está sendo digitado).
 */
function VideoDoItem({ tabela, uid, numero, url, aoMudar }: { tabela: boolean; uid: string; numero: number; url: string; aoMudar: (url: string) => void }) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const estado = estadoDoVideo(url);
  const [editando, setEditando] = useState(false);
  // "Trocar" monta o campo com o foco; sem isso o foco cairia no fim da página quando a linha compacta some.
  const [focar, setFocar] = useState(false);
  const idDoAviso = `aviso-do-video-${uid}`;
  const aviso = tabela ? AVISO_CURTO_DO_LINK_INVALIDO : AVISO_DO_LINK_INVALIDO;
  if (estado === 'valido' && !editando) {
    return (
      <View style={estilos.videoAdicionado}>
        <View style={estilos.rotuloDoVideo}>
          <PlayCircle size={16} color={cores.textoSuave} strokeWidth={2} aria-hidden />
          <Texto style={estilos.textoDoVideo}>{TEXTO_DO_VIDEO_ADICIONADO}</Texto>
        </View>
        <View style={estilos.botoesDoVideo}>
          <BotaoCompacto texto="Abrir" rotulo={`Abrir vídeo do item ${numero} (nova aba)`} Icone={ExternalLink}
            aoTocar={() => { void abrirLinkExterno(url).then((ok) => { if (!ok) avisar('Não foi possível abrir o vídeo.', 'perigo'); }); }} />
          <BotaoCompacto texto="Trocar" rotulo={`Trocar vídeo do item ${numero}`} Icone={ArrowLeftRight} aoTocar={() => { setEditando(true); setFocar(true); }} />
        </View>
      </View>
    );
  }
  return (
    <View style={estilos.video}>
      <Campo rotulo="Vídeo (link do YouTube, opcional)" rotuloOculto={tabela} rotuloAcessivel={`Vídeo do item ${numero} (link do YouTube, opcional)`}
        valor={url} maxLength={500} placeholder={tabela ? 'Link do YouTube' : 'Cole o link do YouTube'} autoCapitalize="none" autoCorrect={false} keyboardType="url"
        autoFocus={focar} erro={estado === 'invalido' ? aviso : null} erroSemTexto
        ajudaForaDoCampo={estado === 'invalido' ? { id: idDoAviso, texto: aviso } : undefined}
        onFocus={() => setEditando(true)} onBlur={() => { setEditando(false); setFocar(false); }} aoMudar={aoMudar} />
      {estado === 'invalido' ? (
        <View nativeID={idDoAviso} style={estilos.aviso}><Selo texto={aviso} tipo="perigo" Icone={CircleAlert} /></View>
      ) : null}
    </View>
  );
}

/**
 * Botão compacto e neutro (contorno, sem cor de ação) da linha do vídeo: aparece em todo item e não pode competir com o
 * "Adicionar item". Desenho de 32 px e alvo de 44, como o "Trocar alimento" da dieta (o `Botao` não tem tamanho compacto).
 */
function BotaoCompacto({ texto, rotulo, Icone, aoTocar }: { texto: string; rotulo: string; Icone: LucideIcon; aoTocar: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={rotulo} onPress={aoTocar} style={estilos.alvoCompacto}>
      {(estado) => (
        <View style={[estilos.desenhoCompacto, { backgroundColor: cores.superficie, borderColor: sobre(estado) ? cores.bordaCampo : cores.borda }]}>
          <Icone size={14} color={cores.texto} strokeWidth={2} />
          <Texto style={[estilos.textoCompacto, { color: cores.texto }]}>{texto}</Texto>
        </View>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  // Os itens ficam a 6 px um do outro: cada faixa já separa pelo fundo (o mesmo da dieta).
  itens: { gap: 6 },
  faixa: { borderRadius: 12, borderWidth: CONTORNO_DA_FAIXA, paddingHorizontal: RECUO_DA_FAIXA, paddingVertical: espaco(1) },
  linhaDaTabela: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO },
  cabecalho: { paddingHorizontal: RECUO_DA_FAIXA + CONTORNO_DA_FAIXA, alignItems: 'center' },
  colunaDaAlca: { width: LARGURA_DA_ALCA },
  colunaDoNumero: { width: LARGURA_DO_NUMERO, alignItems: 'center' },
  // Nome e Prescrição maiores (1,2 cada), Vídeo menor (1).
  colunaDoNome: { flex: 1.2, minWidth: 0 },
  colunaDaPrescricao: { flex: 1.2, minWidth: 0 },
  colunaDoVideo: { flex: 1, minWidth: 0 },
  colunaDasAcoes: { width: ALVO_TOQUE },
  // Número e ⋯ no meio da caixa do campo (44 de altura), mesmo quando a célula do lado cresce com um aviso.
  noMeio: { minHeight: ALVO_TOQUE, justifyContent: 'center' },
  empilhado: { gap: espaco(1) },
  linhaDeCima: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1) },
  alcaEmpilhada: { width: LARGURA_DA_ALCA, minHeight: ALVO_TOQUE, justifyContent: 'flex-end' },
  numeroEmpilhado: { minHeight: ALVO_TOQUE, justifyContent: 'center' },
  maisEmpilhado: { minHeight: ALVO_TOQUE, justifyContent: 'center' },
  cresce: { flex: 1, minWidth: 0 },
  camposDeBaixo: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  campoDeBaixo: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0 },
  campoDoVideo: { flexGrow: 1.4, flexShrink: 1, flexBasis: 280, minWidth: 0 },
  video: { gap: espaco(0.5) },
  aviso: { flexDirection: 'row' },
  // Ícone e texto numa linha; Abrir e Trocar ao lado quando cabem, senão embaixo.
  videoAdicionado: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), minHeight: ALVO_TOQUE },
  rotuloDoVideo: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  textoDoVideo: { fontFamily: fontes.semi, fontSize: 14, lineHeight: 20 },
  botoesDoVideo: { flexDirection: 'row', gap: espaco(0.5) },
  alvoCompacto: { minHeight: ALVO_TOQUE, justifyContent: 'center', borderRadius: RAIO_CONTROLE },
  desenhoCompacto: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: espaco(1.25), borderWidth: 1, borderRadius: RAIO_CONTROLE },
  textoCompacto: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 18 },
});
