import { CartaoTagsDosAlunos } from '../../../treinador/tags/CartaoTagsDosAlunos';
import { LARGURA_EDITOR } from '../../../tema/tokens';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Tela } from '../../../ui/Tela';

/**
 * Tags dos alunos (cartão das Configurações; `docs/planos/tags-de-aluno.md`, D10). Mora em `/treinador/alunos/tags` para
 * valer a mesma guarda da lista de alunos (`ALUNO_LER`); a gestão pede `ALUNO_ALTERAR`, conferida no cartão e na API.
 */
export default function TagsDosAlunos() {
  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Tags dos alunos" voltar="/treinador/configuracoes"
        trilha={[{ rotulo: 'Configurações', href: '/treinador/configuracoes' }, { rotulo: 'Tags dos alunos' }]} />
      <CartaoTagsDosAlunos />
    </Tela>
  );
}
