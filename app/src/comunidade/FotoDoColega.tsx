import { baixarFotoDoColega } from '../api/comunidade';
import type { MolduraDoPerfil } from '../dominio/perfilDaComunidade';
import { criarFotosEmMemoria } from '../dominio/fotosEmMemoria';
import { FotoDePerfil, IniciaisDePerfil } from '../ui/FotoDePerfil';
import { MolduraDaFoto } from './MolduraDaFoto';

/** A linha da lista e a folha do perfil mostram a mesma foto: um pedido só dentro de 1 minuto (só memória). */
const fotoDoColega = criarFotosEmMemoria(baixarFotoDoColega, 60_000);

/**
 * Foto de um colega na moldura dele (perfil) ou na padrão (lista). Só busca com `temFoto` (a API disse que há e que pode
 * mostrar); 404, 429 ou falha viram as iniciais sem erro na tela (`ui/FotoDePerfil`). A imagem vem pela API com o token, nunca
 * por link do bucket, e não fica no aparelho (em memória só por 1 minuto, para a lista e a folha não pedirem duas vezes).
 */
export function FotoDoColega({ autorId, nome, temFoto, tamanho, cor, moldura }: {
  autorId: string; nome: string; temFoto: boolean; tamanho: number; cor: string; moldura: MolduraDoPerfil;
}) {
  return (
    <MolduraDaFoto moldura={moldura} cor={cor} tamanho={tamanho}>
      {temFoto
        ? <FotoDePerfil chave={`colega:${autorId}`} carregar={() => fotoDoColega(autorId)} nome={nome} tamanho={tamanho} />
        : <IniciaisDePerfil nome={nome} tamanho={tamanho} />}
    </MolduraDaFoto>
  );
}
