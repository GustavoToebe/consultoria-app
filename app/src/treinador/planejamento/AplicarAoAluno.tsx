import { useState } from 'react';
import { aplicarModelo } from '../../api/rotas';
import type { Receita } from '../../api/tipos';
import { dataDaTela } from '../../dominio/formatos';
import { descricaoDoModelo } from '../../dominio/modelos';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoData } from '../../ui/Campos';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { useAvisoDoPlano } from '../../ui/useAvisoDoPlano';
import { Texto } from '../../ui/Texto';
import { EscolhaDeAlunoEPasta, useEscolhaDeAlunoEPasta } from '../EscolhaDeAlunoEPasta';

export function AplicarAoAluno({ modelo, alunoInicial, aoFechar, aoAplicar }: {
  modelo: Receita; alunoInicial?: string; aoFechar: () => void; aoAplicar: (alunoId: string, nomeDoAluno: string | null) => void;
}) {
  const escolha = useEscolhaDeAlunoEPasta({ alunoInicial });
  const { alunoId, destino } = escolha;
  const [titulo, setTitulo] = useState(modelo.nome);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const avisarDoPlano = useAvisoDoPlano();
  const ini = dataDaTela(inicio); const fi = dataDaTela(fim);
  const salvar = async () => {
    setErro(null); setSalvando(true);
    try {
      await aplicarModelo(modelo.id, { alunoId, pastaId: destino || null, titulo: titulo.trim(), inicio: ini ?? null, fim: fi ?? null });
      aoAplicar(alunoId, escolha.nomeDoAluno);
    } catch (e) {
      setSalvando(false);
      // Erro do plano: o aviso fica fora da Folha (que é um Modal), então a Folha fecha antes.
      if (avisarDoPlano(e)) aoFechar(); else setErro(e);
    }
  };
  const motivo = escolha.motivo ?? (!titulo.trim() ? 'Informe o título.' : ini === undefined || fi === undefined ? 'Confira as datas.' : !!ini && !!fi && ini > fi ? 'O fim precisa ser depois do início.' : undefined);
  return <Folha visivel titulo={`Aplicar: ${modelo.nome}`} aoFechar={aoFechar} rodape={<Botao rotulo="Criar cópia para o aluno" aoTocar={() => void salvar()} carregando={salvando} desabilitado={!!motivo} motivo={motivo} />}>
    <Texto variante="suave">Cria rascunhos independentes. Revise e publique os planos na ficha do aluno.</Texto>
    <Texto variante="pequeno">{`Descrição do modelo: ${descricaoDoModelo(modelo)} (não vai para o plano do aluno).`}</Texto>
    <EscolhaDeAlunoEPasta escolha={escolha} />
    <Campo rotulo={destino ? 'Título do plano' : 'Título da pasta nova (o plano usa o mesmo)'} valor={titulo} aoMudar={setTitulo} maxLength={120} />
    {!destino ? <><CampoData rotulo="Início (opcional)" valor={inicio} aoMudar={setInicio} /><CampoData rotulo="Fim (opcional)" valor={fim} aoMudar={setFim} /></> : <Texto variante="pequeno">O período será o da pasta selecionada.</Texto>}
    {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
  </Folha>;
}
