import { ImagePlus } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Botao } from './Botao';
import { MensagemDeErro } from './Campo';
import { LinhaDeAcoes } from './LinhaDeAcoes';
import { sobre } from './sobre';
import { Texto } from './Texto';

interface Props {
  /** O que é a foto ("Foto do item"): vai no nome acessível da área e dos botões. */
  rotulo: string;
  /** Formato e limite, vindos da regra de quem usa (nunca escritos aqui): "JPEG, até 300 KB". */
  dica: string;
  /** A prévia já montada por quem usa (do servidor ou local), no tamanho `lado`; `null` = vazia. */
  previa: ReactNode | null;
  /** Lado do quadrado (1:1), em px. */
  lado?: number;
  /** Abrir a galeria (vazia: o quadro inteiro; preenchida: "Trocar"). */
  aoEscolher: () => void;
  /** Só na web: arquivo solto sobre o quadro (vazio ou preenchido). Sem ela, o quadro não aceita soltar. */
  aoSoltarArquivo?: (arquivo: File) => void;
  /** "Remover" (`perigoTexto`), só com prévia. */
  aoRemover?: () => void;
  /** "Tentar de novo" ao lado do erro (envio que falhou, com a foto ainda guardada). */
  aoTentarDeNovo?: () => void;
  /** Ações a mais embaixo do quadro (ex.: "Tirar foto" no celular). */
  extras?: ReactNode;
  carregando?: boolean;
  desabilitado?: boolean;
  erro?: string | null;
}

const WEB = Platform.OS === 'web';

/**
 * Área de uma foto única (item da vitrine; feita para servir também a outras fotos de cadastro). Quadrada (1:1). Vazia:
 * quadro tracejado inteiro clicável, com "Escolher foto" e a dica dentro, que na web também aceita soltar um arquivo.
 * Preenchida: a prévia com "Trocar" (`secundario`) e "Remover" (`perigoTexto`) embaixo. O erro fica sob o quadro, com
 * "Tentar de novo" quando quem usa oferece. A peça não lê arquivo nem fala com a API: só chama de volta.
 */
export function AreaDeFoto({ rotulo, dica, previa, lado = 180, aoEscolher, aoSoltarArquivo, aoRemover, aoTentarDeNovo, extras, carregando, desabilitado, erro }: Props) {
  const { cores } = useTema();
  const quadro = useRef<View>(null);
  const [soltando, setSoltando] = useState(false);
  const bloqueado = !!desabilitado || !!carregando;
  const temPrevia = !!previa;
  const aceitaSoltar = WEB && !!aoSoltarArquivo && !bloqueado;
  const soltarRef = useRef(aoSoltarArquivo);
  useEffect(() => { soltarRef.current = aoSoltarArquivo; });

  // O react-native-web não repassa os eventos de arrastar arquivo: vão direto no elemento, com limpeza. Vazia e preenchida
  // são nós diferentes: trocar de uma para a outra liga os ouvintes no nó novo.
  useEffect(() => {
    const no = quadro.current as unknown as HTMLElement | null;
    if (!aceitaSoltar || !no?.addEventListener) return undefined;
    const sobreODestino = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); setSoltando(true); } };
    const saiu = () => setSoltando(false);
    const soltou = (e: DragEvent) => {
      e.preventDefault();
      setSoltando(false);
      const arquivo = e.dataTransfer?.files?.[0];
      if (arquivo) soltarRef.current?.(arquivo);
    };
    no.addEventListener('dragover', sobreODestino);
    no.addEventListener('dragleave', saiu);
    no.addEventListener('drop', soltou);
    return () => { no.removeEventListener('dragover', sobreODestino); no.removeEventListener('dragleave', saiu); no.removeEventListener('drop', soltou); };
  }, [aceitaSoltar, temPrevia]);

  const tamanho = { width: lado, height: lado };
  const destaqueDoSoltar = soltando ? { borderColor: cores.acao, backgroundColor: cores.acaoSuave } : null;
  return (
    <View style={estilos.area}>
      {previa ? (
        <View ref={quadro} collapsable={false} style={[estilos.quadro, tamanho, { borderColor: soltando ? cores.acao : cores.divisor }]}
          accessibilityState={{ busy: !!carregando }}>
          {previa}
          {carregando ? <Carregando cor={cores.texto} fundo={cores.superficie} /> : null}
        </View>
      ) : (
        <Pressable ref={quadro} collapsable={false} accessibilityRole="button" accessibilityLabel={`${rotulo}: escolher foto. ${dica}`}
          accessibilityState={{ disabled: bloqueado, busy: !!carregando }} disabled={bloqueado} onPress={aoEscolher}
          style={(estado) => [
            estilos.quadro, estilos.vazio, tamanho,
            { borderColor: cores.bordaCampo, backgroundColor: sobre(estado) ? cores.sobre : cores.superficie2 },
            // Foco do teclado: a borda vira o anel de foco (o tracejado sozinho não mostra onde o foco está).
            (estado as { focused?: boolean }).focused ? { borderColor: cores.anelFoco, borderStyle: 'solid' as const } : null,
            destaqueDoSoltar,
          ]}>
          <ImagePlus size={28} color={cores.textoSuave} strokeWidth={1.75} aria-hidden />
          <Texto variante="rotulo" cor={cores.texto} style={estilos.centro}>{soltando ? 'Solte para usar' : 'Escolher foto'}</Texto>
          <Texto variante="pequeno" style={estilos.centro}>{dica}</Texto>
          {carregando ? <Carregando cor={cores.texto} fundo={cores.superficie} /> : null}
        </Pressable>
      )}
      {previa || extras ? (
        <LinhaDeAcoes>
          {previa ? <Botao rotulo="Trocar" rotuloAcessivel={`Trocar ${rotulo.toLowerCase()}`} tipo="secundario"
            aoTocar={aoEscolher} desabilitado={bloqueado} /> : null}
          {previa && aoRemover ? <Botao rotulo="Remover" rotuloAcessivel={`Remover ${rotulo.toLowerCase()}`} tipo="perigoTexto"
            aoTocar={aoRemover} desabilitado={bloqueado} /> : null}
          {extras}
        </LinhaDeAcoes>
      ) : null}
      {erro ? (
        <View style={[estilos.erro, { maxWidth: Math.max(lado, 240) }]}>
          <MensagemDeErro erro={erro} />
          {aoTentarDeNovo ? <Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={aoTentarDeNovo} desabilitado={bloqueado} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function Carregando({ cor, fundo }: { cor: string; fundo: string }) {
  return (
    <View style={[StyleSheet.absoluteFill, estilos.carregando, { backgroundColor: fundo }]} aria-hidden>
      <ActivityIndicator color={cor} />
    </View>
  );
}

const estilos = StyleSheet.create({
  area: { gap: espaco(1), alignItems: 'flex-start' },
  quadro: { borderRadius: RAIO, borderWidth: 1, overflow: 'hidden' },
  vazio: { borderStyle: 'dashed', borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: espaco(0.5), padding: espaco(1.5) },
  centro: { textAlign: 'center' },
  carregando: { alignItems: 'center', justifyContent: 'center', opacity: 0.8 },
  erro: { gap: espaco(1), alignItems: 'flex-start' },
});
