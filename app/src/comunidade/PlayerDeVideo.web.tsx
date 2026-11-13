import { useEffect, useRef } from 'react';

import { ATRIBUTOS_DO_PLAYER, urlDoEmbed } from '../dominio/comunidade';

/**
 * Player do YouTube na web (D8): `<iframe>` do `youtube-nocookie` com o `src` montado só do id já validado e os atributos
 * fixos de `ATRIBUTOS_DO_PLAYER` (sem autoplay, câmera nem microfone). A CSP precisa de `frame-src https://www.youtube-nocookie.com`
 * (`deploy-local/Caddyfile`; a de produção é do `central-api-back`). Recebe o foco ao montar: quem tocou em "Assistir aqui"
 * pelo teclado segue direto para o player.
 */
export function PlayerDeVideo({ id, titulo }: { id: string; titulo: string }) {
  const quadro = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    quadro.current?.focus();
  }, []);
  const a = ATRIBUTOS_DO_PLAYER;
  return (
    <iframe
      ref={quadro}
      src={urlDoEmbed(id)}
      title={`Vídeo: ${titulo}`}
      referrerPolicy={a.referrerpolicy}
      allow={a.allow}
      sandbox={a.sandbox}
      loading={a.loading}
      allowFullScreen
      style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
    />
  );
}
