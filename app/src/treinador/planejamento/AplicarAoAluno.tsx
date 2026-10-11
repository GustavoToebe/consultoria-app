import { useState } from 'react';
import { aplicarModelo, listarAlunos, listarPastas } from '../../api/rotas';
import type { Receita } from '../../api/tipos';
import { destinosParaAplicar, SEM_PASTA_PARA_APLICAR } from '../../dominio/modelos';
import { useSessao } from '../../sessao/SessaoProvider';
import { dataDaTela } from '../../dominio/formatos';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoData } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/** Alunos por página de `GET /alunos` (igual à API e à lista de alunos). */
const TAMANHO_PAGINA = 30;

export function AplicarAoAluno({ modelo, alunoInicial, aoFechar, aoAplicar }: {
  modelo: Receita; alunoInicial?: string; aoFechar: () => void; aoAplicar: (alunoId: string, nomeDoAluno: string | null) => void;
}) {
  const { pode } = useSessao();
  const [busca, setBusca] = useState('');
  const [alunoId, setAlunoId] = useState(alunoInicial ?? '');
  const [pastaId, setPastaId] = useState('');
  const [titulo, setTitulo] = useState(modelo.nome);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [pagina, setPagina] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  // Nome do aluno escolhido fica guardado: a lista muda com a busca e a página.
  const [nomeEscolhido, setNomeEscolhido] = useState<string | null>(null);
  const alunos = useCarregar(`alunos-modelo:${busca}:${pagina}`, () => listarAlunos({ busca, pagina }));
  const temMais = !!alunos.dados && alunos.dados.itens.length > 0 && pagina * TAMANHO_PAGINA + alunos.dados.itens.length < alunos.dados.total;
  const pastas = useCarregar(`pastas-modelo:${alunoId}`, () => alunoId ? listarPastas(alunoId) : Promise.resolve([]));
  const destinos = destinosParaAplicar(pode('PASTA_ALTERAR'), alunoId ? pastas.dados ?? null : null);
  const destino = pastaId || destinos.padrao;
  const ini = dataDaTela(inicio); const fi = dataDaTela(fim);
  const salvar = async () => {
    setErro(null); setSalvando(true);
    try {
      await aplicarModelo(modelo.id, { alunoId, pastaId: destino || null, titulo: titulo.trim(), inicio: ini ?? null, fim: fi ?? null });
      aoAplicar(alunoId, alunos.dados?.itens.find((a) => a.id === alunoId)?.nome ?? nomeEscolhido);
    } catch (e) { setErro(e); setSalvando(false); }
  };
  const motivo = !alunoId ? 'Escolha o aluno.' : destinos.semDestino || (!destino && !pode('PASTA_ALTERAR')) ? 'Este aluno não tem pasta aberta para receber a cópia.' : !titulo.trim() ? 'Informe o título.' : ini === undefined || fi === undefined ? 'Confira as datas.' : !!ini && !!fi && ini > fi ? 'O fim precisa ser depois do início.' : undefined;
  return <Folha visivel titulo={`Aplicar: ${modelo.nome}`} aoFechar={aoFechar} rodape={<Botao rotulo="Criar cópia para o aluno" aoTocar={() => void salvar()} carregando={salvando} desabilitado={!!motivo} motivo={motivo} />}>
    <Texto variante="suave">Cria rascunhos independentes. Revise e publique os planos na ficha do aluno.</Texto>
    {!alunoInicial ? <EscolhaEmFolha rotulo="Aluno" titulo="Escolher aluno" valor={alunoId} rotuloDoValor={nomeEscolhido ?? 'Escolher'}
      opcoes={(alunos.dados?.itens ?? []).map((a) => ({ valor: a.id, rotulo: a.nome }))}
      aoMudar={(id) => { setAlunoId(id); setPastaId(''); setNomeEscolhido(alunos.dados?.itens.find((a) => a.id === id)?.nome ?? null); }}
      busca={{ valor: busca, rotulo: 'Buscar aluno', aoMudar: (v) => { setBusca(v); setPagina(0); } }}
      textoVazio={alunos.carregando ? 'Carregando…' : 'Nenhum aluno encontrado.'}
      rodape={<>
        {pagina > 0 || temMais ? <LinhaDeAcoes>
          {pagina > 0 ? <Botao rotulo="Alunos anteriores" tipo="secundario" aoTocar={() => setPagina(pagina - 1)} /> : null}
          {temMais ? <Botao rotulo="Próximos alunos" tipo="secundario" aoTocar={() => setPagina(pagina + 1)} /> : null}
        </LinhaDeAcoes> : null}
        {alunos.erro ? <MensagemErro texto={textoDoErro(alunos.erro)} tentarDeNovo={alunos.recarregar} /> : null}
      </>} /> : null}
    {alunoId && !destinos.semDestino ? <Escolha rotulo="Destino" valor={destino} opcoes={destinos.opcoes} aoMudar={setPastaId} /> : null}
    {alunoId && destinos.semDestino ? <Texto>{SEM_PASTA_PARA_APLICAR}</Texto> : null}
    <Campo rotulo={destino ? 'Título do plano' : 'Título da nova pasta / plano'} valor={titulo} aoMudar={setTitulo} maxLength={120} />
    {!destino ? <><CampoData rotulo="Início (opcional)" valor={inicio} aoMudar={setInicio} /><CampoData rotulo="Fim (opcional)" valor={fim} aoMudar={setFim} /></> : <Texto variante="pequeno">O período será o da pasta selecionada.</Texto>}
    {pastas.erro ? <MensagemErro texto={textoDoErro(pastas.erro)} tentarDeNovo={pastas.recarregar} /> : null}
    {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
  </Folha>;
}
