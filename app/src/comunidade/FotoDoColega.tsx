import { baixarFotoDoColega } from '../api/comunidade';
import type { MolduraDoPerfil } from '../dominio/perfilDaComunidade';
import { FotoDePerfil, IniciaisDePerfil } from '../ui/FotoDePerfil';
import { MolduraDaFoto } from './MolduraDaFoto';

/**
 * Foto de um colega na moldura dele (perfil) ou na padrão (lista). Só busca com `temFoto` (a API disse que há e que pode
 * mostrar); 404, 429 ou falha viram as iniciais sem erro na tela (`ui/FotoDePerfil`). A imagem vem pela API com o token, nunca
 * por link do bucket, e não fica no aparelho.
 */
export function FotoDoColega({ autorId, nome, temFoto, tamanho, cor, moldura }: {
  autorId: string; nome: string; temFoto: boolean; tamanho: number; cor: string; moldura: MolduraDoPerfil;
}) {
  return (
    <MolduraDaFoto moldura={moldura} cor={cor} tamanho={tamanho}>
      {temFoto
        ? <FotoDePerfil chave={`colega:${autorId}`} carregar={() => baixarFotoDoColega(autorId)} nome={nome} tamanho={tamanho} />
        : <IniciaisDePerfil nome={nome} tamanho={tamanho} />}
    </MolduraDaFoto>
  );
}
