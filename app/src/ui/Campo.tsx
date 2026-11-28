import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { CircleAlert } from 'lucide-react-native';
import { ESTILOS_TEXTO } from './tipografia';
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type TextInput, type TextInputProps } from 'react-native';

import { escalar } from '../dominio/preferencias';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO_CONTROLE } from '../tema/tokens';
import { coresDoDesabilitado } from './desabilitado';
import { Texto } from './Texto';

interface Props extends Omit<TextInputProps, 'style' | 'onChangeText' | 'value'> {
  /** Para levar o foco ao campo ("Ajustar duração"); no React 19 o ref chega como prop e segue pelo `resto`. */
  ref?: Ref<TextInput>;
  numerico?: boolean;
  rotulo: string;
  valor: string;
  aoMudar: (texto: string) => void;
  erro?: string | null;
  ajuda?: string;
  /**
   * Ajuda escrita fora do campo (uma linha só abaixo de uma grade de campos): o texto com `nativeID={id}` fica com quem usa;
   * aqui o campo aponta para ele (`aria-describedby` na web, `accessibilityHint` no celular).
   */
  ajudaForaDoCampo?: { id: string; texto: string };
  /** Campo de várias linhas (observações). */
  linhas?: number;
  /**
   * Altura fixa da caixa: no campo de várias linhas (o `CampoDaTabela` no celular, medida pelo texto; passou dela, o
   * campo rola) ou de uma linha (o número da série aberta, 46).
   */
  altura?: number;
  /** Botão dentro do campo, à direita (ex.: calendário). */
  acao?: ReactNode;
  /** Nome para o leitor de tela quando o rótulo visível se repete na tela ("Reps mín." da série e da retomada). */
  rotuloAcessivel?: string;
  /** Sem o rótulo em cima: o que é o campo já está ao lado dele; o leitor de tela lê `rotuloAcessivel`. */
  rotuloOculto?: boolean;
  /** Rótulo secundário (peso normal e `textoSuave`): o par De/Até do filtro, sob o rótulo do grupo que é quem manda. */
  rotuloDiscreto?: boolean;
  /** Unidade dentro da caixa, depois do número ("%"). */
  sufixo?: string;
  /**
   * O erro marca a caixa e vai ao leitor de tela, mas o texto fica com quem usa (campo estreito numa linha, em que a
   * frase do erro quebraria em várias linhas debaixo dele).
   */
  erroSemTexto?: boolean;
  /** Texto maior e em semi-negrito (o título do evento, como o "Adicionar título" do Google Agenda). */
  grande?: boolean;
  /** Cor do texto digitado, quando ela carrega um sinal (valor de entrada ou de saída); desabilitado continua cinza. */
  corDoTexto?: string;
  /** Número em fonte monoespaçada no peso mais forte carregado (Geist Mono 600): carga, reps e pausa da série. */
  mono?: boolean;
  /** Texto centralizado na caixa (campo numérico estreito). */
  centralizado?: boolean;
  /** Contorno em repouso sobre um fundo que não é o neutro (cartão pintado), para manter 3:1; foco e erro continuam valendo. */
  corDaBorda?: string;
}

/**
 * Campo de digitar com rótulo fixo em cima (o exemplo do `placeholder` nunca o substitui), ajuda e erro embaixo. O rótulo
 * vai na cor do texto; só a ajuda é suave. Erro = ícone + mensagem + borda `perigo` juntos (cor nunca sozinha); vai ao
 * leitor de tela: `aria-invalid` na web, região viva no Android e anúncio no iOS. Foco = borda de 2 px na cor do anel de
 * foco (a cor da marca não contrasta no escuro).
 */
export function Campo({ rotulo, valor, aoMudar, erro, ajuda, ajudaForaDoCampo, linhas, altura, numerico, acao, rotuloAcessivel, rotuloOculto, rotuloDiscreto, sufixo, erroSemTexto, grande, corDoTexto, mono, centralizado, corDaBorda, ...resto }: Props) {
  const { cores, fatorTexto } = useTema();
  const [foco, setFoco] = useState(false);
  const cinza = coresDoDesabilitado(cores);
  const corBorda = erro ? cores.perigo : foco ? cores.anelFoco : corDaBorda ?? cores.bordaCampo;
  // Foco e erro têm borda de 2 px; o padding cede 1 px para a altura e o texto não mexerem.
  const destaque = foco || !!erro ? 1 : 0;
  useAnunciarErro(erro, rotulo);
  const entrada = useRef<TextInput | null>(null);
  return (
    <View style={estilos.campo}>
      {rotuloOculto ? null : <Label onPress={() => entrada.current?.focus()} style={[ESTILOS_TEXTO.rotulo, rotuloDiscreto ? { fontFamily: fontes.normal } : null, { color: rotuloDiscreto ? cores.textoSuave : cores.texto }]}>{rotulo}</Label>}
      <View>
      <Input
        {...resto}
        ref={(no) => { entrada.current = no; entregarRef(resto.ref, no); }}
        accessibilityLabel={rotuloAcessivel ?? rotulo}
        accessibilityHint={erro ?? ajuda ?? ajudaForaDoCampo?.texto}
        // O RN não tipa `aria-describedby`; o react-native-web o leva ao `input`.
        {...(ajudaForaDoCampo ? ({ 'aria-describedby': ajudaForaDoCampo.id } as object) : null)}
        aria-invalid={!!erro}
        value={valor}
        onChangeText={aoMudar}
        onFocus={(e) => {
          setFoco(true);
          resto.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFoco(false);
          resto.onBlur?.(e);
        }}
        multiline={!!linhas}
        numberOfLines={linhas}
        placeholderTextColor={cores.textoSuave}
        style={[
          estilos.entrada,
          { borderWidth: 1 + destaque, paddingHorizontal: espaco(1.5) - destaque, paddingVertical: espaco(1) - destaque },
          numerico ? { fontVariant: ['tabular-nums'] } : null,
          // Com uma linha a conta dá 42: nunca abaixo do alvo de toque (a mesma altura do campo de uma linha).
          linhas ? { minHeight: Math.max(ALVO_TOQUE, linhas * escalar(22, fatorTexto) + 20), textAlignVertical: 'top' } : null,
          altura ? { height: altura } : null,
          acao ? { paddingRight: ALVO_TOQUE } : sufixo ? { paddingRight: espaco(1.5) + escalar(16, fatorTexto) * sufixo.length } : null,
          { color: corDoTexto ?? cores.texto, backgroundColor: cores.campo, borderColor: corBorda, fontSize: escalar(16, fatorTexto) },
          grande ? { fontSize: escalar(22, fatorTexto), fontFamily: fontes.semi, minHeight: ALVO_TOQUE + 8 } : null,
          mono ? { fontFamily: fontes.monoSemi } : null,
          centralizado ? { textAlign: 'center' as const } : null,
          resto.editable === false ? { color: cinza.texto, backgroundColor: cinza.fundo, borderColor: cinza.borda } : null,
        ]}
      />
      {acao ? <View style={estilos.acao}>{acao}</View> : null}
      {!acao && sufixo ? (
        <View pointerEvents="none" style={estilos.sufixo}>
          <Texto variante="suave" style={{ fontFamily: fontes.semi }} aria-hidden>{sufixo}</Texto>
        </View>
      ) : null}
      </View>
      {erro && !erroSemTexto ? <MensagemDeErro erro={erro} /> : null}
      {!erro && ajuda ? <Texto variante="pequeno">{ajuda}</Texto> : null}
    </View>
  );
}

/** O ref de fora (objeto ou função) segue recebendo o campo, junto com o interno que o rótulo usa. */
function entregarRef(destino: Ref<TextInput> | undefined, no: TextInput | null) {
  if (typeof destino === 'function') destino(no);
  else if (destino) destino.current = no;
}

/** Mensagem de erro sob o campo: ícone e texto em `perigo` (o ícone é decorativo; o texto é que é lido). */
export function MensagemDeErro({ erro }: { erro: string }) {
  const { cores } = useTema();
  return (
    <View style={estilos.erro}>
      <View aria-hidden style={estilos.iconeDoErro}><CircleAlert size={14} color={cores.perigo} strokeWidth={2.5} /></View>
      <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite" style={estilos.textoDoErro}>{erro}</Texto>
    </View>
  );
}

/** No iOS a região viva não existe: o erro novo é anunciado com o nome do campo. */
export function useAnunciarErro(erro: string | null | undefined, rotulo: string): void {
  useEffect(() => {
    if (Platform.OS === 'ios' && erro) AccessibilityInfo.announceForAccessibility(`${rotulo}: ${erro}`);
  }, [erro, rotulo]);
}

const estilos = StyleSheet.create({
  campo: { gap: espaco(0.5) },
  erro: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(0.5) },
  // O ícone desce até o meio da primeira linha do texto pequeno (linha de 16 px).
  iconeDoErro: { paddingTop: 1 },
  textoDoErro: { flexShrink: 1 },
  acao: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' },
  sufixo: { position: 'absolute', right: espaco(1.5), top: 0, bottom: 0, justifyContent: 'center' },
  entrada: {
    minHeight: ALVO_TOQUE,
    borderRadius: RAIO_CONTROLE,
    fontFamily: fontes.normal,
    fontSize: 16,
  },
});
