import { FileDown } from 'lucide-react-native';
import { useCallback, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { execucoesDoAluno } from '../api/rotas';
import type { PastaResumo } from '../api/tipos';
import { hojeEmBrasilia } from '../dominio/financeiro';
import { chipsDeRegistros, REGISTROS_SEM_FILTRO, semOFiltroDeRegistros, TODOS_OS_PLANOS, type ChaveDeRegistros, type FiltrosDeRegistros } from '../dominio/filtrosDosCartoes';
import { useEtapaDeFiltros } from '../ui/EtapaDeFiltros';
import { useRolagem } from '../ui/RolagemComTopo';
import { dataParaTela } from '../dominio/formatos';
import { letrasDasDivisoes } from '../dominio/historicoDoAluno';
import { cargasPorDivisao, filtrarPorSessoes, intervaloDeRegistros, nomeDaDivisao, periodoMisturaVersoes, TEXTO_PERIODO_MISTURA_VERSOES, textoDoHistoricoVazio } from '../dominio/relatorio';
import { Abas } from '../ui/Abas';
import { useAviso } from '../ui/Aviso';
import { BarraDeFiltros, GrupoDoPainel } from '../ui/BarraDeFiltros';
import { Botao } from '../ui/Botao';
import { CampoLeitura } from '../ui/CampoLeitura';
import { Cartao } from '../ui/Cartao';
import { Escolha } from '../ui/Escolha';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro, Vazio } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { CargasPorDivisao } from './CargasPorDivisao';
import { HistoricoPorSemana } from './HistoricoPorSemana';
import { NoPlano } from '../ui/NoPlano';
import { gerarPdfDeCargas, sessoesPorUid, treinosDoAluno } from './gerarPdf';
import { useUnidadeDeCarga } from '../ui/unidadeDeCargaEmUso';


export const PERIODOS = [
  { valor: '14', rotulo: '14 dias' },
  { valor: '30', rotulo: '30 dias' },
  { valor: '60', rotulo: '60 dias' },
];

export type VisaoRegistros = 'divisao' | 'dia';
export const VISOES: { valor: VisaoRegistros; rotulo: string }[] = [
  { valor: 'divisao', rotulo: 'Por divisão' },
  { valor: 'dia', rotulo: 'Por dia' },
];

/** A etapa "Filtros de registros" da folha da pasta (`useEtapaDeFiltros`), criada por quem monta a folha. */
export type EtapaDosRegistros = ReturnType<typeof useEtapaDeFiltros<FiltrosDeRegistros>>;

/** Rolagem da folha da pasta (web): o primeiro ancestral que rola de verdade. */
function rolagemDaFolha(no: HTMLElement | null): HTMLElement | null {
  for (let el = no?.parentElement ?? null; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return el;
  }
  return null;
}

/**
 * Registros do aluno no período: por divisão do plano (carga de trabalho de cada dia, como o relatório em PDF) ou
 * por dia, e o progresso por exercício. Período (só na pasta sem período) e Plano (com mais de um) ficam na etapa
 * "Filtros de registros" da própria folha da pasta (`ui/EtapaDeFiltros`, `BarraDeFiltros naFolha`, sem painel por cima):
 * a folha troca título, corpo e rodapé pelos da etapa e esconde o resto sem desmontar; Aplicar, Cancelar, X, Esc e voltar
 * devolvem a pasta na mesma rolagem e o foco ao botão "Filtros". O aluno e a pasta são o contexto (não contam nem viram
 * etiqueta). Os filtros e a etapa moram na folha (`CartaoPastas`), que os zera ao trocar de pasta.
 */
export function CartaoRegistros({ aluno, pasta, filtros, aoMudarFiltros: setFiltros, etapa }: {
  aluno: { id: string; nome: string }; pasta?: PastaResumo;
  filtros: FiltrosDeRegistros; aoMudarFiltros: Dispatch<SetStateAction<FiltrosDeRegistros>>; etapa: EtapaDosRegistros;
}) {
  const { avisar } = useAviso();
  const unidade = useUnidadeDeCarga();
  const { dias, planoId } = filtros;
  // A etapa troca o corpo da pasta (que encolhe e perde a rolagem): guarda a posição ao abrir e a devolve ao voltar,
  // antes da pintura e antes de o foco voltar ao "Filtros". A etapa começa no topo.
  const raiz = useRef<View>(null);
  const rolagem = useRolagem();
  const salva = useRef<{ el: HTMLElement; topo: number } | null>(null);
  const abrirEtapa = () => {
    if (Platform.OS === 'web') {
      const el = rolagemDaFolha(raiz.current as unknown as HTMLElement | null);
      salva.current = el ? { el, topo: el.scrollTop } : null;
    }
    etapa.abrir();
  };
  useLayoutEffect(() => {
    if (!etapa.jaAbriu) return;
    if (Platform.OS !== 'web') {
      // shortcut: no celular volta com o cartão no topo, não na rolagem exata (a posição da `RolagemComTopo` não é exposta); expor se pedirem.
      if (!etapa.aberta) rolagem.rolarAte([ALVO_DOS_REGISTROS]);
      return;
    }
    if (!salva.current) return;
    salva.current.el.scrollTop = etapa.aberta ? 0 : salva.current.topo;
    if (!etapa.aberta) salva.current = null;
  }, [etapa.aberta, etapa.jaAbriu, rolagem]);
  const registrarAlvo = useCallback((v: View | null) => { raiz.current = v; rolagem.registrar(ALVO_DOS_REGISTROS, v); }, [rolagem]);
  const [visao, setVisao] = useState<VisaoRegistros>('divisao');
  const [gerando, setGerando] = useState(false);
  // Dentro da pasta, o período é o dela (sem os filtros de 14/30/60 dias) e só entram os treinos dela.
  const daPasta = !!pasta?.inicio && !!pasta.fim;
  const hoje = hojeEmBrasilia();
  const { de, ate } = intervaloDeRegistros(hoje, Number(dias), pasta);
  const { dados, erro, carregando, recarregar } = useCarregar(`exec:${aluno.id}:${de}:${ate}`, () =>
    execucoesDoAluno(aluno.id, de, ate),
  );
  const treinos = useCarregar(`treinos:${aluno.id}`, () => treinosDoAluno(aluno.id));
  const planos = (treinos.dados ?? []).filter((t) => !daPasta || t.plano.pastaId === pasta?.id);
  const planoEscolhido = planos.find((t) => t.plano.id === planoId);
  const filtrados = dados ? filtrarPorSessoes(dados, planoEscolhido ? new Set(planoEscolhido.sessoes.map((s) => s.uid)) : null) : null;
  const sessoes = sessoesPorUid(planos);
  const divisoes = filtrados ? cargasPorDivisao(filtrados, sessoes) : [];
  const nomeDaSessao = (s: { sessaoUid: string; sessao: string }) => nomeDaDivisao(s, sessoes);
  // A mesma letra e a mesma cor da divisão nas duas visões (Frente G, D13).
  const letras = letrasDasDivisoes([...divisoes.map((d) => d.nome), ...(filtrados ?? []).flatMap((d) => d.sessoes.map(nomeDaSessao))]);
  const opcoesPlano = [{ valor: TODOS_OS_PLANOS, rotulo: 'Todos os planos' }, ...planos.map((t) => ({ valor: t.plano.id, rotulo: t.plano.titulo }))];
  const comPlano = planos.length > 1;
  const chips = chipsDeRegistros(filtros, { comPeriodo: !daPasta, periodos: PERIODOS, planos: comPlano ? opcoesPlano : [] });

  const pdf = () => {
    setGerando(true);
    gerarPdfDeCargas(aluno, de, ate, divisoes, unidade)
      .catch((e: unknown) => avisar(textoDoErro(e), 'perigo'))
      .finally(() => setGerando(false));
  };

  const f = etapa.rascunho;
  return (
    <>
      {/* Escondido (não desmontado) com a etapa aberta: o cartão guarda o recolhido e o botão "Filtros" para o foco voltar. */}
      <View ref={registrarAlvo} collapsable={false} style={etapa.aberta ? estilos.escondido : undefined}>
      <Cartao
        titulo="Registros e cargas"
        // Na pasta com período o recorte é o dela (o topo da folha já o diz): o chip só existe com o filtro de dias.
        periodo={daPasta ? undefined : `Últimos ${dias} dias: ${dataParaTela(de).slice(0, 5)} a ${dataParaTela(ate).slice(0, 5)}`}
        recolhivel
        acoes={
          divisoes.length ? <NoPlano funcionalidade="PDF"><Botao rotulo="PDF das cargas" tipo="secundario" Icone={FileDown} carregando={gerando} aoTocar={pdf} /></NoPlano> : null
        }>
        {!daPasta || comPlano ? etapa.barra(
          <BarraDeFiltros valor={filtros} limpo={REGISTROS_SEM_FILTRO} aoAplicar={setFiltros} chips={chips}
            aoTirar={(chave) => setFiltros((atual) => semOFiltroDeRegistros(atual, chave as ChaveDeRegistros))}
            seletores={() => null} painelLateral={{ titulo: 'Filtros de registros' }} naFolha={{ abrir: abrirEtapa }} />,
        ) : null}
        <Abas abas={VISOES} ativa={visao} aoMudar={setVisao} />
        {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
        {!dados && carregando ? <Esqueleto /> : null}
        {dados && filtrados && filtrados.length === 0 ? (
          // B6: o motivo do vazio vem do domínio (o mesmo texto do histórico do aluno), com a dica de que pode ter treinado sem registrar.
          <Vazio titulo={textoDoHistoricoVazio({ temRegistros: false, graficosLigados: true, papel: 'TREINADOR' }) ?? 'Sem registros'} texto="Os treinos registrados aparecem aqui. O aluno pode ter treinado sem registrar." />
        ) : null}
        {filtrados && periodoMisturaVersoes(filtrados) ? <Texto numerico variante="pequeno">{TEXTO_PERIODO_MISTURA_VERSOES}</Texto> : null}
        {dados && visao === 'divisao' ? <CargasPorDivisao divisoes={divisoes} letras={letras} /> : null}
        {filtrados && visao === 'dia' ? <HistoricoPorSemana dias={filtrados} nomeDaSessao={nomeDaSessao} letras={letras} periodo={{ de, ate }} hoje={hoje} /> : null}
      </Cartao>
      </View>
      {/* Os seletores da etapa não abrem outra folha: Plano e Período em chips que quebram linha, mesmo com muitos planos. */}
      {etapa.aberta ? etapa.corpo(
        <>
          <GrupoDoPainel titulo="Identificação" primeiro>
            <CampoLeitura rotulo="Aluno" valor={aluno.nome || '—'} />
            {pasta ? <CampoLeitura rotulo="Pasta" valor={pasta.titulo} /> : null}
            {comPlano ? <Escolha rotulo="Plano" valor={f.planoId} opcoes={opcoesPlano} aoMudar={(v) => etapa.mudar({ ...f, planoId: v })} /> : null}
          </GrupoDoPainel>
          {daPasta ? null : (
            <GrupoDoPainel titulo="Datas">
              <Escolha rotulo="Período" opcoes={PERIODOS} valor={f.dias} aoMudar={(v) => etapa.mudar({ ...f, dias: v })} />
            </GrupoDoPainel>
          )}
        </>,
      ) : null}
    </>
  );
}

/** Registrado na rolagem da folha da pasta: no celular, a volta da etapa traz o cartão à vista. */
const ALVO_DOS_REGISTROS = 'registros-da-pasta';

const estilos = StyleSheet.create({
  escondido: { display: 'none' },
});
