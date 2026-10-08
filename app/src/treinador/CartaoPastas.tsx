import { CheckCircle2, Copy, FolderPlus, Pencil, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { excluirPasta, finalizarPasta, reabrirPasta, salvarPastaComoModelo, atualizarPasta, criarPasta, listarPastas, replicarPasta } from '../api/rotas';
import type { PastaResumo, Receita } from '../api/tipos';
import { dataDaTela, dataParaTela, hojeIso } from '../dominio/formatos';
import { periodoInicial } from '../dominio/periodo';
import { espaco } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData, CampoNumerico } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro, Vazio } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { Selo } from '../ui/Selo';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { AplicarAoAluno } from './planejamento/AplicarAoAluno';
import { FolhaReceitas } from './FolhaReceitas';
import { FolhaSalvarReceita } from './FolhaSalvarReceita';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { CartaoPlanos, periodo, proximoPeriodo } from './CartaoPlanos';

type Modo = { tipo: 'nova' } | { tipo: 'editar'; pasta: PastaResumo } | { tipo: 'replicar'; pasta: PastaResumo };

interface PropsPastas {
  alunoId: string;
  /** Dias do ciclo do aluno: sugere o fim do período numa pasta nova. */
  diasAtualizacao?: number | null;
  /** Chamado depois de gravar um peso (ao finalizar a pasta) para o cartão de peso recarregar. */
  aoGravarPeso?: () => void;
}

/**
 * Pastas do aluno (ex.: "Plano 16"): cada uma agrupa treinos e dietas e tem o período que vale para todos. Mudar o
 * período da pasta acompanha os rascunhos dos planos dela; replicar a pasta copia todos para o próximo ciclo.
 */
export function CartaoPastas({ alunoId, diasAtualizacao = null, aoGravarPeso }: PropsPastas) {
  const { dados, erro, carregando, recarregar } = useCarregar(`pastas:${alunoId}`, () => listarPastas(alunoId));
  const [modo, setModo] = useState<Modo | null>(null);
  const { avisar } = useAviso();
  const [excluir, setExcluir] = useState<PastaResumo | null>(null);
  const [salvarModelo, setSalvarModelo] = useState<PastaResumo | null>(null);
  const [finalizar, setFinalizar] = useState<PastaResumo | null>(null);
  const [escolher, setEscolher] = useState(false);
  const [modelo, setModelo] = useState<Receita | null>(null);
  const [geracao, setGeracao] = useState(0);

  const aoSalvar = () => {
    setModo(null);
    setGeracao((g) => g + 1);
    recarregar();
  };

  return (
    <>
      <Cartao
        titulo="Pastas de plano"
        acoes={<Botao rotulo="Nova pasta" tipo="secundario" Icone={FolderPlus} aoTocar={() => setModo({ tipo: 'nova' })} />}>
        <Texto variante="suave">
          Cada pasta junta o treino e a dieta de um período. O período da pasta vale para os dois.
        </Texto>
        {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
        {!dados && carregando ? <Esqueleto /> : null}
        {dados && dados.length === 0 ? (
          <Vazio titulo="Sem pastas" texto="Crie uma pasta para montar o treino e a dieta do período." acao={{ rotulo: 'Nova pasta', aoTocar: () => setModo({ tipo: 'nova' }) }} />
        ) : null}
      </Cartao>
<Botao rotulo="Usar modelo de pasta" tipo="secundario" aoTocar={() => setEscolher(true)} />
      {dados?.map((p) => (
        <Cartao
          key={p.id}
          titulo={p.titulo}
          acoes={
            <>
              {p.concluidaEm ? (
                <Botao rotulo="Reabrir pasta" tipo="secundario" Icone={RotateCcw} aoTocar={() => {
                  reabrirPasta(p.id).then(() => { avisar('Pasta reaberta.', 'sucesso'); recarregar(); }, (e: unknown) => avisar(textoDoErro(e), 'perigo'));
                }} />
              ) : (
                <Botao rotulo="Finalizar pasta" tipo="secundario" Icone={CheckCircle2} aoTocar={() => setFinalizar(p)} />
              )}
              <Botao rotulo="Editar" tipo="secundario" Icone={Pencil} aoTocar={() => setModo({ tipo: 'editar', pasta: p })} />
              <Botao rotulo="Salvar pasta como modelo" tipo="secundario" aoTocar={() => setSalvarModelo(p)} />
              <Botao rotulo="Excluir pasta" tipo="fantasma" aoTocar={() => setExcluir(p)} />
              <Botao rotulo="Replicar pasta" tipo="secundario" Icone={Copy} aoTocar={() => setModo({ tipo: 'replicar', pasta: p })} />
            </>
          }>
          {p.concluidaEm ? <Selo texto={`Concluída em ${dataParaTela(p.concluidaEm.slice(0, 10))}`} tipo="sucesso" /> : null}
          <Texto numerico variante="suave">Período: {periodo(p)}</Texto>
          <CartaoPlanos tipo="treino" alunoId={alunoId} pasta={p} geracao={geracao} />
          <CartaoPlanos tipo="dieta" alunoId={alunoId} pasta={p} geracao={geracao} />
        </Cartao>
      ))}
      {escolher ? <FolhaReceitas tipo="PASTA_PLANO" titulo="Modelo de pasta de plano" aoFechar={() => setEscolher(false)} aoUsar={(r) => { setEscolher(false); setModelo(r); }} /> : null}
      {modelo ? <AplicarAoAluno modelo={modelo} alunoInicial={alunoId} aoFechar={() => setModelo(null)} aoAplicar={() => { setModelo(null); aoSalvar(); avisar('Pasta copiada como rascunho.', 'sucesso'); }} /> : null}
      {salvarModelo ? <FolhaSalvarReceita titulo="Salvar pasta como modelo" explicacao="Copia os rascunhos de treino e dieta desta pasta para reutilizar em outros alunos." aoFechar={() => setSalvarModelo(null)} aoSalvar={async (nome, descricao) => {
        await salvarPastaComoModelo(salvarModelo.id, nome, descricao); setSalvarModelo(null); avisar('Modelo de pasta salvo.', 'sucesso');
      }} /> : null}
      <PainelConfirmacao visivel={!!excluir} titulo={`Excluir pasta “${excluir?.titulo ?? ''}”?`} mensagem="A pasta e seus planos saem da lista. Os planos deixam de estar ativos; versões publicadas e registros dos alunos são preservados." rotuloConfirmar="Excluir pasta e planos" perigo aoCancelar={() => setExcluir(null)} aoConfirmar={() => {
        if (!excluir) return; const id = excluir.id; setExcluir(null);
        excluirPasta(id).then(aoSalvar, (e: unknown) => avisar(textoDoErro(e), 'perigo'));
      }} />
      {modo ? <FolhaPasta alunoId={alunoId} modo={modo} diasAtualizacao={diasAtualizacao} aoFechar={() => setModo(null)} aoSalvar={aoSalvar} /> : null}
      {finalizar ? <FolhaFinalizar pasta={finalizar} aoFechar={() => setFinalizar(null)} aoFinalizar={(comPeso) => { setFinalizar(null); aoSalvar(); if (comPeso) aoGravarPeso?.(); }} /> : null}
    </>
  );
}

function FolhaPasta({ alunoId, modo, diasAtualizacao, aoFechar, aoSalvar }: { alunoId: string; modo: Modo; diasAtualizacao: number | null; aoFechar: () => void; aoSalvar: () => void }) {
  const { avisar } = useAviso();
  const origem = modo.tipo === 'nova' ? null : modo.pasta;
  const sugestao = modo.tipo === 'replicar' && origem ? proximoPeriodo(origem) : modo.tipo === 'nova' ? periodoInicial(hojeIso(), diasAtualizacao) : null;
  const [titulo, setTitulo] = useState(modo.tipo === 'editar' && origem ? origem.titulo : '');
  const [inicio, setInicio] = useState(sugestao ? sugestao.inicio : origem && modo.tipo === 'editar' ? dataParaTela(origem.inicio) : '');
  const [fim, setFim] = useState(sugestao ? sugestao.fim : origem && modo.tipo === 'editar' ? dataParaTela(origem.fim) : '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const ini = dataDaTela(inicio);
  const fi = dataDaTela(fim);
  const valido = titulo.trim() !== '' && ini !== undefined && fi !== undefined;

  const salvar = () => {
    if (!valido) return;
    const dados = { titulo: titulo.trim(), inicio: ini ?? null, fim: fi ?? null };
    setSalvando(true);
    setErro(null);
    const chamada =
      modo.tipo === 'nova' ? criarPasta(alunoId, dados) : modo.tipo === 'editar' ? atualizarPasta(modo.pasta.id, dados) : replicarPasta(modo.pasta.id, dados);
    chamada.then(
      () => {
        avisar(modo.tipo === 'replicar' ? 'Pasta replicada com os treinos e dietas.' : 'Pasta salva.', 'sucesso');
        aoSalvar();
      },
      (e: unknown) => {
        setSalvando(false);
        setErro(e);
      },
    );
  };

  const titulos = { nova: 'Nova pasta', editar: 'Editar pasta', replicar: 'Replicar pasta para o próximo ciclo' };
  return (
    <Folha
      visivel
      titulo={titulos[modo.tipo]}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} desabilitado={!valido} />
        </>
      }>
      {modo.tipo === 'replicar' ? (
        <Texto variante="suave">
          Cria uma pasta nova com cópia dos treinos e das dietas publicados de “{modo.pasta.titulo}”, como rascunhos.
        </Texto>
      ) : null}
      {modo.tipo === 'nova' && diasAtualizacao ? (
        <Texto variante="suave">
          Início e fim já vêm preenchidos pelo ciclo do aluno ({diasAtualizacao} dias). Você pode mudar as datas.
        </Texto>
      ) : null}
      {modo.tipo === 'editar' ? (
        <Texto variante="suave">
          O novo período vale para o treino e a dieta da pasta. Planos já publicados só mudam ao publicar de novo.
        </Texto>
      ) : null}
      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} maxLength={120} placeholder="Ex.: Plano 17" />
      <View style={estilos.datas}>
        <View style={estilos.data}>
          <CampoData rotulo="Início" valor={inicio} aoMudar={setInicio} />
        </View>
        <View style={estilos.data}>
          <CampoData rotulo="Fim" valor={fim} aoMudar={setFim} />
        </View>
      </View>
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}

function FolhaFinalizar({ pasta, aoFechar, aoFinalizar }: { pasta: PastaResumo; aoFechar: () => void; aoFinalizar: (comPeso: boolean) => void }) {
  const { avisar } = useAviso();
  const [data, setData] = useState(dataParaTela(hojeIso()));
  const [peso, setPeso] = useState<number | null>(null);
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const dataIso = dataDaTela(data);
  const valido = dataIso !== undefined && (peso !== null || observacao.trim() === '');

  const salvar = () => {
    if (!valido) return;
    setSalvando(true);
    setErro(null);
    finalizarPasta(pasta.id, { data: peso !== null ? dataIso ?? null : null, pesoKg: peso, observacao: observacao.trim() || null }).then(
      () => {
        avisar(peso !== null ? 'Pasta finalizada e peso registrado.' : 'Pasta finalizada.', 'sucesso');
        aoFinalizar(peso !== null);
      },
      (e: unknown) => {
        setSalvando(false);
        setErro(e);
      },
    );
  };

  return (
    <Folha
      visivel
      titulo={`Finalizar “${pasta.titulo}”`}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Finalizar pasta" aoTocar={salvar} carregando={salvando} desabilitado={!valido} />
        </>
      }>
      <Texto variante="suave">
        Dá a pasta como concluída. Se informar o peso, ele entra direto no registro de peso do aluno (e no gráfico) com
        a data e a observação abaixo. Você pode reabrir a pasta depois.
      </Texto>
      <CampoData rotulo="Data do peso" valor={data} aoMudar={setData} />
      <CampoNumerico rotulo="Peso (opcional)" sufixo="kg" valor={peso} aoMudar={setPeso} />
      <Campo rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} maxLength={300} ajuda="Só é gravada junto com o peso." />
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  datas: { flexDirection: 'row', gap: espaco(1.5), flexWrap: 'wrap' },
  data: { flex: 1, minWidth: 150 },
});
