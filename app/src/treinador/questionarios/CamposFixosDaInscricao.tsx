import { useState } from 'react';

import { configuracaoInscricao, esconderCamposDaInscricao } from '../../api/rotas';
import type { CampoDaInscricao } from '../../api/inscricoesTipos';
import { alternarCampoOculto, CAMPOS_DA_INSCRICAO } from '../../dominio/inscricoes';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { Interruptor } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * Campos fixos da página "Quero ser aluno" (D4 de `docs/planos/inscricao-com-perguntas-proprias.md`), no topo da aba
 * Inscrição do Planejamento. Nome, WhatsApp e a ciência do texto nunca saem; os outros o treinador pode esconder, um a um.
 * A escolha mora na configuração do link (`INSCRICAO_LER` para ver, `INSCRICAO_ALTERAR` para mudar) e vale na hora,
 * com a versão da configuração: outra aba mudou antes = recarrega e avisa.
 */
export function CamposFixosDaInscricao() {
  const { pode } = useSessao();
  if (!pode('INSCRICAO_LER')) return null;
  return <Campos podeAlterar={pode('INSCRICAO_ALTERAR')} />;
}

function Campos({ podeAlterar }: { podeAlterar: boolean }) {
  const { avisar } = useAviso();
  const config = useCarregar('inscricao-configuracao', () => configuracaoInscricao());
  const [salvando, setSalvando] = useState(false);
  const ocultos = config.dados?.camposOcultos ?? [];

  const mudar = (campo: CampoDaInscricao, mostrar: boolean) => {
    if (!config.dados || salvando) return;
    setSalvando(true);
    esconderCamposDaInscricao(alternarCampoOculto(ocultos, campo, !mostrar), config.dados.versao)
      .then((nova) => config.definir(nova), (e: unknown) => {
        config.recarregar();
        avisar(codigoApi(e) === 'CONFLITO_EDICAO' ? 'Outra pessoa ou aba mudou a página de inscrição. Confira e tente de novo.' : textoDoErro(e), 'perigo');
      })
      .finally(() => setSalvando(false));
  };

  return <Cartao titulo="Campos fixos da página"
    descricao="Nome, WhatsApp e a ciência do texto da consultoria sempre aparecem. Os outros você pode esconder; as suas perguntas entram embaixo deles.">
    {config.erro ? <MensagemErro texto={textoDoErro(config.erro)} erro={config.erro} tentarDeNovo={config.recarregar} /> : null}
    {!config.dados && config.carregando ? <Esqueleto /> : null}
    {config.dados ? CAMPOS_DA_INSCRICAO.map((c) => podeAlterar
      ? <Interruptor key={c.valor} rotulo={`Mostrar "${c.rotulo}"`} ajuda={c.uso} valor={!ocultos.includes(c.valor)}
        aoMudar={(mostrar) => mudar(c.valor, mostrar)} />
      : <CampoLeitura key={c.valor} rotulo={c.rotulo} valor={ocultos.includes(c.valor) ? 'Escondido' : 'Aparece na página'} />) : null}
    {config.dados && !podeAlterar ? <Texto variante="pequeno">Só quem altera o link de inscrição muda estes campos.</Texto> : null}
  </Cartao>;
}
