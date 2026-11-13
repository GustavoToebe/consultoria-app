import { FileDown } from 'lucide-react-native';
import { useState } from 'react';

import { execucoesDoAluno } from '../api/rotas';
import type { PastaResumo } from '../api/tipos';
import { hojeEmBrasilia } from '../dominio/financeiro';
import { chipsDeRegistros, REGISTROS_SEM_FILTRO, semOFiltroDeRegistros, TODOS_OS_PLANOS, type ChaveDeRegistros, type FiltrosDeRegistros } from '../dominio/filtrosDosCartoes';
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
import { UmaOpcao } from './SeletoresDeFiltro';


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

/**
 * Registros do aluno no período: por divisão do plano (carga de trabalho de cada dia, como o relatório em PDF) ou
 * por dia, e o progresso por exercício. Período (só na pasta sem período) e Plano (com mais de um) ficam no painel
 * "Filtros de registros" (`ui/BarraDeFiltros`), aberto sobre a folha da pasta; o aluno e a pasta são o contexto (não contam
 * nem viram etiqueta). Estado local, como antes.
 */
export function CartaoRegistros({ aluno, pasta }: { aluno: { id: string; nome: string }; pasta?: PastaResumo }) {
  const { avisar } = useAviso();
  const unidade = useUnidadeDeCarga();
  const [filtros, setFiltros] = useState<FiltrosDeRegistros>(REGISTROS_SEM_FILTRO);
  const { dias, planoId } = filtros;
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

  return (
      <Cartao
        titulo="Registros e cargas"
        periodo={`${daPasta ? 'Pasta' : `Últimos ${dias} dias`}: ${dataParaTela(de).slice(0, 5)} a ${dataParaTela(ate).slice(0, 5)}`}
        recolhivel
        acoes={
          divisoes.length ? <NoPlano funcionalidade="PDF"><Botao rotulo="PDF das cargas" tipo="secundario" Icone={FileDown} carregando={gerando} aoTocar={pdf} /></NoPlano> : null
        }>
        {!daPasta || comPlano ? (
          <BarraDeFiltros valor={filtros} limpo={REGISTROS_SEM_FILTRO} aoAplicar={setFiltros} chips={chips}
            aoTirar={(chave) => setFiltros((f) => semOFiltroDeRegistros(f, chave as ChaveDeRegistros))}
            painelLateral={{ titulo: 'Filtros de registros' }}
            seletores={(f, mudar) => (
              <>
                <GrupoDoPainel titulo="Identificação" primeiro>
                  <CampoLeitura rotulo="Aluno" valor={aluno.nome || '—'} />
                  {pasta ? <CampoLeitura rotulo="Pasta" valor={pasta.titulo} /> : null}
                  {comPlano ? <UmaOpcao rotulo="Plano" valor={f.planoId} opcoes={opcoesPlano} aoMudar={(v) => mudar({ ...f, planoId: v })} /> : null}
                </GrupoDoPainel>
                {daPasta ? null : (
                  <GrupoDoPainel titulo="Datas">
                    <Escolha rotulo="Período" opcoes={PERIODOS} valor={f.dias} aoMudar={(v) => mudar({ ...f, dias: v })} />
                  </GrupoDoPainel>
                )}
              </>
            )} />
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
  );
}
