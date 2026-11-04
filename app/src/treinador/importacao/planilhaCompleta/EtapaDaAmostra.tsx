import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Platform, StyleSheet, View } from 'react-native';

import { amostraDaPlanilhaCompleta } from '../../../api/rotas';
import type { AlunoDaAmostra, AmostraDaPlanilha, ConteudoDieta, ConteudoTreino, PartePuladaDaPlanilha } from '../../../api/tipos';
import {
  PASTA_DA_IMPORTACAO, SEM_PAR_NA_BIBLIOTECA, contarDieta, faixaDaAmostra, ficaDeFora, foraDaBiblioteca, pesosDoMaisRecente,
  restantesDaAmostra, resumoDoAluno, rotuloDosProximos, situacaoDoAluno, textoDaDieta, textoDaPasta, textoDaRefeicao, textoDaSessao,
  textoDoAtivo, textoDoCadastroExistente, textoDoExercicio, textoDoItem, textoDoPeso, textoDosPesos, textoDoSuplemento, textoDoTreino, valorDoCampo,
} from '../../../dominio/amostraDaPlanilha';
import { normalizarDieta } from '../../../dominio/dieta';
import { normalizarTreino } from '../../../dominio/editorTreino';
import { SEM_DADO } from '../../../dominio/formatos';
import { useTema } from '../../../tema/TemaProvider';
import { RAIO, espaco } from '../../../tema/tokens';
import { Botao } from '../../../ui/Botao';
import { CabecalhoDeGrupo } from '../../../ui/CabecalhoDeGrupo';
import { CampoLeitura } from '../../../ui/CampoLeitura';
import { Cartao } from '../../../ui/Cartao';
import { Esqueleto } from '../../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../../ui/Estados';
import { LinhaDeAcoes } from '../../../ui/LinhaDeAcoes';
import { Selo } from '../../../ui/Selo';
import { Texto } from '../../../ui/Texto';
import { codigoApi, textoDoErro } from '../../../ui/erros';
import { FolhaVerComoAluno, type PreviaDoPlano } from '../../plano/FolhaVerComoAluno';

/** O estado da amostra que o assistente guarda (só na memória da tela: nada no aparelho). */
export interface AmostraNaTela {
  pagina: AmostraDaPlanilha | null;
  /** Há uma página antes da atual (já carregada). */
  temAnterior: boolean;
  carregando: boolean;
  erro: unknown;
  /** 503 `MIGRACAO_INDISPONIVEL`: a chave foi desligada na API; a etapa some. */
  indisponivel: boolean;
  /** O `hash` da amostra (o mesmo da prévia: arquivo + respostas), que vai na confirmação. */
  hash: string | null;
  abrir: () => void;
  proximos: () => void;
  anteriores: () => void;
  limpar: () => void;
}

/**
 * Migração assistida, fase 2: as páginas da amostra (`POST /importacoes/planilha-completa/amostra?inicio=`). `montar` faz o
 * FormData do arquivo com as respostas (as mesmas da prévia, senão o hash muda e a confirmação leva 409). As páginas já
 * vistas ficam na memória (voltar não pede de novo: a amostra gasta o limite de tentativas da prévia); só a resposta do
 * último pedido vale. 503 `MIGRACAO_INDISPONIVEL` chama `aoIndisponivel` e não vira erro na tela.
 */
export function useAmostraDaPlanilha(montar: (() => Promise<FormData>) | null, aoIndisponivel: () => void): AmostraNaTela {
  const [paginas, setPaginas] = useState<AmostraDaPlanilha[]>([]);
  const [atual, setAtual] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const pedido = useRef(0);
  const pagina = paginas[atual] ?? null;

  const buscar = (inicio: number) => {
    if (!montar || carregando || indisponivel) return;
    const meu = ++pedido.current;
    setCarregando(true);
    setErro(null);
    montar().then((dados) => amostraDaPlanilhaCompleta(dados, inicio)).then((a) => {
      if (meu !== pedido.current) return;
      setCarregando(false);
      // `paginas` do momento do pedido basta: só um pedido por vez, e `limpar` descarta este pelo `pedido`.
      setPaginas([...paginas, a]);
      setAtual(paginas.length);
    }, (e: unknown) => {
      if (meu !== pedido.current) return;
      setCarregando(false);
      if (codigoApi(e) === 'MIGRACAO_INDISPONIVEL') {
        setIndisponivel(true);
        aoIndisponivel();
        return;
      }
      setErro(e);
    });
  };

  return {
    pagina,
    temAnterior: atual > 0,
    carregando,
    erro,
    indisponivel,
    hash: paginas[0]?.hash ?? null,
    abrir: () => {
      if (paginas.length === 0) buscar(0);
    },
    proximos: () => {
      if (atual + 1 < paginas.length) setAtual(atual + 1);
      else if (pagina) buscar(pagina.inicio + pagina.alunos.length);
      else buscar(0);
    },
    anteriores: () => setAtual((a) => Math.max(0, a - 1)),
    limpar: () => {
      pedido.current += 1;
      setPaginas([]);
      setAtual(0);
      setCarregando(false);
      setErro(null);
    },
  };
}

/** Põe o foco (teclado e leitor de tela) no elemento quando `chave` muda. */
function useFocarAoMudar(chave: unknown) {
  const alvo = useRef<View>(null);
  useEffect(() => {
    if (chave === null) return;
    if (Platform.OS === 'web') (alvo.current as unknown as { focus?: () => void } | null)?.focus?.();
    else {
      const no = findNodeHandle(alvo.current);
      if (no) AccessibilityInfo.setAccessibilityFocus(no);
    }
  }, [chave]);
  return alvo;
}

/**
 * A etapa "Amostra": por aluno, o que a confirmação gravaria (cadastro, pesos, treino e dieta, em rascunho), 5 por vez. Só
 * leitura; o primeiro aluno da página vem aberto e o foco vai para a faixa "Alunos N a M de T" a cada página.
 */
export function EtapaDaAmostra({ amostra, partesPuladas }: { amostra: AmostraNaTela; partesPuladas: readonly PartePuladaDaPlanilha[] }) {
  const { pagina, carregando, erro } = amostra;
  const faixa = useFocarAoMudar(pagina);
  const [previa, setPrevia] = useState<PreviaDoPlano | null>(null);
  const restantes = pagina ? restantesDaAmostra(pagina) : 0;
  const tentarDeNovo = pagina ? amostra.proximos : amostra.abrir;
  return (
    <>
      <Alerta tom="atencao" texto={textoDaPasta(pagina?.pasta ?? PASTA_DA_IMPORTACAO)} />
      {/* Sempre montada: o leitor de tela anuncia o carregamento e o erro sem mover o foco. */}
      <View accessibilityLiveRegion="polite" style={estilos.coluna}>
        {carregando ? <Texto variante="suave">Montando a amostra…</Texto> : null}
        {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={tentarDeNovo} /> : null}
      </View>
      {carregando && !pagina ? <Esqueleto texto="Montando a amostra" cartoes={2} /> : null}
      {pagina ? (
        <View ref={faixa} accessible tabIndex={-1} style={estilos.coluna} testID="faixa-da-amostra">
          <Texto variante="subtitulo" nivel={2} numerico>{faixaDaAmostra(pagina)}</Texto>
          <Texto variante="suave">Confira um aluno de cada vez. O que aparece aqui é o que a confirmação grava.</Texto>
        </View>
      ) : null}
      {pagina && pagina.alunos.length === 0 ? (
        <Vazio titulo="Nenhum aluno para mostrar" texto="A planilha não traz cadastro novo nem plano de aluno. A prévia mostra o resto do que vai ser gravado." />
      ) : null}
      {pagina?.alunos.map((a, i) => (
        <CartaoDoAluno key={`${pagina.inicio}-${a.numero}`} aluno={a} puladas={partesPuladas} abertoAoMontar={i === 0} aoVerComoAluno={setPrevia} />
      ))}
      {pagina && (amostra.temAnterior || restantes > 0) ? (
        <LinhaDeAcoes alinhar="entre">
          {amostra.temAnterior ? (
            <Botao rotulo="Ver os anteriores" tipo="secundario" Icone={ArrowLeft} desabilitado={carregando} motivo="Aguarde a amostra." aoTocar={amostra.anteriores} />
          ) : <View />}
          {restantes > 0 ? (
            <Botao rotulo={rotuloDosProximos(restantes)} tipo="secundario" Icone={ArrowRight} carregando={carregando} desabilitado={carregando}
              motivo="Aguarde a amostra." aoTocar={amostra.proximos} />
          ) : null}
        </LinhaDeAcoes>
      ) : null}
      {previa ? <FolhaVerComoAluno previa={previa} aoFechar={() => setPrevia(null)} /> : null}
    </>
  );
}

function CartaoDoAluno({ aluno, puladas, abertoAoMontar, aoVerComoAluno }: {
  aluno: AlunoDaAmostra; puladas: readonly PartePuladaDaPlanilha[]; abertoAoMontar: boolean; aoVerComoAluno: (p: PreviaDoPlano) => void;
}) {
  const [aberto, setAberto] = useState(abertoAoMontar);
  const nome = aluno.nome?.trim() || SEM_DADO;
  return (
    <Cartao cabecalho={
      <CabecalhoDeGrupo titulo={nome} resumo={resumoDoAluno(aluno)} selo={{ texto: situacaoDoAluno(aluno), tipo: 'neutro' }}
        aoAlternar={() => setAberto(!aberto)} aberto={aberto} />
    }>
      {aberto ? (
        <View style={estilos.coluna} testID={`aluno-da-amostra-${aluno.numero}`}>
          <Bloco titulo="Cadastro">
            {aluno.situacao === 'EXISTENTE' ? (
              <Texto>{textoDoCadastroExistente(aluno)}</Texto>
            ) : <Cadastro aluno={aluno} puladas={puladas} />}
          </Bloco>
          <Bloco titulo="Pesos">
            <Pesos aluno={aluno} pulado={ficaDeFora(puladas, 'PESOS')} />
          </Bloco>
          <Bloco titulo="Treino">
            {aluno.treino ? <Treino treino={normalizarTreino(aluno.treino)} nome={nome} aoVer={aoVerComoAluno} numero={aluno.numero} />
              : <Texto>{ficaDeFora(puladas, 'TREINO') ? 'Fica de fora pelo seu perfil.' : SEM_DADO}</Texto>}
          </Bloco>
          <Bloco titulo="Dieta">
            {aluno.dieta ? <Dieta dieta={normalizarDieta(aluno.dieta)} nome={nome} aoVer={aoVerComoAluno} numero={aluno.numero} />
              : <Texto>{ficaDeFora(puladas, 'DIETA') ? 'Fica de fora pelo seu perfil.' : SEM_DADO}</Texto>}
          </Bloco>
        </View>
      ) : null}
    </Cartao>
  );
}

/** Um assunto do aluno: item (`superficie2` com borda) dentro do cartão, com o nome em cima. */
function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.bloco, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <Texto variante="subtitulo" nivel={3}>{titulo}</Texto>
      {children}
    </View>
  );
}

function Cadastro({ aluno, puladas }: { aluno: AlunoDaAmostra; puladas: readonly PartePuladaDaPlanilha[] }) {
  const sensivel = ficaDeFora(puladas, 'OBJETIVO_E_OBSERVACOES');
  const campos: [string, string][] = [
    ['Nome', valorDoCampo(aluno.nome)],
    ['Situação', textoDoAtivo(aluno.ativo)],
    ['E-mail', valorDoCampo(aluno.email)],
    ['Telefone', valorDoCampo(aluno.telefone)],
    ['Objetivo', valorDoCampo(aluno.objetivo, sensivel)],
    ['Observações', valorDoCampo(aluno.observacoes, sensivel)],
  ];
  return (
    <View style={estilos.grade}>
      {campos.map(([rotulo, valor]) => <View key={rotulo} style={estilos.campo}><CampoLeitura rotulo={rotulo} valor={valor} /></View>)}
    </View>
  );
}

function Pesos({ aluno, pulado }: { aluno: AlunoDaAmostra; pulado: boolean }) {
  if (aluno.pesos === 0) return <Texto>{pulado ? 'Fica de fora pelo seu perfil.' : SEM_DADO}</Texto>;
  return (
    <>
      <Texto>{textoDosPesos(aluno)}</Texto>
      <Lista rotulo={`Últimos pesos de ${aluno.nome?.trim() || 'aluno'}`} linhas={pesosDoMaisRecente(aluno).map(textoDoPeso)} numerico />
    </>
  );
}

function Treino({ treino, nome, numero, aoVer }: { treino: ConteudoTreino; nome: string; numero: number; aoVer: (p: PreviaDoPlano) => void }) {
  const { cores } = useTema();
  return (
    <>
      <Texto numerico>{textoDoTreino(treino)}</Texto>
      {treino.sessoes.map((s) => (
        <View key={s.uid} style={estilos.subgrupo}>
          <Texto variante="bloco">{`${s.nome.trim() || SEM_DADO} · ${textoDaSessao(s)}`}</Texto>
          <View role="list" accessibilityLabel={`Exercícios de ${s.nome.trim() || 'sessão'}`} style={estilos.lista}>
            {s.exercicios.map((e) => (
              <View key={e.uid} role="listitem" style={estilos.linha}>
                <Texto numerico style={estilos.textoDaLinha}>{textoDoExercicio(e)}</Texto>
                {foraDaBiblioteca(e) ? <Selo texto={SEM_PAR_NA_BIBLIOTECA} tipo="neutro" /> : null}
              </View>
            ))}
          </View>
          {s.exercicios.length === 0 ? <Texto variante="pequeno" cor={cores.textoSuave}>Sem exercícios.</Texto> : null}
        </View>
      ))}
      <LinhaDeAcoes>
        <Botao rotulo="Ver o treino como o aluno" rotuloAcessivel={`Ver o treino de ${nome} como o aluno`} tipo="secundario"
          desabilitado={treino.sessoes.length === 0} motivo="O treino não tem sessões."
          aoTocar={() => aoVer({ tipo: 'treino', estado: planoDaAmostra(numero, treino) })} />
      </LinhaDeAcoes>
    </>
  );
}

function Dieta({ dieta, nome, numero, aoVer }: { dieta: ConteudoDieta; nome: string; numero: number; aoVer: (p: PreviaDoPlano) => void }) {
  return (
    <>
      <Texto numerico>{textoDaDieta(contarDieta(dieta))}</Texto>
      {dieta.refeicoes.map((r) => (
        <View key={r.uid} style={estilos.subgrupo}>
          <Texto variante="bloco">{textoDaRefeicao(r)}</Texto>
          {r.opcoes.map((o) => (
            <View key={o.uid} style={estilos.lista}>
              {r.opcoes.length > 1 ? <Texto variante="rotulo">{o.rotulo.trim() || SEM_DADO}</Texto> : null}
              <Lista rotulo={`Itens de ${r.nome.trim() || 'refeição'}`} linhas={o.itens.map(textoDoItem)} numerico />
            </View>
          ))}
        </View>
      ))}
      {dieta.suplementacao.length > 0 ? (
        <View style={estilos.subgrupo}>
          <Texto variante="bloco">Suplementação</Texto>
          <Lista rotulo="Suplementos" linhas={dieta.suplementacao.map(textoDoSuplemento)} />
        </View>
      ) : null}
      <LinhaDeAcoes>
        <Botao rotulo="Ver a dieta como o aluno" rotuloAcessivel={`Ver a dieta de ${nome} como o aluno`} tipo="secundario"
          aoTocar={() => aoVer({ tipo: 'dieta', estado: planoDaAmostra(numero, dieta) })} />
      </LinhaDeAcoes>
    </>
  );
}

function Lista({ rotulo, linhas, numerico }: { rotulo: string; linhas: string[]; numerico?: boolean }) {
  if (linhas.length === 0) return <Texto>{SEM_DADO}</Texto>;
  return (
    <View role="list" accessibilityLabel={rotulo} style={estilos.lista}>
      {linhas.map((l, i) => <Texto key={`${i}-${l}`} role="listitem" numerico={numerico}>{l}</Texto>)}
    </View>
  );
}

/** O conteúdo da amostra na forma que o "Ver como o aluno" lê (um rascunho que nunca foi publicado, sem período). */
function planoDaAmostra<C>(numero: number, conteudo: C) {
  return { plano: { id: `amostra-${numero}`, versaoPublicada: 0 }, titulo: '', inicio: '', fim: '', conteudo };
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(1) },
  bloco: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(2), rowGap: espaco(1.5) },
  campo: { flexGrow: 1, flexBasis: 220, minWidth: 0 },
  subgrupo: { gap: espaco(0.5) },
  lista: { gap: 2 },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: 2 },
  textoDaLinha: { flexShrink: 1 },
});
