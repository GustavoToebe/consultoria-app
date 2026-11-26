import { colunasDoHub } from '../../../dominio/colunasPorCelula';
import { espaco } from '../../../tema/tokens';
import { MeuPerfilEquipe } from '../../../treinador/equipe/MeuPerfilEquipe';
import { useSessao } from '../../../sessao/SessaoProvider';
import { Alvenaria, type PecaDaAlvenaria } from '../../../ui/Alvenaria';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Cartao } from '../../../ui/Cartao';
import { CampoLeitura } from '../../../ui/CampoLeitura';
import { Tela, useFaixaDaTela } from '../../../ui/Tela';
import { TrocarSenha } from '../../../ui/TrocarSenha';

const VAO = espaco(3);

/**
 * Meus dados: acesso (e-mail de entrada), seus dados na equipe (nome e telefone) e troca de senha. Aberta pelo cartão
 * do usuário. "Conta" ficou só para a assinatura ("Assinatura e faturas", rota `minha-conta`); aqui o cartão do e-mail se chama "Acesso".
 * Tela larga (26/11): sem teto próprio (Automática preenche a coluna ao lado do menu; Limitada para em 1800) e os cartões em
 * colunas empilhadas (`ui/Alvenaria`, a regra do hub de Configurações): 1 no celular, 2 na normal, 3 a partir da larga.
 */
export function TelaMeusDados() {
  return (
    <Tela bordas={['top']}>
      <Cabecalho titulo="Meus dados" descricao="Seu acesso, seu nome na equipe e sua senha." />
      <CartoesDosMeusDados />
    </Tela>
  );
}

/** Dentro da `Tela`, para ler a faixa dela. */
function CartoesDosMeusDados() {
  const { usuario, offline } = useSessao();
  const faixa = useFaixaDaTela();
  // Sem conexão a troca de senha some (`TrocarSenha` devolve nada): fora da alvenaria, uma peça vazia nunca seria medida.
  const pecas: PecaDaAlvenaria[] = [
    { chave: 'acesso', peso: 2, conteudo: <Cartao titulo="Acesso"><CampoLeitura rotulo="E-mail de entrada" valor={usuario?.email} /></Cartao> },
    { chave: 'equipe', peso: 5, conteudo: <MeuPerfilEquipe /> },
    ...(offline ? [] : [{ chave: 'senha', peso: 5, conteudo: <TrocarSenha /> }]),
  ];
  return <Alvenaria vao={VAO} colunas={(largura) => colunasDoHub(largura, faixa, VAO, pecas.length)} pecas={pecas} />;
}
