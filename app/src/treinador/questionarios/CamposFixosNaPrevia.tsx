import { useState } from 'react';

import { configuracaoInscricao } from '../../api/rotas';
import {
  INTERESSES, MODALIDADES_DESEJADAS, opcoesOpcionais, ORIGENS_INFORMADAS, PREVISOES,
} from '../../dominio/inscricoes';
import { camposFixosDaPrevia, type CampoFixoDaPrevia } from '../../dominio/resumoDoQuestionario';
import { OPCOES_DE_SEXO } from '../../dominio/sexo';
import { useSessao } from '../../sessao/SessaoProvider';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { useCarregar } from '../../ui/useCarregar';

/** O que a prévia e o índice da Inscrição precisam saber dos campos fixos: quais a prévia mostra e a nota, se houver. */
export interface CamposFixos { campos: readonly CampoFixoDaPrevia[]; nota: string | null; carregando: boolean }

/**
 * A escolha dos escondidos vem da configuração do link (a mesma leitura de `CamposFixosDaInscricao`), lida uma vez no
 * editor e repartida entre a prévia e a contagem do índice; sem `INSCRICAO_LER`, todos, com a nota de que pode haver
 * campos escondidos. `ativo` falso (não é Inscrição, ou ainda carregando o rascunho): nada é buscado.
 */
export function useCamposFixos(ativo: boolean): CamposFixos {
  const { pode } = useSessao();
  const ler = ativo && pode('INSCRICAO_LER');
  const config = useCarregar(ler ? 'inscricao-configuracao' : null, () => configuracaoInscricao());
  if (!ler) return { campos: camposFixosDaPrevia([]), nota: 'Alguns destes campos podem estar escondidos no link de inscrição.', carregando: false };
  // Sem formulário padrão (404) ou falha: a prévia não trava; mostra todos, com o aviso.
  return {
    campos: camposFixosDaPrevia(config.dados?.camposOcultos ?? []),
    nota: config.dados || config.carregando ? null : 'Não foi possível ler quais campos estão escondidos; a prévia mostra todos.',
    carregando: !config.dados && config.carregando,
  };
}

/**
 * Prévia ao vivo da Inscrição (tela larga): os campos fixos da página "Quero ser aluno" antes das perguntas, na ordem
 * e com os rótulos da página pública (`app/inscricao/[codigo].tsx`), sem os escondidos (`camposFixosDaPrevia`, a mesma
 * lista que o índice conta). O que se digita fica só aqui.
 */
export function CamposFixosNaPrevia({ fixos }: { fixos: CamposFixos }) {
  if (fixos.carregando) return <Cartao><Esqueleto /></Cartao>;
  return <Campos campos={fixos.campos} nota={fixos.nota} />;
}

function Campos({ campos, nota }: { campos: readonly CampoFixoDaPrevia[]; nota: string | null }) {
  const [v, setV] = useState<Record<string, string>>({});
  const mudar = (campo: string) => (valor: string) => setV((x) => ({ ...x, [campo]: valor }));
  const mostra = (c: CampoFixoDaPrevia) => campos.includes(c);
  return <>
    <Cartao titulo="Seu contato" descricao={nota ?? undefined}>
      <Campo rotulo="Nome" valor={v.nome ?? ''} aoMudar={mudar('nome')} autoComplete="off" />
      <Campo rotulo="WhatsApp com DDD" valor={v.whatsapp ?? ''} aoMudar={mudar('whatsapp')} placeholder="DDD + número" inputMode="tel" autoComplete="off" />
      {mostra('EMAIL') ? <Campo rotulo="E-mail (opcional)" valor={v.email ?? ''} aoMudar={mudar('email')} inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false}
        ajuda="Usado só para o convite de acesso ao app, se você virar aluno." /> : null}
      <Campo rotulo="Instagram (opcional)" valor={v.instagram ?? ''} aoMudar={mudar('instagram')} placeholder="@usuario ou link do perfil" autoComplete="off" autoCapitalize="none" spellCheck={false}
        ajuda="O Instagram vai para as redes do aluno quando você aceitar a inscrição." />
    </Cartao>
    {mostra('SEXO') || mostra('OBJETIVO') ? <Cartao>
      {mostra('SEXO') ? <Escolha rotulo="Sexo (opcional)" valor={v.sexo ?? ''} aoMudar={mudar('sexo')} distribuida
        opcoes={[{ valor: '', rotulo: 'Não informar' }, ...OPCOES_DE_SEXO]} /> : null}
      {mostra('OBJETIVO') ? <Campo rotulo="Objetivo (opcional)" valor={v.objetivo ?? ''} aoMudar={mudar('objetivo')} linhas={3}
        ajuda="Em poucas palavras. Informações de saúde ficam para depois, se a inscrição for aceita." /> : null}
    </Cartao> : null}
    {mostra('INTERESSE') || mostra('MODALIDADE') || mostra('PREVISAO_INICIO') || mostra('ORIGEM') ? (
      <Cartao titulo="Perguntas rápidas" descricao="Opcionais. Ajudam a equipe a falar com você sobre o que importa.">
        {mostra('INTERESSE') ? <Escolha rotulo="O que você procura?" valor={v.interesse ?? ''} aoMudar={mudar('interesse')} distribuida opcoes={opcoesOpcionais(INTERESSES)} /> : null}
        {mostra('MODALIDADE') ? <Escolha rotulo="Como prefere o acompanhamento?" valor={v.modalidade ?? ''} aoMudar={mudar('modalidade')} distribuida
          opcoes={opcoesOpcionais(MODALIDADES_DESEJADAS)} /> : null}
        {mostra('PREVISAO_INICIO') ? <Escolha rotulo="Quando quer começar?" valor={v.previsao ?? ''} aoMudar={mudar('previsao')} distribuida opcoes={opcoesOpcionais(PREVISOES)} /> : null}
        {mostra('ORIGEM') ? <Escolha rotulo="Como conheceu a consultoria?" valor={v.origem ?? ''} aoMudar={mudar('origem')} distribuida
          opcoes={opcoesOpcionais(ORIGENS_INFORMADAS)} /> : null}
      </Cartao>
    ) : null}
  </>;
}
