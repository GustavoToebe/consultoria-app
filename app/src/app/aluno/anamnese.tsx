import { FormularioAnamnese } from '../../aluno/anamnese/FormularioAnamnese';
import { useAnamnese } from '../../aluno/anamnese/useAnamnese';
import { useAluno } from '../../offline/AlunoProvider';
import { Cabecalho } from '../../ui/Cabecalho';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { useCarregar } from '../../ui/useCarregar';

/** Anamnese do aluno: a pendente (para responder) ou a última enviada (só leitura). */
export default function AnamneseAluno() {
  const resultado = useAnamnese();
  const { repositorio } = useAluno();
  const a = resultado.dados;
  // A chave inclui a situação: enviada ou dispensada em outro aparelho, o formulário remonta com o estado novo.
  const chave = a ? `${a.id}:${a.situacao}:${a.versao}` : null;
  const rascunho = useCarregar(chave, async (c) => ({ chave: c, valor: await repositorio.lerRascunhoAnamnese(a!.id) }));
  return <Tela largura={720} rolar={false} bordas={['top']}>
    <Cabecalho titulo="Anamnese" voltar="/aluno" />
    {resultado.carregando || rascunho.carregando ? <Esqueleto texto="Carregando anamnese" /> : null}
    {resultado.erro ? <MensagemErro texto={textoDoErro(resultado.erro)} /> : null}
    {rascunho.erro ? <MensagemErro texto="Não foi possível ler o rascunho. Volte e tente novamente." /> : null}
    {!resultado.carregando && !resultado.erro && a === null ? <Vazio titulo="Sem anamnese" texto="Seu treinador ainda não enviou uma anamnese para você." /> : null}
    {a && rascunho.dados && rascunho.dados.chave === chave && !rascunho.carregando && !rascunho.erro
      ? <FormularioAnamnese key={chave} anamnese={a} rascunho={rascunho.dados.valor} recarregar={resultado.recarregar} /> : null}
  </Tela>;
}
