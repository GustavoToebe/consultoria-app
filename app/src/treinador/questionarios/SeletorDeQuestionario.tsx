import { useState } from 'react';

import { ErroApi } from '../../api/cliente';
import { opcoesDeQuestionario } from '../../api/rotas';
import { opcoesDoSeletor, textoDoQuestionarioEscolhido } from '../../dominio/seletorQuestionario';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { textoDoErro } from '../../ui/erros';
import { useCarregar } from '../../ui/useCarregar';

interface Props {
  rotulo: string;
  /** Questionário escolhido; nulo = nenhum (vale o `rotuloDoNulo`). */
  valor: string | null | undefined;
  /** Texto de "sem escolha": "Padrão da consultoria" no aluno, "O do aluno" na pasta. */
  rotuloDoNulo: string;
  podeAlterar: boolean;
  aoEscolher: (questionarioId: string | null) => Promise<void>;
}

/**
 * Escolha do questionário de atualização (ficha do aluno e folha da pasta). As opções são só os publicados e ativos.
 * Sem permissão para alterar é só leitura; sem acesso nem às opções (403) a linha some, porque não há o que mostrar.
 */
export function SeletorDeQuestionario({ rotulo, valor, rotuloDoNulo, podeAlterar, aoEscolher }: Props) {
  const { avisar } = useAviso();
  const { pode } = useSessao();
  // As mesmas permissões da rota: sem nenhuma delas nem se pergunta (a API ainda responderia 403, tratado abaixo).
  const podeVer = pode('QUESTIONARIO_LER') || pode('ALUNO_ALTERAR') || pode('PASTA_ALTERAR');
  const opcoes = useCarregar(podeVer ? 'questionarios-opcoes' : null, () => opcoesDeQuestionario());
  const [ocupado, setOcupado] = useState(false);

  if (!podeVer || (opcoes.erro instanceof ErroApi && opcoes.erro.status === 403)) return null;
  if (!opcoes.dados) return <CampoLeitura rotulo={rotulo} valor={opcoes.erro ? textoDoErro(opcoes.erro) : null} />;

  const texto = textoDoQuestionarioEscolhido(valor, opcoes.dados, rotuloDoNulo);
  if (!podeAlterar) return <CampoLeitura rotulo={rotulo} valor={texto} />;

  const escolher = (id: string | null) => {
    if (id === (valor ?? null)) return;
    setOcupado(true);
    aoEscolher(id).then(
      () => avisar('Questionário atualizado.', 'sucesso'),
      (e: unknown) => {
        // Arquivado ou despublicado depois de a lista abrir: busca as opções de novo para não oferecer o mesmo erro.
        if (e instanceof ErroApi && e.codigo === 'QUESTIONARIO_INDISPONIVEL') opcoes.recarregar();
        avisar(textoDoErro(e), 'perigo');
      },
    ).finally(() => setOcupado(false));
  };
  return <EscolhaEmFolha rotulo={rotulo} titulo={rotulo} valor={valor ?? null} rotuloDoValor={texto} desabilitado={ocupado}
    opcoes={opcoesDoSeletor(opcoes.dados, rotuloDoNulo)} aoMudar={escolher} />;
}
