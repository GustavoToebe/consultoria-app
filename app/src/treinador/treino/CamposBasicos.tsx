import { Children, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { dicaDasRepeticoes, DICA_DO_AMRAP } from '../../dominio/camposDaSerie';
import type { Problemas } from '../../dominio/validacaoDeSerie';
import { escalar } from '../../dominio/preferencias';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { Texto } from '../../ui/Texto';
import { FORMAS_DAS_REPETICOES, formaVisivel, repeticoesNaForma, type FormaDasRepeticoes, type Repeticoes } from './opcoesDoEditor';

/**
 * Peças pequenas que a série, a técnica e a metodologia dividem (linha de campos, erro e aviso de campo, repetições). Moram
 * aqui, e não em `CamposDaPrescricao`, para `CamposDaTecnica` e `CargaERirDaSerie` usarem sem import circular.
 */

/** PC (a partir do menu lateral): campos curtos lado a lado. Celular: um embaixo do outro, na largura toda. */
export function useCamposLadoALado(): boolean {
  return useWindowDimensions().width >= LARGURA_MENU_LATERAL;
}

/** Campos curtos (números) numa linha que quebra no PC; empilhados no celular. Cada filho vira uma célula. */
export function LinhaDeCampos({ children }: { children: ReactNode }) {
  const largo = useCamposLadoALado();
  return <View style={largo ? estilos.linha : estilos.bloco}>
    {Children.toArray(children).map((filho, i) => <View key={i} style={largo ? estilos.campo : null}>{filho}</View>)}
  </View>;
}

/** Um campo curto sozinho: no PC não estica além de uma célula; no celular, largura toda como os outros. */
export function CampoSozinho({ children }: { children: ReactNode }) {
  const largo = useCamposLadoALado();
  return <View style={largo ? estilos.sozinho : null}>{children}</View>;
}

/** Erro de um campo que não é de digitar (escolha de chips). */
export function ErroDoCampo({ mensagem }: { mensagem?: string | null }) {
  const { cores } = useTema();
  return mensagem ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{mensagem}</Texto> : null;
}

/** Aviso de um campo: aparece, mas não bloqueia. */
export function AvisoDoCampo({ mensagem }: { mensagem?: string | null }) {
  const { cores } = useTema();
  return mensagem ? <Texto variante="pequeno" cor={cores.atencao}>{mensagem}</Texto> : null;
}

/** Na faixa da estrutura a escolha é curta ("Faixa | Exata | AMRAP"): o número fica logo ao lado dela. */
const FORMAS_CURTAS: { valor: FormaDasRepeticoes; rotulo: string }[] = [
  { valor: 'FAIXA', rotulo: 'Faixa' },
  { valor: 'EXATA', rotulo: 'Exata' },
  { valor: 'AMRAP', rotulo: 'AMRAP' },
];

/** Caixa do número das repetições compactas: três dígitos ("100") e o padding; cresce com o texto da pessoa. */
const LARGURA_DO_NUMERO_COMPACTO = 64;
/** Área das repetições na Estrutura: a da escolha Faixa | Exata | AMRAP, igual nas três formas (o Descanso não pula). */
export const LARGURA_DAS_REPETICOES = 200;

/**
 * Quantidade exata, faixa ou AMRAP. A escolha fica com a tela enquanto o valor não a distingue (faixa 8 a 8, ou vazio).
 * `semRepeticoes` explica o vazio quando ele vale (série por tempo); sem ele, o vazio é só incompleto. `compacta` é a da
 * faixa da estrutura: escolha curta e os números na mesma linha, com "mín", "máx" ou "reps" dentro da caixa.
 */
export function CamposDasRepeticoes({ valor, aoMudar, erros, rotulo = 'Repetições', rotuloVisivel = true, semRepeticoes, compacta = false, forma: formaDeFora, aoEscolherForma }: {
  valor: { repsMin?: number | null; repsMax?: number | null; amrap?: boolean | null }; aoMudar: (r: Repeticoes) => void;
  erros: Problemas; rotulo?: string; semRepeticoes?: string;
  /** Falso quando o título da seção já diz o mesmo: o rótulo fica só para o leitor de tela. */
  rotuloVisivel?: boolean;
  compacta?: boolean;
  /**
   * A forma guardada por quem usa (a série, 27/11): o erro e a dica de uma linha ficam fora, embaixo da linha inteira da
   * Estrutura (`rodapeDasRepeticoes`), para a frase do AMRAP caber numa linha sem a área mudar de largura.
   */
  forma?: FormaDasRepeticoes; aoEscolherForma?: (f: FormaDasRepeticoes) => void;
}) {
  const { fatorTexto } = useTema();
  const [escolhidaAqui, setEscolhida] = useState<FormaDasRepeticoes>(formaVisivel(compacta ? 'FAIXA' : 'EXATA', valor));
  const escolhida = formaDeFora ?? escolhidaAqui;
  const forma = formaVisivel(escolhida, valor);
  const mudarForma = (f: FormaDasRepeticoes) => {
    setEscolhida(f);
    aoEscolherForma?.(f);
    if (f !== forma) aoMudar(repeticoesNaForma(f, valor));
  };
  const vazio = valor.repsMin == null && valor.repsMax == null && !valor.amrap;
  // Com rótulo próprio (uma retomada), os campos ganham o nome dela no leitor de tela: "Retomada 1: reps mín.".
  const proprio = rotulo !== 'Repetições';
  const nome = (curto: string) => (proprio ? `${rotulo}: ${curto.toLowerCase()}` : curto);
  const exata = (n: number | null) => aoMudar({ repsMin: n, repsMax: n, amrap: false });
  const minimo = (repsMin: number | null) => aoMudar({ repsMin, repsMax: valor.repsMax ?? null, amrap: false });
  const maximo = (repsMax: number | null) => aoMudar({ repsMin: valor.repsMin ?? null, repsMax, amrap: false });
  const rodape = <>
    {forma === 'AMRAP' ? <Texto variante="pequeno">{DICA_DO_AMRAP}</Texto> : null}
    <ErroDoCampo mensagem={forma === 'AMRAP' ? erros.amrap : null} />
    {vazio && forma !== 'AMRAP' && semRepeticoes ? <Texto variante="pequeno">{semRepeticoes}</Texto> : null}
  </>;
  if (compacta) {
    // 27/11: a escolha em cima e os números embaixo, numa área de largura fixa (o Descanso ao lado não pula ao trocar a
    // forma). Sem a unidade dentro da caixa: "8 a 12 reps" se lê pelo texto entre os campos.
    const caixa = { width: escalar(LARGURA_DO_NUMERO_COMPACTO, fatorTexto) };
    const { erro, dica } = rodapeDasRepeticoes(forma, valor, erros, !!semRepeticoes);
    return <View style={[estilos.juntos, estilos.limitada, { width: escalar(LARGURA_DAS_REPETICOES, fatorTexto) }]}>
      {rotuloVisivel ? <Texto variante="rotulo">{rotulo}</Texto> : null}
      <Escolha descricao={rotulo} compacta opcoes={FORMAS_CURTAS} valor={forma} aoMudar={mudarForma} />
      {forma === 'EXATA' ? <View style={estilos.linhaDosNumeros}>
        <View style={caixa}><CampoNumerico rotulo={nome('Repetições')} rotuloOculto erroSemTexto inteiro valor={valor.repsMin ?? valor.repsMax ?? null}
          aoMudar={exata} erro={erros.repsMin ?? erros.repsMax} /></View>
        <Texto variante="suave" aria-hidden>reps</Texto>
      </View> : null}
      {forma === 'FAIXA' ? <View style={estilos.linhaDosNumeros}>
        <View style={caixa}><CampoNumerico rotulo={nome('Reps mín.')} rotuloOculto erroSemTexto inteiro valor={valor.repsMin ?? null}
          aoMudar={minimo} erro={erros.repsMin} /></View>
        <Texto variante="suave" aria-hidden>a</Texto>
        <View style={caixa}><CampoNumerico rotulo={nome('Reps máx.')} rotuloOculto erroSemTexto inteiro valor={valor.repsMax ?? null}
          aoMudar={maximo} erro={erros.repsMax} /></View>
        <Texto variante="suave" aria-hidden>reps</Texto>
      </View> : null}
      {/* Uma linha só: o erro (a frase do campo estreito) ou a dica do estado; fora daqui quando quem usa guarda a forma. */}
      {formaDeFora ? null : <RodapeDasRepeticoes erro={erro} dica={dica} />}
    </View>;
  }
  return <View style={estilos.bloco}>
    <Escolha rotulo={rotuloVisivel ? rotulo : undefined} descricao={rotulo} opcoes={FORMAS_DAS_REPETICOES} valor={forma} aoMudar={mudarForma} />
    {forma === 'EXATA' ? <CampoSozinho>
      <CampoNumerico rotulo="Repetições" rotuloAcessivel={proprio ? `${rotulo}: repetições` : undefined} inteiro valor={valor.repsMin ?? valor.repsMax ?? null}
        aoMudar={exata} erro={erros.repsMin ?? erros.repsMax} />
    </CampoSozinho> : null}
    {forma === 'FAIXA' ? <View style={estilos.linha}>
      <View style={estilos.campo}><CampoNumerico rotulo="Reps mín." rotuloAcessivel={proprio ? `${rotulo}: reps mín.` : undefined} inteiro valor={valor.repsMin ?? null}
        aoMudar={minimo} erro={erros.repsMin} /></View>
      <View style={estilos.campo}><CampoNumerico rotulo="Reps máx." rotuloAcessivel={proprio ? `${rotulo}: reps máx.` : undefined} inteiro valor={valor.repsMax ?? null}
        aoMudar={maximo} erro={erros.repsMax} /></View>
    </View> : null}
    {rodape}
  </View>;
}

/** O erro (vence) ou a dica de uma linha das repetições compactas. */
export function rodapeDasRepeticoes(forma: FormaDasRepeticoes, valor: { repsMin?: number | null; repsMax?: number | null }, erros: Problemas, porTempo: boolean) {
  return { erro: forma === 'AMRAP' ? erros.amrap : erros.repsMin ?? erros.repsMax, dica: dicaDasRepeticoes(forma, valor, porTempo) };
}

export function RodapeDasRepeticoes({ erro, dica }: { erro?: string | null; dica?: string | null }) {
  return erro ? <ErroDoCampo mensagem={erro} /> : dica ? <Texto variante="pequeno">{dica}</Texto> : null;
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  juntos: { gap: espaco(0.5) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  linhaDosNumeros: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  limitada: { maxWidth: '100%', flexShrink: 1 },
  campo: { minWidth: 130, flexGrow: 1, flexBasis: 130, maxWidth: 220 },
  sozinho: { width: '100%', maxWidth: 220 },
});
