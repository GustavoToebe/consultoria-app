import { useState } from 'react';

import type { CampoDaInscricao } from '../../api/inscricoesTipos';
import { configuracaoInscricao } from '../../api/rotas';
import {
  INTERESSES, MODALIDADES_DESEJADAS, opcoesOpcionais, ORIGENS_INFORMADAS, PREVISOES,
} from '../../dominio/inscricoes';
import { OPCOES_DE_SEXO } from '../../dominio/sexo';
import { useSessao } from '../../sessao/SessaoProvider';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * Prévia ao vivo da Inscrição (tela larga): os campos fixos da página "Quero ser aluno" antes das perguntas, na ordem
 * e com os rótulos da página pública (`app/inscricao/[codigo].tsx`), sem os escondidos. O que se digita fica só aqui.
 * A escolha dos escondidos vem da configuração do link (a mesma leitura de `CamposFixosDaInscricao`); sem
 * `INSCRICAO_LER`, a prévia mostra todos e diz que pode haver campos escondidos.
 */
export function CamposFixosNaPrevia() {
  const { pode } = useSessao();
  return pode('INSCRICAO_LER') ? <ComConfiguracao /> : <Campos ocultos={[]} nota="Alguns destes campos podem estar escondidos no link de inscrição." />;
}

function ComConfiguracao() {
  const config = useCarregar('inscricao-configuracao', () => configuracaoInscricao());
  if (!config.dados && config.carregando) return <Cartao><Esqueleto /></Cartao>;
  // Sem formulário padrão (404) ou falha: a prévia não trava; mostra todos, com o aviso.
  return <Campos ocultos={config.dados?.camposOcultos ?? []} nota={config.dados ? null : 'Não foi possível ler quais campos estão escondidos; a prévia mostra todos.'} />;
}

function Campos({ ocultos, nota }: { ocultos: readonly CampoDaInscricao[]; nota: string | null }) {
  const [v, setV] = useState<Record<string, string>>({});
  const mudar = (campo: string) => (valor: string) => setV((x) => ({ ...x, [campo]: valor }));
  const mostra = (c: CampoDaInscricao) => !ocultos.includes(c);
  return <>
    <Cartao titulo="Seu contato" descricao={nota ?? undefined}>
      <Campo rotulo="Nome" valor={v.nome ?? ''} aoMudar={mudar('nome')} autoComplete="off" />
      <Campo rotulo="WhatsApp com DDD" valor={v.whatsapp ?? ''} aoMudar={mudar('whatsapp')} placeholder="DDD + número" inputMode="tel" autoComplete="off" />
      {mostra('EMAIL') ? <Campo rotulo="E-mail (opcional)" valor={v.email ?? ''} aoMudar={mudar('email')} inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false}
        ajuda="Usado só para o convite de acesso ao app, se você virar aluno." /> : null}
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
