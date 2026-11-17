import { AJUDA_DO_NOME, nomeParaColegas, NOTA_SEM_APELIDO, OPCOES_DE_NOME, type ExibicaoDoNome } from '../dominio/perfilDaComunidade';
import { MensagemDeErro } from '../ui/Campo';
import { GradeDeOpcoes } from '../ui/GradeDeOpcoes';
import { OpcaoCartao } from '../ui/OpcaoCartao';
import { Texto } from '../ui/Texto';

/**
 * "Como seu nome aparece para os colegas" (V085, `docs/planos/nome-no-mural.md`), dentro do "Meu perfil": as quatro opções,
 * cada uma com a prévia montada com o nome e o apelido do próprio aluno (`nomeParaColegas`, espelho do servidor). Sem os
 * dados (`nomes` nulo: ainda carregando ou a leitura falhou) as opções ficam só com o título. O estado e o salvar são do
 * cartão: um primário só ("Salvar perfil").
 */
export function EscolhaDoNome({ valor, nomes, aoEscolher, erro }: {
  valor: string;
  nomes: { nome: string; apelido: string | null } | null;
  aoEscolher: (v: ExibicaoDoNome) => void;
  erro?: string;
}) {
  const semApelido = nomes !== null && !nomes.apelido?.trim();
  return (
    <>
      <GradeDeOpcoes rotulo="Como seu nome aparece para os colegas" descricao={AJUDA_DO_NOME}>
        {OPCOES_DE_NOME.map((o) => (
          <OpcaoCartao key={o.valor} titulo={o.nome} selecionada={valor === o.valor} aoEscolher={() => aoEscolher(o.valor)}
            descricao={nomes ? nomeParaColegas(o.valor, nomes.nome, nomes.apelido) : undefined} />
        ))}
      </GradeDeOpcoes>
      {semApelido ? <Texto variante="pequeno">{NOTA_SEM_APELIDO}</Texto> : null}
      {erro ? <MensagemDeErro erro={erro} /> : null}
    </>
  );
}
