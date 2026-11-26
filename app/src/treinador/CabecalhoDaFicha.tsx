import { Link, router, usePathname } from 'expo-router';
import { ArrowLeft, Ellipsis, WifiOff } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { AlunoDetalhe } from '../api/tipos';
import { artigoDaTela } from '../dominio/ajudaDaTela';
import { linhaDeDatas, seloDaSituacao } from '../dominio/cabecalhoDaFicha';
import { deixarParaONavegador, type CliqueDoNavegador } from '../dominio/cliqueDeLink';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../tema/tokens';
import { AjudaDoCabecalho } from '../ui/AjudaDoCabecalho';
import { useSaidaGuardada } from '../ui/GuardaDeSaida';
import { IconeBotao } from '../ui/IconeBotao';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';

/** Abaixo desta largura do próprio cabeçalho, o selo e o ⋯ descem para baixo do nome. */
const LARGURA_EM_LINHA = 600;
/** O ícone da seta (20 px) fica centrado no alvo de 44: a margem põe o desenho na borda esquerda de tudo (D5). */
const RECUO_DA_SETA = -(ALVO_TOQUE - 20) / 2;
/** O ⓘ "Sobre esta tela" ao lado do nome (`ui/AjudaDoCabecalho`; o "Saiba mais" vem de `dominio/ajudaDaTela`). */
const DESCRICAO = 'Tudo de um aluno num lugar: dados e acesso ao app, planos por pasta, registros, atualizações e evolução. Os dados sensíveis só aparecem com a permissão.';

interface Props {
  /** Nulo enquanto carrega ou com erro: fica só o título "Aluno" (o h1 da tela). */
  aluno: AlunoDetalhe | null;
  /** O círculo da foto (`FotoDePerfilEditavel`). */
  foto?: ReactNode;
  /** Seta e voltar do aparelho: na edição dos dados sai dela; senão volta à lista (quem chama decide). */
  aoVoltar: () => void;
  /** Abre o ⋯; sem isto o botão não aparece. */
  aoAbrirMenu?: () => void;
  /** As abas da ficha, 20 px abaixo da linha do nome, na mesma borda esquerda. */
  abas?: ReactNode;
}

/**
 * Cabeçalho da ficha do aluno (18/11, `docs/planos/ficha-do-aluno-cabecalho.md`), próprio da ficha (o `ui/Cabecalho` das
 * outras telas não muda). Linha 1: a seta sem moldura e a trilha "Alunos › nome". Linha 2, 16 px abaixo: foto de 56 px, o
 * nome (o único h1) e, em texto suave, só as datas que existem (`linhaDeDatas`); à direita o selo da situação e o ⋯, que
 * descem para baixo do nome quando o cabeçalho tem menos de 600 px. Linha 3, 20 px abaixo: as abas. Foto, nome, abas e
 * cartões partem da mesma borda esquerda.
 */
export function CabecalhoDaFicha({ aluno, foto, aoVoltar, aoAbrirMenu, abas }: Props) {
  const { offline } = useSessao();
  const { cores } = useTema();
  const { confirmar, pendente } = useSaidaGuardada();
  const caminho = usePathname();
  // Com o balão aberto, cada caixa entre o ⓘ e a raiz sobe por cima da irmã que vem depois (na web toda `View` é um contexto de
  // empilhamento: o balão não passa sozinho da caixa onde mora): a linha do nome, a identidade (datas, selo e ⋯) e a linha 2 (abas).
  const [balaoAberto, setBalaoAberto] = useState(false);
  const { width } = useWindowDimensions();
  // A largura do próprio cabeçalho (o menu lateral come parte da janela); antes da primeira medida, a da janela.
  const [largura, setLargura] = useState<number | null>(null);
  const emLinha = (largura ?? width) >= LARGURA_EM_LINHA;
  const nome = aluno?.nome ?? 'Aluno';
  const datas = aluno ? linhaDeDatas(aluno) : [];
  const situacao = aluno ? seloDaSituacao(aluno) : null;
  const lateral = situacao || aoAbrirMenu ? (
    <View style={[estilos.lateral, !emLinha && estilos.lateralEmbaixo]}>
      {situacao ? <Selo texto={situacao.texto} tipo={situacao.tipo} ponto={situacao.ponto} /> : null}
      {aoAbrirMenu ? <IconeBotao Icone={Ellipsis} moldura rotulo="Mais ações do aluno" aoTocar={aoAbrirMenu} /> : null}
    </View>
  ) : null;

  return (
    <View style={estilos.cabecalho} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      <View style={estilos.linha1}>
        <View style={estilos.seta}>
          <IconeBotao Icone={ArrowLeft} rotulo="Voltar para Alunos" aoTocar={aoVoltar} />
        </View>
        {/* A trilha é navegação (`<nav aria-label="Trilha">` na web), nunca título: o h1 é o nome, na linha de baixo. */}
        <View style={estilos.trilha} role="navigation" aria-label="Trilha">
          <Link href="/treinador/alunos" accessibilityRole="link" style={estilos.alvoDoPasso}
            onPress={(e) => {
              // Com alteração pendente a trilha pergunta antes; sem, o link segue. Ctrl/Cmd+clique abre outra guia.
              if (!pendente() || deixarParaONavegador(e as unknown as CliqueDoNavegador)) return;
              e.preventDefault();
              confirmar(() => router.navigate('/treinador/alunos'));
            }}>
            <Texto variante="suave" style={estilos.link}>Alunos</Texto>
          </Link>
          <Texto variante="suave" accessible={false}>›</Texto>
          <Texto variante="suave" numberOfLines={1} style={[estilos.atual, { color: cores.texto }]}>{nome}</Texto>
        </View>
        {offline ? <View style={estilos.semConexao}><Selo texto="Sem conexão" tipo="neutro" Icone={WifiOff} /></View> : null}
      </View>
      <View style={[estilos.linha2, emLinha ? estilos.centrada : estilos.noTopo, balaoAberto && estilos.porCima]}>
        {foto}
        <View style={[estilos.identidade, balaoAberto && estilos.porCima]}>
          <View style={[estilos.linhaDoNome, balaoAberto && estilos.porCima]}>
            <Texto variante="titulo" nivel={1} style={estilos.nome}>{nome}</Texto>
            <AjudaDoCabecalho texto={DESCRICAO} artigo={artigoDaTela(caminho)} aoMudar={setBalaoAberto} />
          </View>
          {datas.length ? (
            // Cada parte quebra inteira para a linha seguinte; o "·" fica no fim da parte, nunca no começo de uma linha.
            <View style={estilos.datas}>
              {datas.map((d, i) => (
                <Texto key={d} variante="suave" style={estilos.data}>{i < datas.length - 1 ? `${d} ·` : d}</Texto>
              ))}
            </View>
          ) : null}
          {emLinha ? null : lateral}
        </View>
        {emLinha ? lateral : null}
      </View>
      {abas ? <View style={estilos.abas}>{abas}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { gap: espaco(2) },
  porCima: { zIndex: 11 },
  linhaDoNome: { flexDirection: 'row', alignItems: 'flex-start' },
  nome: { flexShrink: 1 },
  linha1: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  seta: { marginLeft: RECUO_DA_SETA },
  trilha: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), flexShrink: 1, minWidth: 0 },
  // O link é texto na web (`<a>`): o alvo de 44 px vem do preenchimento, não do `justifyContent`.
  alvoDoPasso: { paddingVertical: (ALVO_TOQUE - 20) / 2 },
  link: { textDecorationLine: 'underline' },
  atual: { fontFamily: fontes.semi, flexShrink: 1 },
  semConexao: { marginLeft: 'auto' },
  linha2: { flexDirection: 'row', gap: espaco(2) },
  centrada: { alignItems: 'center' },
  noTopo: { alignItems: 'flex-start' },
  identidade: { flex: 1, minWidth: 0, gap: espaco(0.5) },
  datas: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(0.75) },
  data: { flexShrink: 1, maxWidth: '100%' },
  lateral: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  lateralEmbaixo: { marginTop: espaco(0.5) },
  // 16 da linha de cima mais 4: as abas ficam a 20 px do nome.
  abas: { marginTop: espaco(0.5) },
});
