import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { alterarPastaModelo, alterarReceita, consultoria, criarPastaModelo, criarReceita, duplicarReceita, excluirPastaModelo, excluirReceita, listarPastasModelos, listarReceitas } from '../../../api/rotas';
import type { PastaModelo, Receita, TipoReceita } from '../../../api/tipos';
import { AplicarAoAluno } from '../../../treinador/planejamento/AplicarAoAluno';
import { CATEGORIAS, conteudoInicial } from '../../../treinador/planejamento/modelos';
import { useAviso } from '../../../ui/Aviso';
import { Botao } from '../../../ui/Botao';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Campo } from '../../../ui/Campo';
import { Cartao } from '../../../ui/Cartao';
import { Escolha } from '../../../ui/Escolha';
import { MensagemErro, Vazio } from '../../../ui/Estados';
import { Esqueleto } from '../../../ui/Esqueleto';
import { textoDoErro } from '../../../ui/erros';
import { Folha } from '../../../ui/Folha';
import { PainelConfirmacao } from '../../../ui/PainelConfirmacao';
import { Tela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';
import { useCarregar } from '../../../ui/useCarregar';

export default function Planejamento() {
  const modelos = useCarregar('planejamento', () => listarReceitas());
  const pastas = useCarregar('pastas-modelos', listarPastasModelos);
  const config = useCarregar('consultoria-planejamento', consultoria);
  const { avisar } = useAviso();
  const [tipo, setTipo] = useState<TipoReceita>('PLANO_TREINO');
  const [pasta, setPasta] = useState('*');
  const [busca, setBusca] = useState('');
  const [formulario, setFormulario] = useState<Receita | 'novo' | null>(null);
  const [organizar, setOrganizar] = useState(false);
  const [excluir, setExcluir] = useState<Receita | null>(null);
  const [aplicar, setAplicar] = useState<Receita | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const atualizar = () => { modelos.recarregar(); pastas.recarregar(); };
  const filtrados = modelos.dados?.filter((r) => r.tipo === tipo && (pasta === '*' || (r.pastaId ?? '') === pasta) && `${r.nome} ${r.descricao ?? ''}`.toLocaleLowerCase().includes(busca.toLocaleLowerCase()));
  return <Tela bordas={['top']} largura={1100}>
    <Cabecalho titulo="Planejamento" mostrarMarca="celular" />
    <Texto variante="suave">Monte modelos, vincule metodologias às semanas e reutilize nos alunos. Cada aplicação cria uma cópia independente.</Texto>
    <Escolha rotulo="Modelos" valor={tipo} aoMudar={setTipo} opcoes={CATEGORIAS} />
    <Escolha rotulo="Organização" valor={pasta} aoMudar={setPasta} opcoes={[{ valor: '*', rotulo: 'Todas as pastas' }, { valor: '', rotulo: 'Sem pasta' }, ...(pastas.dados ?? []).map((p) => ({ valor: p.id, rotulo: p.nome }))]} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Botao rotulo="Novo modelo" aoTocar={() => setFormulario('novo')} desabilitado={!config.dados} />
      <Botao rotulo="Organizar pastas" tipo="secundario" aoTocar={() => setOrganizar(true)} />
    </View>
    <Campo rotulo="Buscar modelo" valor={busca} aoMudar={setBusca} />
    {modelos.erro || pastas.erro || config.erro ? <MensagemErro texto={textoDoErro(modelos.erro ?? pastas.erro ?? config.erro)} tentarDeNovo={() => { atualizar(); config.recarregar(); }} /> : null}
    {!modelos.dados && modelos.carregando ? <Esqueleto /> : null}
    {filtrados?.length === 0 ? <Vazio texto="Nenhum modelo encontrado. Crie um modelo para começar." /> : null}
    {filtrados?.map((r) => <Cartao key={r.id} titulo={r.nome}>
      {r.descricao ? <Texto variante="suave">{r.descricao}</Texto> : null}
      {r.pastaId ? <Texto variante="pequeno">{pastas.dados?.find((p) => p.id === r.pastaId)?.nome}</Texto> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Botao rotulo="Editar conteúdo" aoTocar={() => router.push(`/treinador/planejamento/modelo/${r.id}`)} />
        <Botao rotulo="Nome e pasta" tipo="secundario" aoTocar={() => setFormulario(r)} />
        <Botao rotulo="Duplicar" tipo="secundario" carregando={ocupado === r.id} desabilitado={ocupado !== null} aoTocar={() => {
          setOcupado(r.id); duplicarReceita(r.id).then(() => { modelos.recarregar(); avisar('Modelo duplicado.', 'sucesso'); }, (e: unknown) => avisar(textoDoErro(e), 'perigo')).finally(() => setOcupado(null));
        }} />
        {!['SERIES', 'METODOLOGIA', 'MOBILIDADE'].includes(r.tipo) ? <Botao rotulo="Aplicar ao aluno" tipo="secundario" aoTocar={() => setAplicar(r)} /> : null}
        <Botao rotulo="Excluir" tipo="fantasma" aoTocar={() => setExcluir(r)} />
      </View>
    </Cartao>)}
    {formulario && config.dados ? <Formulario key={typeof formulario === 'string' ? 'novo' : formulario.id} receita={formulario === 'novo' ? null : formulario} tipo={tipo} pastaInicial={pasta === '*' ? '' : pasta} pastas={pastas.dados ?? []} aoFechar={() => setFormulario(null)} aoSalvar={async (nome, descricao, pastaId) => {
      if (formulario === 'novo') {
        const novo = await criarReceita({ tipo, nome, descricao, pastaId, conteudo: conteudoInicial(tipo, config.dados!.configuracao) });
        setFormulario(null); modelos.recarregar(); router.push(`/treinador/planejamento/modelo/${novo.id}`);
      } else { await alterarReceita(formulario.id, { ...formulario, nome, descricao, pastaId }); setFormulario(null); modelos.recarregar(); }
    }} /> : null}
    {organizar ? <OrganizarPastas pastas={pastas.dados ?? []} aoFechar={() => setOrganizar(false)} atualizar={atualizar} /> : null}
    {aplicar ? <AplicarAoAluno modelo={aplicar} aoFechar={() => setAplicar(null)} aoAplicar={(id) => { setAplicar(null); avisar('Cópia criada como rascunho.', 'sucesso'); router.push(`/treinador/alunos/${id}`); }} /> : null}
    <PainelConfirmacao visivel={!!excluir} titulo={`Excluir “${excluir?.nome ?? ''}”?`} mensagem="As cópias dos alunos e as metodologias já vinculadas permanecem iguais." rotuloConfirmar="Excluir modelo" perigo aoCancelar={() => setExcluir(null)} aoConfirmar={() => {
      if (!excluir) return; const id = excluir.id; setExcluir(null);
      excluirReceita(id).then(modelos.recarregar, (e: unknown) => avisar(textoDoErro(e), 'perigo'));
    }} />
  </Tela>;
}

function Formulario({ receita, tipo, pastaInicial, pastas, aoFechar, aoSalvar }: { receita: Receita | null; tipo: TipoReceita; pastaInicial: string; pastas: PastaModelo[]; aoFechar: () => void; aoSalvar: (nome: string, descricao: string | null, pastaId: string | null) => Promise<void> }) {
  const [nome, setNome] = useState(receita?.nome ?? ''); const [descricao, setDescricao] = useState(receita?.descricao ?? '');
  const [pasta, setPasta] = useState(receita ? receita.pastaId ?? '' : pastaInicial);
  const [salvando, setSalvando] = useState(false); const [erro, setErro] = useState<unknown>(null);
  return <Folha visivel titulo={receita ? 'Nome e organização' : `Novo modelo: ${CATEGORIAS.find((c) => c.valor === tipo)?.rotulo}`} aoFechar={aoFechar} rodape={<Botao rotulo={receita ? 'Salvar' : 'Criar e editar'} desabilitado={!nome.trim()} carregando={salvando} aoTocar={() => {
    setSalvando(true); setErro(null); aoSalvar(nome.trim(), descricao.trim() || null, pasta || null).catch((e: unknown) => { setErro(e); setSalvando(false); });
  }} />}>
    <Campo rotulo="Nome do modelo" valor={nome} aoMudar={setNome} maxLength={120} />
    <Campo rotulo="Descrição" valor={descricao} aoMudar={setDescricao} linhas={3} maxLength={400} />
    <Escolha rotulo="Pasta de organização" valor={pasta} aoMudar={setPasta} opcoes={[{ valor: '', rotulo: 'Sem pasta' }, ...pastas.map((p) => ({ valor: p.id, rotulo: p.nome }))]} />
    {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
  </Folha>;
}

function OrganizarPastas({ pastas, aoFechar, atualizar }: { pastas: PastaModelo[]; aoFechar: () => void; atualizar: () => void }) {
  const [nome, setNome] = useState(''); const [editando, setEditando] = useState<PastaModelo | null>(null);
  const [excluir, setExcluir] = useState<PastaModelo | null>(null); const [erro, setErro] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);
  const executar = async (acao: () => Promise<unknown>) => {
    setSalvando(true); setErro(null);
    try { await acao(); atualizar(); setNome(''); setEditando(null); } catch (e) { setErro(e); } finally { setSalvando(false); }
  };
  return <Folha visivel titulo="Pastas de organização" aoFechar={aoFechar}>
    <Texto variante="suave">Organizam seus modelos. Uma pasta de plano é um modelo que reúne treinos e dietas para aplicar juntos.</Texto>
    <Campo rotulo={editando ? 'Renomear pasta' : 'Nova pasta'} valor={nome} aoMudar={setNome} maxLength={120} />
    <Botao rotulo={editando ? 'Salvar nome' : 'Criar pasta'} carregando={salvando} desabilitado={!nome.trim()} aoTocar={() => void executar(() => editando ? alterarPastaModelo(editando.id, nome.trim(), editando.versao) : criarPastaModelo(nome.trim()))} />
    {editando ? <Botao rotulo="Cancelar edição" tipo="fantasma" aoTocar={() => { setEditando(null); setNome(''); }} /> : null}
    {pastas.map((p) => <Cartao key={p.id} titulo={p.nome}><Botao rotulo="Renomear pasta" tipo="secundario" desabilitado={salvando} aoTocar={() => { setEditando(p); setNome(p.nome); }} /><Botao rotulo="Excluir pasta" tipo="fantasma" desabilitado={salvando} aoTocar={() => setExcluir(p)} /></Cartao>)}
    {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    <PainelConfirmacao visivel={!!excluir} titulo={`Excluir pasta “${excluir?.nome ?? ''}”?`} mensagem="Os modelos serão movidos para Sem pasta." rotuloConfirmar="Excluir pasta" perigo aoCancelar={() => setExcluir(null)} aoConfirmar={() => { if (!excluir) return; const id = excluir.id; setExcluir(null); void executar(() => excluirPastaModelo(id)); }} />
  </Folha>;
}
