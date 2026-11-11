import { useState } from 'react';

import { ErroApi } from '../api/cliente';
import { denunciarPost } from '../api/comunidade';
import type { MotivoDeDenuncia, PostDoMural } from '../api/comunidadeTipos';
import { MOTIVOS_DE_DENUNCIA } from '../dominio/comunidade';
import { useAviso } from '../ui/Aviso';
import { Escolha } from '../ui/Escolha';
import { MensagemErro } from '../ui/Estados';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { separarErros } from '../ui/erros';

const OPCOES = MOTIVOS_DE_DENUNCIA.map((m) => ({ valor: m.motivo, rotulo: m.rotulo }));

/**
 * "Denunciar" do ⋯ de um post de outra pessoa (aluno): o motivo numa lista fechada, nunca `alert`. Enviado, o painel
 * fecha e o aviso "Denúncia enviada." confirma; ninguém fica sabendo quem denunciou. 404 = o post saiu do mural.
 */
export function PainelDeDenuncia({ post, aoFechar, aoSumir }: { post: PostDoMural | null; aoFechar: () => void; aoSumir: () => void }) {
  const { avisar } = useAviso();
  const [motivo, setMotivo] = useState<MotivoDeDenuncia | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ campo?: string; geral?: string } | null>(null);

  const fechar = () => { setMotivo(null); setErro(null); aoFechar(); };

  const enviar = async () => {
    if (!post || !motivo) return;
    setEnviando(true);
    setErro(null);
    try {
      await denunciarPost(post.id, motivo);
      fechar();
      avisar('Denúncia enviada.', 'sucesso');
    } catch (e) {
      if (e instanceof ErroApi && e.status === 404) { fechar(); avisar('Esta publicação saiu do mural.', 'atencao'); aoSumir(); return; }
      const { campos, geral } = separarErros(e, ['motivo']);
      setErro({ campo: campos.motivo, geral: geral ?? undefined });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <PainelConfirmacao
      visivel={!!post}
      titulo="Denunciar a publicação?"
      mensagem="A equipe da consultoria vai olhar. Quem publicou não fica sabendo quem denunciou."
      rotuloConfirmar="Denunciar"
      perigo
      carregando={enviando}
      desabilitado={!motivo}
      motivo="Escolha o motivo."
      aoConfirmar={() => void enviar()}
      aoCancelar={fechar}>
      <Escolha rotulo="Motivo" chips opcoes={OPCOES} valor={motivo} aoMudar={setMotivo} erro={erro?.campo} />
      {erro?.geral ? <MensagemErro texto={erro.geral} /> : null}
    </PainelConfirmacao>
  );
}
