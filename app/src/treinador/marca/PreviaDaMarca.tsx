import { Dumbbell, House, Salad, UserRound, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Marca, Tema } from '../../api/tipos';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, marcaParaPeca, marcaParaTexto, paletaDe, RAIO, RAIO_CONTROLE, textoSobre, type Cores } from '../../tema/tokens';
import { MarcaTitulo } from '../../ui/MarcaTitulo';
import { Texto } from '../../ui/Texto';
import { LARGURA_DO_CELULAR } from './arranjoDaMarca';

const ALTURA_DO_CELULAR = 560;

interface Props {
  marca: Marca;
  tema: Tema;
  /** `dupla`: o Início e a tela de entrar lado a lado (tela larga); `unica`: só o Início. */
  modo: 'dupla' | 'unica';
}

/**
 * Prévia ao vivo do que o aluno vê, com as cores FIXAS da paleta escolhida (não as do tema de quem edita): o celular com
 * o Início (topo com a marca, o treino do dia com "Começar", uma refeição e a barra de baixo) e, na tela larga, a tela de
 * entrar (marca e o botão na cor da marca). Dados fictícios, nada é tocável: é desenho, lido como uma imagem só.
 */
export function PreviaDaMarca({ marca, tema, modo }: Props) {
  const { nome, cores } = paletaDe(tema);
  return (
    <View style={estilos.previa}>
      <Texto variante="suave">{`Paleta ${nome}`}</Texto>
      <View style={estilos.celulares}>
        <Celular legenda="Início do aluno" cores={cores}>
          <InicioDoAluno marca={marca} cores={cores} />
        </Celular>
        {modo === 'dupla' ? (
          <Celular legenda="Tela de entrar" cores={cores}>
            <TelaDeEntrar marca={marca} cores={cores} />
          </Celular>
        ) : null}
      </View>
    </View>
  );
}

function Celular({ legenda, cores, children }: { legenda: string; cores: Cores; children: ReactNode }) {
  const { cores: atuais } = useTema();
  return (
    <View style={estilos.coluna}>
      <View
        role="img"
        aria-label={`Prévia: ${legenda}`}
        testID={legenda === 'Início do aluno' ? 'previa-da-paleta' : 'previa-de-entrar'}
        style={[estilos.celular, { backgroundColor: cores.fundo, borderColor: atuais.bordaCampo }]}>
        {children}
      </View>
      <Texto variante="pequeno" aria-hidden style={estilos.legenda}>{legenda}</Texto>
    </View>
  );
}

const ABAS: { rotulo: string; Icone: LucideIcon }[] = [
  { rotulo: 'Início', Icone: House },
  { rotulo: 'Treino', Icone: Dumbbell },
  { rotulo: 'Dieta', Icone: Salad },
  { rotulo: 'Conta', Icone: UserRound },
];

function InicioDoAluno({ marca, cores }: { marca: Marca; cores: Cores }) {
  const peca = marcaParaPeca(marca.corPrimaria, [cores.superficie, cores.fundo]);
  const cartao = { backgroundColor: cores.superficie, borderColor: cores.divisor };
  return (
    <>
      <View style={estilos.corpo}>
        <View style={estilos.topo}>
          <View style={estilos.marca}><MarcaTitulo marca={marca} tamanho="pequeno" fundo={cores.fundo} /></View>
          <View style={[estilos.foto, { backgroundColor: cores.superficie3 }]}>
            <Texto style={[estilos.iniciais, { color: cores.texto }]}>AF</Texto>
          </View>
        </View>
        <View>
          <Texto style={[estilos.ola, { color: cores.texto }]}>Olá, Ana</Texto>
          <Texto style={[estilos.miudo, { color: cores.textoSuave }]}>Segunda-feira</Texto>
        </View>
        <View style={[estilos.cartao, cartao]}>
          <Texto style={[estilos.rotulo, { color: marcaParaTexto(marca.corPrimaria, cores.superficie) }]}>TREINO A</Texto>
          <Texto style={[estilos.titulo, { color: cores.texto }]}>Costas e bíceps</Texto>
          <Texto style={[estilos.miudo, { color: cores.textoSuave }]}>6 exercícios</Texto>
          <View style={[estilos.botao, { backgroundColor: peca }]}>
            <Texto style={[estilos.textoDoBotao, { color: textoSobre(peca) }]}>Começar</Texto>
          </View>
        </View>
        <View style={[estilos.cartao, cartao]}>
          <Texto style={[estilos.secao, { color: cores.textoSuave }]}>PRÓXIMA REFEIÇÃO</Texto>
          <Texto style={[estilos.item, { color: cores.texto }]}>Almoço · 12h30</Texto>
          <Texto style={[estilos.miudo, { color: cores.textoSuave }]}>Arroz, feijão e frango grelhado</Texto>
        </View>
      </View>
      <View style={[estilos.barra, { backgroundColor: cores.superficie, borderTopColor: cores.divisor }]}>
        {ABAS.map(({ rotulo, Icone }, i) => {
          const ativa = i === 0;
          return (
            <View key={rotulo} style={estilos.aba}>
              <View style={[estilos.pilula, ativa ? { backgroundColor: cores.superficie3 } : null]}>
                <Icone size={18} color={ativa ? cores.texto : cores.textoSuave} strokeWidth={2} />
              </View>
              <Texto style={[estilos.rotuloDaAba, { color: ativa ? cores.texto : cores.textoSuave, fontFamily: ativa ? fontes.semi : fontes.normal }]}>{rotulo}</Texto>
            </View>
          );
        })}
      </View>
    </>
  );
}

function TelaDeEntrar({ marca, cores }: { marca: Marca; cores: Cores }) {
  const campo = { backgroundColor: cores.superficie2, borderColor: cores.bordaCampo };
  return (
    <View style={estilos.entrar}>
      <View style={estilos.cabecaDeEntrar}>
        <MarcaTitulo marca={marca} tamanho="grande" fundo={cores.fundo} />
        <Texto style={[estilos.miudo, estilos.centro, { color: cores.textoSuave }]}>Entre para ver seu treino e sua dieta.</Texto>
      </View>
      <View style={estilos.campos}>
        {['E-mail', 'Senha'].map((r) => (
          <View key={r} style={estilos.campo}>
            <Texto style={[estilos.rotuloDoCampo, { color: cores.texto }]}>{r}</Texto>
            <View style={[estilos.caixa, campo]} />
          </View>
        ))}
        <View style={[estilos.botao, estilos.botaoCheio, { backgroundColor: marca.corPrimaria }]}>
          <Texto style={[estilos.textoDoBotao, { color: textoSobre(marca.corPrimaria) }]}>Entrar</Texto>
        </View>
        <Texto style={[estilos.miudo, estilos.centro, { color: cores.textoSuave }]}>Esqueci a senha</Texto>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  previa: { gap: espaco(1) },
  celulares: { flexDirection: 'row', justifyContent: 'center', gap: espaco(2) },
  coluna: { flex: 1, minWidth: 0, maxWidth: LARGURA_DO_CELULAR, gap: espaco(1) },
  celular: { minHeight: ALTURA_DO_CELULAR, flexGrow: 1, borderWidth: 1, borderRadius: 28, overflow: 'hidden', justifyContent: 'space-between' },
  legenda: { textAlign: 'center' },
  corpo: { padding: espaco(2), gap: espaco(1.5) },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  marca: { flexShrink: 1, minWidth: 0 },
  foto: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iniciais: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 16 },
  ola: { fontFamily: fontes.semi, fontSize: 20, lineHeight: 26 },
  miudo: { fontFamily: fontes.normal, fontSize: 13, lineHeight: 18 },
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.5) },
  rotulo: { fontFamily: fontes.negrito, fontSize: 12, lineHeight: 16, letterSpacing: 1 },
  secao: { fontFamily: fontes.semi, fontSize: 11, lineHeight: 16, letterSpacing: 0.6 },
  titulo: { fontFamily: fontes.negrito, fontSize: 20, lineHeight: 26 },
  item: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 20 },
  botao: { alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: espaco(2), borderRadius: RAIO_CONTROLE, justifyContent: 'center', alignItems: 'center', marginTop: espaco(0.5) },
  botaoCheio: { alignSelf: 'stretch', minHeight: ALVO_TOQUE },
  textoDoBotao: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 20 },
  barra: { flexDirection: 'row', borderTopWidth: 1, paddingVertical: espaco(1), paddingHorizontal: espaco(0.5) },
  aba: { flex: 1, alignItems: 'center', gap: 2 },
  pilula: { paddingHorizontal: espaco(1.5), paddingVertical: 4, borderRadius: 999 },
  rotuloDaAba: { fontSize: 11, lineHeight: 14 },
  entrar: { flex: 1, padding: espaco(2.5), justifyContent: 'center', gap: espaco(3) },
  cabecaDeEntrar: { alignItems: 'center', gap: espaco(1) },
  centro: { textAlign: 'center' },
  campos: { gap: espaco(1.5) },
  campo: { gap: 4 },
  rotuloDoCampo: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 18 },
  caixa: { height: 40, borderWidth: 1, borderRadius: RAIO_CONTROLE },
});
