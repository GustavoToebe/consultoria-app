import { Cabecalho } from '../../../ui/Cabecalho';
import { Tela } from '../../../ui/Tela';
import { CartaoTagsDosAlunos } from '../../tags/CartaoTagsDosAlunos';

/**
 * Tags dos alunos (cartão das Configurações; `docs/planos/tags-de-aluno.md`, D10). A rota inteira mora em
 * `/treinador/alunos/tags`, para valer a mesma guarda da lista de alunos (`ALUNO_LER`); a gestão pede `ALUNO_ALTERAR`,
 * conferida no cartão e na API. Aberta dentro de Configurações (`embutida`), a seta e a trilha somem: a coluna da esquerda já navega.
 */
export function TelaTagsDosAlunos({ embutida = false }: { embutida?: boolean }) {
  return (
    <Tela bordas={['top']}>
      <Cabecalho titulo="Tags dos alunos" descricao="Rótulos só da equipe, para achar e filtrar alunos; o aluno não os vê. Crie, renomeie, troque a cor ou apague, sem usar para dado de saúde."
        {...(embutida ? null : { voltar: '/treinador/configuracoes' as const, trilha: [{ rotulo: 'Configurações', href: '/treinador/configuracoes' as const }, { rotulo: 'Tags dos alunos' }] })} />
      <CartaoTagsDosAlunos />
    </Tela>
  );
}
