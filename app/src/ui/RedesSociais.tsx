import { Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View, type TextInput } from 'react-native';

import type { RedeDaConsultoria } from '../api/tipos';
import { proximoItemDoMenu } from '../dominio/agendaCalendario';
import {
  corDoBrilho, corDoGlifo, FUNDO_DO_BOTAO_DE_REDE, FUNDO_DO_BOTAO_DE_REDE_AO_PASSAR, NOME_DA_REDE, redesAdicionadas,
  redesDisponiveisParaAdicionar, rotuloCurto, type LinkDeRede, type MarcaDoBotao, type ValoresDasRedes,
} from '../dominio/redesSociais';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, misturar, RAIO, RAIO_CONTROLE } from '../tema/tokens';
import { abrirLinkExterno } from './abrirLinkExterno';
import { useAviso } from './Aviso';
import { Botao } from './Botao';
import { Campo } from './Campo';
import { IconeBotao } from './IconeBotao';
import { ICONE_DA_REDE } from './IconesDeRedes';
import { sobre } from './sobre';
import { Texto } from './Texto';
import { useTeclado } from './usoWeb';

/** Leitura: a fileira de botões redondos. Sem rede e sem WhatsApp, a peça não desenha nada. */
export interface PropsDaLeitura {
  modo: 'leitura';
  /** Já filtradas e na ordem (`redesPreenchidas`, `redesDoAluno(...).links`). */
  redes: LinkDeRede[];
  /** O botão do WhatsApp, primeiro da fileira; quem chama monta o link `wa.me` (como hoje). `rotulo` vai na dica (o telefone). */
  whatsapp?: { url: string; rotulo?: string } | null;
  /** Dono do perfil no nome acessível ("Abrir Instagram de Ana"); sem ele, "Abrir Instagram". */
  de?: string;
  /** `pequeno`: desenho de 32 no alvo de 44, para linha de lista de dados (como o `IconeBotao compacto`). */
  tamanho?: 'padrao' | 'pequeno';
}

/** Edição: uma linha por rede adicionada e o "Adicionar rede" com as que faltam. */
export interface PropsDaEdicao<R extends RedeDaConsultoria> {
  modo: 'edicao';
  /** Quais redes cabem aqui, na ordem (`REDES_SOCIAIS_DO_ALUNO`, `REDES_DA_CONSULTORIA`). */
  redesPermitidas: readonly R[];
  /** Chave presente (também `''`) = rede adicionada; remover tira a chave (quem envia manda em branco e apaga). */
  valores: ValoresDasRedes<R>;
  aoMudar: (valores: ValoresDasRedes<R>) => void;
  /** Erro por rede, de fora (`erroDaRedeDigitada`, o 422 da API). */
  erros?: Partial<Record<R, string | undefined>>;
}

/**
 * Redes sociais (26/11), peça única com dois modos. Leitura: botões redondos (círculo escuro de 40 px, 32 no `pequeno`, num
 * alvo de 44) com o glifo na cor da rede e um brilho suave dela; o WhatsApp primeiro, quando vem; cada um abre o link fora do
 * app pelo `abrirLinkExterno` (só https, sem token) e avisa se o sistema recusar; na web, a dica com o @ aparece no mouse e no
 * foco (Esc a dispensa). Papel de botão, como o do WhatsApp: no react-native-web um link sem `href` não responde ao Enter.
 * Edição: uma linha por rede adicionada (quadrado escuro com o glifo, campo "@usuário ou link" e "Remover <Rede>") e o
 * "Adicionar rede" (secundário), que abre um menu só com as redes que faltam (Menu Button da WAI-ARIA APG, como o "Criar"
 * da Agenda) e some quando todas foram adicionadas; a rede escolhida entra com o foco no campo.
 * O brilho é a exceção ao "sem sombra" do flat pedida pelo Gustavo em 25/11 (só nos botões de rede).
 */
export function RedesSociais<R extends RedeDaConsultoria>(props: PropsDaLeitura | PropsDaEdicao<R>) {
  return props.modo === 'leitura' ? <Fileira {...props} /> : <Edicao {...props} />;
}

// ---- Leitura ----

interface ItemDaFileira { marca: MarcaDoBotao; url: string; nome: string; dica?: string; falha: string }

function Fileira({ redes, whatsapp, de, tamanho = 'padrao' }: PropsDaLeitura) {
  const { avisar } = useAviso();
  const itens: ItemDaFileira[] = [
    ...(whatsapp ? [{ marca: 'whatsapp' as const, url: whatsapp.url, nome: 'WhatsApp', dica: whatsapp.rotulo, falha: 'Não foi possível abrir o WhatsApp. Tente de novo.' }] : []),
    ...redes.map(({ rede, url }) => ({
      marca: rede, url, nome: rede === 'site' ? 'site' : NOME_DA_REDE[rede], dica: rotuloCurto(rede, url), falha: 'Não foi possível abrir o link. Tente de novo.',
    })),
  ];
  if (!itens.length) return null;
  const pequeno = tamanho === 'pequeno';
  return (
    <View style={[estilos.fileira, pequeno ? estilos.fileiraPequena : null]}>
      {itens.map((item, i) => (
        <BotaoRedondo key={item.marca} item={item} rotulo={`Abrir ${item.nome}${de ? ` de ${de}` : ''}`} pequeno={pequeno}
          ancora={i === 0 ? 'inicio' : i === itens.length - 1 ? 'fim' : 'meio'}
          aoTocar={() => { void abrirLinkExterno(item.url).then((ok) => { if (!ok) avisar(item.falha, 'perigo'); }); }} />
      ))}
    </View>
  );
}

/** Onde a dica nasce: o primeiro botão a alinha pela borda dele e o último pela de trás, para o `overflow: hidden` do cartão não cortá-la. */
type AncoraDaDica = 'inicio' | 'meio' | 'fim';

function BotaoRedondo({ item, rotulo, pequeno, aoTocar, ancora }: { item: ItemDaFileira; rotulo: string; pequeno: boolean; aoTocar: () => void; ancora: AncoraDaDica }) {
  const { cores, variante } = useTema();
  // A dica é só da web (no celular não há mouse nem foco de teclado); no nativo o @ fica no `accessibilityHint`.
  const comDica = Platform.OS === 'web' && !!item.dica;
  const [dicaAberta, setDicaAberta] = useState(false);
  // Esc dispensa a dica sem tirar o foco (WCAG 1.4.13); a tecla segue para quem mais a escuta (folha, menu).
  useTeclado(dicaAberta, ({ key }) => {
    if (key === 'Escape') setDicaAberta(false);
  });
  const Icone = ICONE_DA_REDE[item.marca];
  const glifo = corDoGlifo(item.marca);
  return (
    <View style={estilos.lugarDoBotao}>
      <Pressable accessibilityRole="button" accessibilityLabel={rotulo} accessibilityHint={item.dica} onPress={aoTocar} style={estilos.alvo}
        onHoverIn={comDica ? () => setDicaAberta(true) : undefined} onHoverOut={comDica ? () => setDicaAberta(false) : undefined}
        onFocus={comDica ? () => setDicaAberta(true) : undefined} onBlur={comDica ? () => setDicaAberta(false) : undefined}>
        {(estado) => (
          <View style={[estilos.circulo, pequeno ? estilos.circuloPequeno : null, desenhoDoFundo(item.marca, glifo, cores, variante === 'escuro', sobre(estado), pequeno ? 8 : 12)]}>
            <Icone size={pequeno ? 16 : 20} color={glifo} />
          </View>
        )}
      </Pressable>
      {dicaAberta && item.dica ? (
        <View pointerEvents="none" aria-hidden style={[estilos.lugarDaDica, ancora === 'inicio' ? estilos.dicaNoInicio : ancora === 'fim' ? estilos.dicaNoFim : null]}>
          <View style={[estilos.dica, { backgroundColor: cores.texto }]}>
            <Texto numberOfLines={1} style={[estilos.textoDaDica, { color: cores.fundo }]}>{item.dica}</Texto>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Fundo escuro nos dois temas (a cor da rede só contrasta assim; o glifo passa 3:1 nele, `corDoGlifo`), contorno na cor do
 * glifo e o brilho suave: a cor da rede misturada à superfície, mais forte no escuro (o brilho some no branco).
 */
function desenhoDoFundo(marca: MarcaDoBotao, glifo: string, cores: { superficie: string; texto: string }, escuro: boolean, aoPassar: boolean, raioDoBrilho: number) {
  const brilho = corDoBrilho(marca, cores);
  return {
    backgroundColor: aoPassar ? FUNDO_DO_BOTAO_DE_REDE_AO_PASSAR : FUNDO_DO_BOTAO_DE_REDE,
    borderColor: misturar(FUNDO_DO_BOTAO_DE_REDE, glifo, 0.45),
    boxShadow: `0px 0px ${raioDoBrilho}px ${misturar(cores.superficie, brilho, escuro ? 0.55 : 0.35)}`,
  };
}

/** O quadrado escuro com o glifo da rede (40 px, 32 no menu): só desenho, quem usa dá o nome. */
function QuadradoDaRede({ marca, pequeno }: { marca: MarcaDoBotao; pequeno?: boolean }) {
  const { cores, variante } = useTema();
  const Icone = ICONE_DA_REDE[marca];
  const glifo = corDoGlifo(marca);
  return (
    <View aria-hidden style={[estilos.quadrado, pequeno ? estilos.quadradoPequeno : null, desenhoDoFundo(marca, glifo, cores, variante === 'escuro', false, pequeno ? 6 : 10)]}>
      <Icone size={pequeno ? 16 : 20} color={glifo} />
    </View>
  );
}

// ---- Edição ----

const TEXTO_DO_CAMPO = '@usuário ou link';
const textoDoCampo = (rede: RedeDaConsultoria) => (rede === 'site' ? 'link' : TEXTO_DO_CAMPO);

function Edicao<R extends RedeDaConsultoria>({ redesPermitidas, valores, aoMudar, erros }: PropsDaEdicao<R>) {
  const adicionadas = redesAdicionadas(valores, redesPermitidas);
  const disponiveis = redesDisponiveisParaAdicionar(valores, redesPermitidas);
  const campos = useRef<Partial<Record<RedeDaConsultoria, TextInput | null>>>({});
  const botao = useRef<View>(null);

  // Depois do commit (e do Modal sair, que devolve o foco a quem abriu): o foco vai ao campo novo ou ao "Adicionar rede".
  const adicionar = (rede: R) => {
    aoMudar({ ...valores, [rede]: '' });
    setTimeout(() => campos.current[rede]?.focus(), 0);
  };
  const remover = (rede: R) => {
    const resto = { ...valores };
    delete resto[rede];
    aoMudar(resto);
    if (Platform.OS === 'web') setTimeout(() => (botao.current as unknown as HTMLElement | null)?.focus?.(), 0);
  };

  return (
    <View style={estilos.edicao}>
      {adicionadas.map((rede) => {
        const nome = NOME_DA_REDE[rede];
        return (
          <View key={rede} style={estilos.linhaDaRede}>
            {/* Rótulo visível alinhado ao campo; o campo tem o nome completo ("Instagram: @usuário ou link"), então este não é lido. */}
            <Texto variante="rotulo" aria-hidden style={estilos.rotuloDaRede}>{nome}</Texto>
            <View style={estilos.linhaDoCampo}>
              <View style={estilos.lugarDoQuadrado}><QuadradoDaRede marca={rede} /></View>
              <View style={estilos.campo}>
                <Campo ref={(no) => { campos.current[rede] = no; }} rotulo={nome} rotuloOculto rotuloAcessivel={`${nome}: ${textoDoCampo(rede)}`}
                  valor={valores[rede] ?? ''} aoMudar={(texto) => aoMudar({ ...valores, [rede]: texto })} erro={erros?.[rede]}
                  placeholder={rede === 'site' ? 'seusite.com.br' : TEXTO_DO_CAMPO} autoCapitalize="none" autoCorrect={false} spellCheck={false} />
              </View>
              <IconeBotao Icone={Trash2} rotulo={`Remover ${nome}`} aoTocar={() => remover(rede)} />
            </View>
          </View>
        );
      })}
      {disponiveis.length ? <MenuAdicionarRede botao={botao} redes={disponiveis} aoEscolher={adicionar} /> : null}
    </View>
  );
}

interface Ancora { x: number; y: number; w: number; h: number }
const LARGURA_DO_MENU = 240;
const FOLGA = espaco(1);

/**
 * "Adicionar rede" (Menu Button da WAI-ARIA APG, o molde de `treinador/agenda/MenuCriar`): menu colado ao botão, alinhado
 * pela esquerda, dentro da janela e para cima se não couber embaixo. Abre com o foco no primeiro item; na web as setas andam
 * entre os itens (dando a volta), Home e End vão às pontas; Esc, tocar fora ou escolher fecham.
 */
function MenuAdicionarRede<R extends RedeDaConsultoria>({ botao, redes, aoEscolher }: {
  botao: RefObject<View | null>; redes: R[]; aoEscolher: (rede: R) => void;
}) {
  const { cores, bordas } = useTema();
  const { width, height } = useWindowDimensions();
  const [ancora, setAncora] = useState<Ancora | null>(null);
  const [alturaDoMenu, setAlturaDoMenu] = useState(0);
  const itens = useRef<(View | null)[]>([]);
  const aberto = ancora !== null;

  const abrir = () => botao.current?.measureInWindow((x, y, w, h) => setAncora({ x, y, w, h }));
  const fechar = (escolhida?: R) => {
    setAncora(null);
    if (escolhida) aoEscolher(escolhida);
    // Sem escolha, o foco volta ao botão (o Modal some do DOM e o foco cairia no corpo da página).
    else if (Platform.OS === 'web') setTimeout(() => (botao.current as unknown as HTMLElement | null)?.focus?.(), 0);
  };

  useEffect(() => {
    if (!aberto || Platform.OS !== 'web') return undefined;
    const relogio = setTimeout(() => (itens.current[0] as unknown as HTMLElement | null)?.focus?.(), 0);
    // Na captura do documento: o `Pressable` do react-native-web para a propagação do teclado.
    const ouvir = (e: KeyboardEvent) => {
      const els = itens.current.map((r) => r as unknown as HTMLElement | null).filter((el): el is HTMLElement => !!el);
      const destino = proximoItemDoMenu(e.key, els.indexOf(document.activeElement as HTMLElement), els.length);
      if (destino === null) return;
      e.preventDefault();
      els[destino]?.focus();
    };
    document.addEventListener('keydown', ouvir, true);
    return () => {
      clearTimeout(relogio);
      document.removeEventListener('keydown', ouvir, true);
    };
  }, [aberto]);

  const esquerda = ancora ? Math.max(FOLGA, Math.min(ancora.x, width - LARGURA_DO_MENU - FOLGA)) : 0;
  const embaixo = ancora ? ancora.y + ancora.h + espaco(0.5) : 0;
  const topo = ancora && alturaDoMenu && embaixo + alturaDoMenu > height - FOLGA ? Math.max(FOLGA, ancora.y - espaco(0.5) - alturaDoMenu) : embaixo;
  return (
    <View style={estilos.lugarDoAdicionar}>
      <Botao ref={botao} tipo="secundario" Icone={Plus} rotulo="Adicionar rede" aoTocar={abrir} />
      {ancora ? (
        <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => fechar()}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => fechar()} accessibilityLabel="Fechar o menu de redes" />
          <View role="menu" aria-label="Adicionar rede" accessibilityViewIsModal onLayout={(e) => setAlturaDoMenu(Math.round(e.nativeEvent.layout.height))}
            style={[estilos.menu, { top: topo, left: esquerda, backgroundColor: cores.superficie, borderColor: cores.borda, borderWidth: bordas.bloco }]}>
            {redes.map((rede, i) => (
              <Pressable key={rede} ref={(no) => { itens.current[i] = no; }} role="menuitem" accessibilityLabel={NOME_DA_REDE[rede]} onPress={() => fechar(rede)}
                style={(e) => [estilos.item, sobre(e) && { backgroundColor: cores.sobre }]}>
                <QuadradoDaRede marca={rede} pequeno />
                <Texto style={estilos.nomeDoItem}>{NOME_DA_REDE[rede]}</Texto>
              </Pressable>
            ))}
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const QUADRADO = 40;
const VAO_DA_LINHA = espaco(1);

const estilos = StyleSheet.create({
  fileira: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  fileiraPequena: { gap: espaco(0.5) },
  lugarDoBotao: { position: 'relative' },
  alvo: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: ALVO_TOQUE / 2 },
  circulo: { width: QUADRADO, height: QUADRADO, borderRadius: QUADRADO / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  circuloPequeno: { width: 32, height: 32, borderRadius: 16 },
  // Acima do botão: abaixo, a borda de baixo do cartão (que recorta, `overflow: hidden`) cortaria a dica da última linha.
  lugarDaDica: { position: 'absolute', bottom: ALVO_TOQUE + 4, left: -110, right: -110, alignItems: 'center', zIndex: 10 },
  dicaNoInicio: { left: 0, alignItems: 'flex-start' },
  dicaNoFim: { right: 0, alignItems: 'flex-end' },
  dica: { paddingHorizontal: espaco(1), paddingVertical: espaco(0.5), borderRadius: RAIO_CONTROLE, maxWidth: 264 },
  textoDaDica: { fontFamily: fontes.medio, fontSize: 13, lineHeight: 18 },
  quadrado: { width: QUADRADO, height: QUADRADO, borderRadius: RAIO_CONTROLE, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  quadradoPequeno: { width: 32, height: 32, borderRadius: 8 },
  edicao: { gap: espaco(2) },
  linhaDaRede: { gap: espaco(0.5) },
  rotuloDaRede: { marginLeft: QUADRADO + VAO_DA_LINHA },
  linhaDoCampo: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO_DA_LINHA },
  // O quadrado (40) centrado na altura do campo (44).
  lugarDoQuadrado: { height: ALVO_TOQUE, justifyContent: 'center' },
  campo: { flex: 1, minWidth: 0 },
  lugarDoAdicionar: { alignItems: 'flex-start' },
  menu: { position: 'absolute', width: LARGURA_DO_MENU, borderRadius: RAIO, paddingVertical: espaco(0.5), overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE + espaco(0.5), paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.5) },
  nomeDoItem: { fontFamily: fontes.medio },
});
