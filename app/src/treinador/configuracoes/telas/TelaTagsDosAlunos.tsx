import { Cabecalho } from '../../../ui/Cabecalho';
import { Tela } from '../../../ui/Tela';
import { CartaoTagsDosAlunos } from '../../tags/CartaoTagsDosAlunos';
import { SOBRE_A_TELA_DAS_TAGS } from '../../tags/textosDasTags';

/**
 * Tags dos alunos (cartão das Configurações; `docs/planos/tags-de-aluno.md`, D10). A rota inteira mora em
 * `/treinador/alunos/tags`, para valer a mesma guarda da lista de alunos (`ALUNO_LER`); a gestão pede `ALUNO_ALTERAR`,
 * conferida no cartão e na API. Aberta dentro de Configurações (`embutida`), a seta e a trilha somem: a coluna da esquerda já navega.
 */
export function TelaTagsDosAlunos({ embutida = false }: { embutida?: boolean }) {
  return (
    <Tela bordas={['top']}>
      <Cabecalho titulo="Tags dos alunos" descricao={SOBRE_A_TELA_DAS_TAGS}
        {...(embutida ? null : { voltar: '/treinador/configuracoes' as const, trilha: [{ rotulo: 'Configurações', href: '/treinador/configuracoes' as const }, { rotulo: 'Tags dos alunos' }] })} />
      <CartaoTagsDosAlunos />
    </Tela>
  );
}
