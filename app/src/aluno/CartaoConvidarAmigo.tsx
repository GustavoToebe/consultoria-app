import * as Clipboard from 'expo-clipboard';
import { Copy, Share2 } from 'lucide-react-native';
import { Platform, Share } from 'react-native';

import { linkDeIndicacao } from '../api/rotas';
import {
  compartilharFoiCancelado, DESCRICAO_DO_CONVITE, podeCompartilhar, PRIVACIDADE_DO_CONVITE, situacaoDoConvite, TITULO_DO_CONVITE,
} from '../dominio/convidarAmigo';
import { useAluno } from '../offline/AlunoProvider';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

const temShareDoNavegador = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * "Convidar um amigo" na Conta do aluno: o link de inscrição com a indicação dele, para copiar ou compartilhar
 * (`GET /aluno/indicacao`). Só com internet e só quando a consultoria tem link de inscrição aberto (404 = o cartão não
 * existe); nada fica no aparelho e o link nunca vai a log nem ao texto do aviso. Mostra o link na tela para dar para
 * selecionar e copiar à mão se a área de transferência falhar. Os dois botões são secundários: é um convite opcional,
 * não a tarefa da Conta (cor contida).
 */
export function CartaoConvidarAmigo() {
  const { online } = useAluno();
  const { avisar } = useAviso();
  const carga = useCarregar(online ? 'aluno-indicacao' : null, () => linkDeIndicacao());
  const situacao = situacaoDoConvite(online, carga.dados, carga.erro);
  if (situacao === 'oculto') return null;

  const copiar = (link: string) => {
    Clipboard.setStringAsync(link).then(
      () => avisar('Link copiado.', 'sucesso'),
      () => avisar('Não foi possível copiar. Selecione o link e copie à mão.', 'perigo'),
    );
  };
  const compartilhar = async (link: string) => {
    try {
      if (Platform.OS === 'web') await navigator.share({ url: link });
      else await Share.share({ message: link });
    } catch (erro: unknown) {
      if (!compartilharFoiCancelado(erro)) avisar('Não foi possível compartilhar. Use "Copiar link".', 'neutro');
    }
  };
  const link = situacao === 'pronto' ? carga.dados?.link : undefined;

  return (
    <Cartao titulo={TITULO_DO_CONVITE} descricao={DESCRICAO_DO_CONVITE}>
      {situacao === 'carregando' ? <Esqueleto cartoes={1} texto="Carregando seu link de convite" /> : null}
      {situacao === 'erro' ? <MensagemErro texto={textoDoErro(carga.erro)} erro={carga.erro} tentarDeNovo={carga.recarregar} /> : null}
      {link ? (
        <>
          <Texto variante="suave" selectable numberOfLines={1}>{link}</Texto>
          <Texto variante="pequeno">{PRIVACIDADE_DO_CONVITE}</Texto>
          <LinhaDeAcoes alinhar="fim">
            <Botao rotulo="Copiar link" rotuloAcessivel="Copiar link de convite" tipo="secundario" Icone={Copy}
              aoTocar={() => copiar(link)} />
            {podeCompartilhar(Platform.OS, temShareDoNavegador()) ? (
              <Botao rotulo="Compartilhar" rotuloAcessivel="Compartilhar link de convite" tipo="secundario" Icone={Share2}
                aoTocar={() => void compartilhar(link)} />
            ) : null}
          </LinhaDeAcoes>
        </>
      ) : null}
    </Cartao>
  );
}
