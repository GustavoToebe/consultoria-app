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
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

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
  const alunos = useCarregar(`alunos-modelo:${busca}:${pagina}`, () => listarAlunos({ busca, pagina }));
  const pastas = useCarregar(`pastas-modelo:${alunoId}`, () => alunoId ? listarPastas(alunoId) : Promise.resolve([]));
  const destinos = destinosParaAplicar(pode('PASTA_ALTERAR'), alunoId ? pastas.dados ?? null : null);
  const destino = pastaId || destinos.padrao;
  const ini = dataDaTela(inicio); const fi = dataDaTela(fim);
  const salvar = async () => {
    setErro(null); setSalvando(true);
    try {
      await aplicarModelo(modelo.id, { alunoId, pastaId: destino || null, titulo: titulo.trim(), inicio: ini ?? null, fim: fi ?? null });
      aoAplicar(alunoId, alunos.dados?.itens.find((a) => a.id === alunoId)?.nome ?? null);
    } catch (e) { setErro(e); setSalvando(false); }
  };
  return <Folha visivel titulo={`Aplicar: ${modelo.nome}`} aoFechar={aoFechar} rodape={<Botao rotulo="Criar cópia para o aluno" aoTocar={() => void salvar()} carregando={salvando} desabilitado={!alunoId || destinos.semDestino || (!destino && !pode('PASTA_ALTERAR')) || !titulo.trim() || ini === undefined || fi === undefined || (!!ini && !!fi && ini > fi)} />}>
    <Texto variante="suave">Cria rascunhos independentes. Revise e publique os planos na ficha do aluno.</Texto>
    {!alunoInicial ? <>
      <Campo rotulo="Buscar aluno" valor={busca} aoMudar={(v) => { setBusca(v); setPagina(0); }} />
      <Escolha rotulo="Aluno" valor={alunoId} opcoes={(alunos.dados?.itens ?? []).map((a) => ({ valor: a.id, rotulo: a.nome }))} aoMudar={(id) => { setAlunoId(id); setPastaId(''); }} />
      {pagina > 0 ? <Botao rotulo="Alunos anteriores" tipo="secundario" aoTocar={() => setPagina(pagina - 1)} /> : null}
      {alunos.dados && alunos.dados.itens.length > 0 && (pagina + 1) * alunos.dados.itens.length < alunos.dados.total ? <Botao rotulo="Próximos alunos" tipo="secundario" aoTocar={() => setPagina(pagina + 1)} /> : null}
      {alunos.erro ? <MensagemErro texto={textoDoErro(alunos.erro)} tentarDeNovo={alunos.recarregar} /> : null}
    </> : null}
    {alunoId && !destinos.semDestino ? <Escolha rotulo="Destino" valor={destino} opcoes={destinos.opcoes} aoMudar={setPastaId} /> : null}
    {alunoId && destinos.semDestino ? <Texto>{SEM_PASTA_PARA_APLICAR}</Texto> : null}
    <Campo rotulo={destino ? 'Título do plano' : 'Título da nova pasta / plano'} valor={titulo} aoMudar={setTitulo} maxLength={120} />
    {!destino ? <><CampoData rotulo="Início (opcional)" valor={inicio} aoMudar={setInicio} /><CampoData rotulo="Fim (opcional)" valor={fim} aoMudar={setFim} /></> : <Texto variante="pequeno">O período será o da pasta selecionada.</Texto>}
    {pastas.erro ? <MensagemErro texto={textoDoErro(pastas.erro)} tentarDeNovo={pastas.recarregar} /> : null}
    {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
  </Folha>;
}
