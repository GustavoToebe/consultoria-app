import { aluno as buscarAluno } from '../../api/rotas';
import { blocoVisivel, type BlocoDaFicha, type ContextoDaFicha } from '../../dominio/fichaDoAluno';
import { CartaoFotos } from '../../fotos/CartaoFotos';
import { useSessao } from '../../sessao/SessaoProvider';
import { textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { useCarregar } from '../../ui/useCarregar';
import { CartaoAvaliacaoFisica } from '../CartaoAvaliacaoFisica';
import { CartaoEvolucaoRespostas } from '../CartaoEvolucaoRespostas';
import { CartaoPeso } from '../CartaoPeso';

/** Os cartões da aba Evolução da revisão, na ordem do plano D: peso, evolução das respostas, fotos e avaliação física. */
const BLOCOS: readonly BlocoDaFicha[] = ['peso', 'evolucaoDasRespostas', 'fotos', 'avaliacaoFisica'];

/** Os cartões que a pessoa vê, com a mesma regra da ficha (`blocoVisivel`); vazio = a aba Evolução não aparece. */
export function blocosDaEvolucaoDaRevisao(pode: ContextoDaFicha['pode']): BlocoDaFicha[] {
  const contexto: ContextoDaFicha = { pode, pagamentosHabilitados: false, retornoHabilitado: false };
  return BLOCOS.filter((b) => blocoVisivel(b, contexto));
}

/**
 * Aba "Evolução" da revisão da atualização (bloco D): os mesmos cartões da ficha do aluno, com `alunoId`, para comparar sem sair
 * da tela. A coluna principal da revisão tem no máximo 880, então os cartões ficam numa pilha só (a regra das duas pilhas da
 * ficha pede 1000 px cada). Fotos e avaliação física precisam do cadastro (autorização das fotos, aluno anonimizado e o nome):
 * sem ele, o cartão diria que o aluno não autorizou; por isso esperam o cadastro e mostram o erro dele com "Tentar de novo".
 */
export function EvolucaoDaRevisao({ alunoId }: { alunoId: string }) {
  const { pode } = useSessao();
  const blocos = blocosDaEvolucaoDaRevisao(pode);
  const precisaDoCadastro = blocos.includes('fotos') || blocos.includes('avaliacaoFisica');
  const cadastro = useCarregar(precisaDoCadastro ? `revisao-aluno:${alunoId}` : null, () => buscarAluno(alunoId));
  const a = cadastro.dados;
  const doCadastro = (b: BlocoDaFicha) => {
    if (cadastro.erro) return <MensagemErro key={b} texto={textoDoErro(cadastro.erro)} erro={cadastro.erro} tentarDeNovo={cadastro.recarregar} />;
    if (!a) return <Esqueleto key={b} cartoes={1} />;
    return b === 'fotos'
      ? <CartaoFotos key={b} alunoId={alunoId} autorizadoEm={a.usoDeImagemAutorizadoEm} aoRecarregar={cadastro.recarregar} />
      : <CartaoAvaliacaoFisica key={b} alunoId={alunoId} alunoNome={a.nome} anonimizado={a.anonimizado} />;
  };
  // Erro do cadastro uma vez só, no lugar do primeiro cartão que depende dele.
  const primeiroDoCadastro = blocos.find((b) => b === 'fotos' || b === 'avaliacaoFisica');
  return (
    <>
      {blocos.map((b) => {
        if (b === 'peso') return <CartaoPeso key={b} alunoId={alunoId} />;
        if (b === 'evolucaoDasRespostas') return <CartaoEvolucaoRespostas key={b} alunoId={alunoId} />;
        if (cadastro.erro && b !== primeiroDoCadastro) return null;
        return doCadastro(b);
      })}
    </>
  );
}
