import { Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentProps, type Ref } from 'react';
import { Platform, Pressable, StyleSheet, type TextInput } from 'react-native';

import { mudancaAceita, origemDoEvento, type OrigemDaMudanca } from '../dominio/campoDeChave';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, RAIO } from '../tema/tokens';
import { Campo } from './Campo';

type PropsDoCampo = ComponentProps<typeof Campo>;
type Props = Omit<PropsDoCampo, 'secureTextEntry' | 'acao' | 'numerico' | 'linhas' | 'autoComplete' | 'nativeID' | 'id' | 'ref'> & {
  /** Id neutro no `<input>` (ex.: "chave-infinitepay"): nada de "password", "email" ou "user", que o navegador lê como login. */
  id: string;
  ref?: Ref<TextInput>;
  /** Segredo (API Key, token, client secret): nasce oculto, com o olho. `false` para o identificador ao lado (Client ID). */
  mascarar?: boolean;
};

/**
 * Atributos que pedem ao navegador e aos gerenciadores de senha (1Password, LastPass, Bitwarden, Dashlane) para não preencher
 * nem oferecer salvar. Servem também a um `Campo` comum vizinho de uma chave (a InfiniteTag): espalhe em `{...semPreencher(id)}`.
 * O `dataSet` vira `data-*` no react-native-web e o `nativeID`, o `id` do `<input>`. Fora da web, desligam o autopreenchimento do
 * sistema (Android `importantForAutofill`, iOS `textContentType`).
 */
export function semPreencher(id: string) {
  return {
    autoComplete: 'off' as const,
    autoCorrect: false,
    autoCapitalize: 'none' as const,
    spellCheck: false,
    nativeID: id,
    importantForAutofill: 'no' as const,
    textContentType: 'none' as const,
    // `dataSet` não está nos tipos do React Native (o mesmo jeito do rodapé da `Folha`).
    ...({ dataSet: { '1pIgnore': 'true', lpignore: 'true', bwignore: 'true', formType: 'other' } } as object),
  };
}

/**
 * O `<input>` da web, o que o ref do `TextInput` entrega no react-native-web. Sem `name`: o react-native-web não o repassa e o
 * React 19 apaga, a cada atualização do `<input>`, o `name` que não veio das props; o `id` neutro já basta ao navegador.
 */
interface EntradaDaWeb {
  value?: string;
  addEventListener?: (tipo: string, ouvir: (e: { type: string; inputType?: string }) => void) => void;
  removeEventListener?: (tipo: string, ouvir: (e: { type: string; inputType?: string }) => void) => void;
  style?: { setProperty?: (nome: string, valor: string) => void };
}

const EVENTOS_DA_PESSOA = ['beforeinput', 'paste', 'drop', 'compositionend'] as const;

/** A máscara da web é o `-webkit-text-security` (Chrome, Edge, Safari e o Firefox recente); sem ele, o campo fica sem olho. */
function mascaraNaWeb(): boolean {
  return Platform.OS === 'web' && typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('-webkit-text-security', 'disc');
}

/** `aria-pressed` chega ao `<button>` pelo react-native-web, mas não está nos tipos do React Native (o mesmo do `CampoSenha`). */
const pressionado = (valor: boolean) => ({ 'aria-pressed': valor }) as object;

/**
 * Campo de chave ou token de integração (API Key da InfinitePay, token e client secret da Kiwify). NUNCA é campo de senha
 * (`type="password"` ou `secureTextEntry` na web): o navegador o confundia com a senha do login e o preenchia sozinho (defeito de
 * 28/11). É um campo de texto com a máscara feita aqui (`-webkit-text-security` na web; `secureTextEntry` só fora dela, onde não há
 * gerenciador de senha do navegador) e o olho "Mostrar <rótulo>", com o estado em `aria-pressed`.
 *
 * Nasce sempre vazio (quem usa nunca passa valor gravado: a API não devolve a chave) e, na web, só aceita mudança que veio de um
 * evento de entrada da pessoa (`dominio/campoDeChave`): o preenchimento automático não dispara `beforeinput`, então é ignorado e o
 * campo volta ao que estava. `aoMudar` só é chamado com o que a pessoa digitou, colou ou soltou nesta tela. Todo campo de segredo
 * de integração novo usa este, como as senhas de login usam o `CampoSenha` (com `current-password`/`new-password`).
 */
export function CampoDeChave({ id, ref, mascarar = true, rotulo, aoMudar, valor, ...resto }: Props) {
  const { cores } = useTema();
  const [oculto, setOculto] = useState(true);
  const web = Platform.OS === 'web';
  const comOlho = mascarar && (!web || mascaraNaWeb());
  // O sinal do último evento da pessoa, consumido pela mudança seguinte e esquecido na volta seguinte do laço de eventos.
  const pendente = useRef<OrigemDaMudanca | null>(null);
  const no = useRef<EntradaDaWeb | null>(null);
  const ouvir = useRef((e: { type: string; inputType?: string }) => {
    if (origemDoEvento(e) !== 'pessoa') return;
    pendente.current = 'pessoa';
    setTimeout(() => { pendente.current = null; }, 0);
  });

  const ligar = (entrada: TextInput | null) => {
    const antes = no.current;
    if (antes?.removeEventListener) for (const t of EVENTOS_DA_PESSOA) antes.removeEventListener(t, ouvir.current);
    const n = web ? (entrada as unknown as EntradaDaWeb | null) : null;
    no.current = n;
    if (n?.addEventListener) {
      for (const t of EVENTOS_DA_PESSOA) n.addEventListener(t, ouvir.current);
      // Preenchido pelo navegador antes de o React ligar o campo: começa vazio do mesmo jeito.
      if (n.value && !valor) n.value = '';
    }
    entregarRef(ref, entrada);
  };

  // A máscara da web acompanha o olho; sincroniza com o `<input>` (fora do React).
  useEffect(() => {
    if (!web || !mascarar) return;
    no.current?.style?.setProperty?.('-webkit-text-security', comOlho && oculto ? 'disc' : 'none');
  }, [web, mascarar, comOlho, oculto]);

  const Icone = oculto ? Eye : EyeOff;
  return (
    <Campo
      {...resto}
      {...semPreencher(id)}
      ref={ligar}
      rotulo={rotulo}
      valor={valor}
      aoMudar={(texto) => {
        // Fora da web não há o que filtrar: o autopreenchimento do sistema está desligado nos atributos acima.
        if (web && !mudancaAceita(pendente.current)) return;
        pendente.current = null;
        aoMudar(texto);
      }}
      secureTextEntry={!web && mascarar && oculto}
      acao={comOlho ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mostrar ${rotulo}`}
          {...(web ? pressionado(!oculto) : { accessibilityState: { checked: !oculto } })}
          onPress={() => setOculto((v) => !v)}
          style={estilos.olho}>
          <Icone size={20} color={cores.textoSuave} strokeWidth={2} />
        </Pressable>
      ) : undefined}
    />
  );
}

/** O ref de quem usa (objeto ou função) segue recebendo o campo, como no `Campo`. */
function entregarRef(destino: Ref<TextInput> | undefined, entrada: TextInput | null) {
  if (typeof destino === 'function') destino(entrada);
  else if (destino) destino.current = entrada;
}

const estilos = StyleSheet.create({
  olho: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO },
});
