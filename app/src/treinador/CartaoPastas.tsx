import { Copy, FolderPlus, Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { excluirPasta, salvarPastaComoModelo, atualizarPasta, criarPasta, listarPastas, replicarPasta } from '../api/rotas';
import type { PastaResumo, Receita } from '../api/tipos';
import { dataDaTela, dataParaTela } from '../dominio/formatos';
import { espaco } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro, Vazio } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { AplicarAoAluno } from './planejamento/AplicarAoAluno';
import { FolhaReceitas } from './FolhaReceitas';
import { FolhaSalvarReceita } from './FolhaSalvarReceita';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { CartaoPlanos, periodo, proximoPeriodo } from './CartaoPlanos';

type Modo = { tipo: 'nova' } | { tipo: 'editar'; pasta: PastaResumo } | { tipo: 'replicar'; pasta: PastaResumo };

/**
 * Pastas do aluno (ex.: "Plano 16"): cada uma agrupa treinos e dietas e tem o período que vale para todos. Mudar o
 * período da pasta acompanha os rascunhos dos planos dela; replicar a pasta copia todos para o próximo ciclo.
 */
export function CartaoPastas({ alunoId }: { alunoId: string }) {
  const { dados, erro, carregando, recarregar } = useCarregar(`pastas:${alunoId}`, () => listarPastas(alunoId));
  const [modo, setModo] = useState<Modo | null>(null);
  const { avisar } = useAviso();
  const [excluir, setExcluir] = useState<PastaResumo | null>(null);
  const [salvarModelo, setSalvarModelo] = useState<PastaResumo | null>(null);
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
              <Botao rotulo="Editar" tipo="secundario" Icone={Pencil} aoTocar={() => setModo({ tipo: 'editar', pasta: p })} />
              <Botao rotulo="Salvar pasta como modelo" tipo="secundario" aoTocar={() => setSalvarModelo(p)} />
              <Botao rotulo="Excluir pasta" tipo="fantasma" aoTocar={() => setExcluir(p)} />
              <Botao rotulo="Replicar pasta" tipo="secundario" Icone={Copy} aoTocar={() => setModo({ tipo: 'replicar', pasta: p })} />
            </>
          }>
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
      {modo ? <FolhaPasta alunoId={alunoId} modo={modo} aoFechar={() => setModo(null)} aoSalvar={aoSalvar} /> : null}
    </>
  );
}

function FolhaPasta({ alunoId, modo, aoFechar, aoSalvar }: { alunoId: string; modo: Modo; aoFechar: () => void; aoSalvar: () => void }) {
  const { avisar } = useAviso();
  const origem = modo.tipo === 'nova' ? null : modo.pasta;
  const sugestao = modo.tipo === 'replicar' && origem ? proximoPeriodo(origem) : null;
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

const estilos = StyleSheet.create({
  datas: { flexDirection: 'row', gap: espaco(1.5), flexWrap: 'wrap' },
  data: { flex: 1, minWidth: 150 },
});
