import { Children, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
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

/** Cabe "20" e o "mín"/"reps" dentro da caixa no tamanho de texto padrão; cresce com o texto da pessoa. */
const LARGURA_DO_NUMERO = 92;

/**
 * Quantidade exata, faixa ou AMRAP. A escolha fica com a tela enquanto o valor não a distingue (faixa 8 a 8, ou vazio).
 * `semRepeticoes` explica o vazio quando ele vale (série por tempo); sem ele, o vazio é só incompleto. `compacta` é a da
 * faixa da estrutura: escolha curta e os números na mesma linha, com "mín", "máx" ou "reps" dentro da caixa.
 */
export function CamposDasRepeticoes({ valor, aoMudar, erros, rotulo = 'Repetições', rotuloVisivel = true, semRepeticoes, compacta = false }: {
  valor: { repsMin?: number | null; repsMax?: number | null; amrap?: boolean | null }; aoMudar: (r: Repeticoes) => void;
  erros: Problemas; rotulo?: string; semRepeticoes?: string;
  /** Falso quando o título da seção já diz o mesmo: o rótulo fica só para o leitor de tela. */
  rotuloVisivel?: boolean;
  compacta?: boolean;
}) {
  const { fatorTexto } = useTema();
  const [escolhida, setEscolhida] = useState<FormaDasRepeticoes>(formaVisivel(compacta ? 'FAIXA' : 'EXATA', valor));
  const forma = formaVisivel(escolhida, valor);
  const mudarForma = (f: FormaDasRepeticoes) => {
    setEscolhida(f);
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
    {forma === 'AMRAP' ? <Texto variante="pequeno">O aluno faz o máximo de repetições que conseguir e anota quantas fez.</Texto> : null}
    <ErroDoCampo mensagem={forma === 'AMRAP' ? erros.amrap : null} />
    {vazio && forma !== 'AMRAP' && semRepeticoes ? <Texto variante="pequeno">{semRepeticoes}</Texto> : null}
  </>;
  if (compacta) {
    const largura = { width: escalar(LARGURA_DO_NUMERO, fatorTexto) };
    // Limitada à largura de quem a contém: numa linha que quebra (a Estrutura), sem isso ela não quebra por dentro em 390 px.
    return <View style={[estilos.juntos, estilos.limitada]}>
      {rotuloVisivel ? <Texto variante="rotulo">{rotulo}</Texto> : null}
      <View style={estilos.linhaCompacta}>
        <Escolha descricao={rotulo} compacta opcoes={FORMAS_CURTAS} valor={forma} aoMudar={mudarForma} />
        {forma === 'EXATA' ? <View style={largura}>
          <CampoNumerico rotulo={nome('Repetições')} rotuloOculto sufixo="reps" sufixoNaCaixa erroSemTexto inteiro valor={valor.repsMin ?? valor.repsMax ?? null}
            aoMudar={exata} erro={erros.repsMin ?? erros.repsMax} />
        </View> : null}
        {forma === 'FAIXA' ? <>
          <View style={largura}><CampoNumerico rotulo={nome('Reps mín.')} rotuloOculto sufixo="mín" sufixoNaCaixa erroSemTexto inteiro valor={valor.repsMin ?? null}
            aoMudar={minimo} erro={erros.repsMin} /></View>
          <View style={largura}><CampoNumerico rotulo={nome('Reps máx.')} rotuloOculto sufixo="máx" sufixoNaCaixa erroSemTexto inteiro valor={valor.repsMax ?? null}
            aoMudar={maximo} erro={erros.repsMax} /></View>
        </> : null}
      </View>
      {/* Na caixa estreita o erro só marca a borda: a frase vem embaixo da linha inteira. */}
      <ErroDoCampo mensagem={forma === 'AMRAP' ? null : erros.repsMin ?? erros.repsMax} />
      {rodape}
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

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  juntos: { gap: espaco(0.5) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  linhaCompacta: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1), alignItems: 'center' },
  limitada: { maxWidth: '100%', flexShrink: 1 },
  campo: { minWidth: 130, flexGrow: 1, flexBasis: 130, maxWidth: 220 },
  sozinho: { width: '100%', maxWidth: 220 },
});
