import { useEffect, useState } from 'react';

import { atualizarAvisosWhatsAppAluno, obterAvisosWhatsAppAluno } from '../servicos/whatsapp';
import { useSessao } from '../sessao/SessaoProvider';
import { useAviso } from '../ui/Aviso';
import { Interruptor } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { Texto } from '../ui/Texto';
import { textoDoErro } from '../ui/erros';

/**
 * Opt-in do aluno para receber avisos de cobrança e compromisso pelo WhatsApp oficial da consultoria (C14).
 * Só aparece quando `whatsappHabilitado` está ligado na plataforma e a consultoria conectou um número (`disponivel`).
 */
export function InterruptorDeWhatsApp() {
  const { whatsappHabilitado } = useSessao();
  const { avisar } = useAviso();
  const [estado, setEstado] = useState<{ receber: boolean; disponivel: boolean; temTelefone: boolean } | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!whatsappHabilitado) return;
    let vivo = true;
    obterAvisosWhatsAppAluno().then(
      (res) => {
        if (vivo) setEstado(res);
      },
      () => {
        if (vivo) setEstado(null);
      },
    );
    return () => {
      vivo = false;
    };
  }, [whatsappHabilitado]);

  if (!whatsappHabilitado || !estado || !estado.disponivel) return null;

  const mudar = async (receber: boolean) => {
    if (salvando) return;
    setSalvando(true);
    try {
      const atualizado = await atualizarAvisosWhatsAppAluno(receber);
      setEstado(atualizado);
      avisar(
        atualizado.receber
          ? 'Avisos pelo WhatsApp ativados.'
          : 'Avisos pelo WhatsApp desativados.',
        'sucesso',
      );
    } catch (e: unknown) {
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Cartao titulo="Avisos pelo WhatsApp">
      {estado.temTelefone ? (
        <Interruptor
          rotulo="Receber avisos pelo WhatsApp"
          ajuda="Lembretes de cobrança e avisos de compromisso enviados pelo WhatsApp da consultoria."
          valor={estado.receber}
          aoMudar={(receber) => void mudar(receber)}
        />
      ) : (
        <Texto variante="suave">
          Cadastre seu telefone em Meus dados para ativar os avisos pelo WhatsApp.
        </Texto>
      )}
    </Cartao>
  );
}
