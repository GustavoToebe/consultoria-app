import { useId, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { escalar } from '../../dominio/preferencias';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { CampoNumerico } from '../../ui/Campos';
import { Texto } from '../../ui/Texto';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';

/**
 * Peças do formulário da série aberta (proposta de 27/11): a linha de configuração (nome à esquerda, controles à direita,
 * divisória entre as linhas) e o campo numérico curto com a unidade em texto ao lado. Seletores e campos têm a mesma altura.
 */
export const ALTURA_DO_CONTROLE = 46;
export const LARGURA_DO_NOME_DA_LINHA = 124;
/** Abaixo disto (largura medida da própria linha), o nome sobe para cima dos controles. */
export const LARGURA_PARA_EMPILHAR = 520;

/** Empilha (nome em cima, controles e dica embaixo) quando a linha é estreita; sem medida ainda, vale a da janela. */
export function deveEmpilhar(larguraDaLinha: number, larguraDaJanela: number): boolean {
  return (larguraDaLinha > 0 ? larguraDaLinha : larguraDaJanela) < LARGURA_PARA_EMPILHAR;
}

/**
 * Uma linha do formulário: `nome` na coluna de 124 px (texto suave), os `children` à direita numa fileira que quebra, o ⓘ
 * (`info`, o botão "O que é…" do chamador) depois dos controles e UMA `dica` embaixo, alinhada ao início dos controles.
 * Para o leitor de tela a linha é um grupo nomeado pelo próprio nome visível, com a dica ligada. `ultima` tira a divisória de baixo.
 */
export function LinhaDoFormulario({ nome, info, dica, ultima, children }: {
  nome: string;
  info?: ReactNode;
  dica?: string | ReactNode;
  ultima?: boolean;
  children: ReactNode;
}) {
  const { cores, fatorTexto } = useTema();
  const { largura, aoMedir } = useFaixaDeLargura();
  const janela = useWindowDimensions().width;
  const empilhada = deveEmpilhar(largura, janela);
  const id = useId();
  const temDica = dica !== undefined && dica !== null && dica !== false && dica !== '';
  return (
    // O nome do grupo é o texto visível (`aria-labelledby`, como a `LinhaDeConfiguracao`): com `accessibilityLabel` o leitor
    // de tela o leria duas vezes. O RN não tipa `aria-describedby`; o react-native-web o leva à linha.
    <View onLayout={aoMedir} role="group" aria-labelledby={`${id}-nome`}
      {...(temDica ? ({ 'aria-describedby': `${id}-dica` } as object) : null)}
      style={[estilos.linha, empilhada ? estilos.empilhada : estilos.lado, ultima ? null : { borderBottomWidth: 1, borderBottomColor: cores.divisor }]}>
      <View style={empilhada ? null : [estilos.nome, { width: escalar(LARGURA_DO_NOME_DA_LINHA, fatorTexto) }]}>
        <Texto nativeID={`${id}-nome`} cor="suave">{nome}</Texto>
      </View>
      <View style={[estilos.coluna, empilhada ? null : estilos.colunaAoLado]}>
        <View style={estilos.controles}>
          {children}
          {info}
        </View>
        {temDica ? (
          <View nativeID={`${id}-dica`}>
            {typeof dica === 'string' ? <Texto variante="pequeno">{dica}</Texto> : dica}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Número curto da série (reps, % da WS, segundos, kg): 46 de altura e ~64 de largura (as duas crescem com o texto), número centralizado em mono negrito e
 * a `unidade` em texto ao lado ("a", "reps", "% da WS"). Sem rótulo visível: `rotulo` é o nome para o leitor de tela e deve
 * dizer o que é ("Série 1 · Reps mín."). O erro marca a caixa e vai ao leitor de tela; a frase fica com quem usa (a `dica`
 * da linha), porque embaixo de um campo de 64 px ela quebraria a fileira. A largura acompanha o tamanho do texto; 64 cabe
 * até 3 dígitos (reps, %, segundos): carga em kg ou com casa decimal ("102,5") pede `larguraDoCampo` de ~88.
 */
export function CampoDaSerie({ rotulo, valor, aoMudar, inteiro, mascara, erro, aoDigitar, unidade, larguraDoCampo = 64 }: {
  rotulo: string;
  valor: number | null;
  aoMudar: (valor: number | null) => void;
  inteiro?: boolean;
  mascara?: (texto: string) => string;
  erro?: string | null;
  aoDigitar?: () => void;
  unidade?: string;
  larguraDoCampo?: number;
}) {
  const { fatorTexto } = useTema();
  return (
    <View style={estilos.campoDaSerie}>
      <View style={{ width: escalar(larguraDoCampo, fatorTexto) }}>
        {/* A altura acompanha o texto, como a largura: com letra grande o número mono não corta (46 no tamanho normal). */}
        <CampoNumerico rotulo={rotulo} rotuloOculto erroSemTexto altura={escalar(ALTURA_DO_CONTROLE, fatorTexto)} mono centralizado
          valor={valor} aoMudar={aoMudar} inteiro={inteiro} mascara={mascara} erro={erro} aoDigitar={aoDigitar} />
      </View>
      {unidade ? <Texto variante="suave" aria-hidden>{unidade}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { paddingVertical: espaco(1.5) },
  lado: { flexDirection: 'row', gap: espaco(2) },
  empilhada: { gap: espaco(1) },
  // Largura (124 × tamanho do texto) no estilo da linha. A altura do controle centraliza o nome com a primeira fileira, mesmo quando os controles quebram.
  nome: { minHeight: ALTURA_DO_CONTROLE, justifyContent: 'center' },
  coluna: { gap: espaco(0.75) },
  colunaAoLado: { flex: 1, minWidth: 0 },
  controles: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1.5), rowGap: espaco(1) },
  campoDaSerie: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
});
