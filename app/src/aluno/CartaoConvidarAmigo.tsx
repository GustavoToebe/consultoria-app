import * as Clipboard from 'expo-clipboard';
import { Copy, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Share } from 'react-native';

import {
  compartilharFoiCancelado, DESCRICAO_DO_CONVITE, podeCompartilhar, PRIVACIDADE_DO_CONVITE, TITULO_DO_CONVITE, type SituacaoDoConvite,
} from '../dominio/convidarAmigo';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { Texto } from '../ui/Texto';
import { BlocoDaConta, SecaoDaConta } from './conta/SecaoDaConta';

const temShareDoNavegador = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * "Convidar um amigo" na Conta do aluno: o link de inscrição com a indicação dele (`GET /aluno/indicacao`, lido pela tela), para
 * copiar ou compartilhar. Só com internet e só quando a consultoria tem link de inscrição aberto (404 = a seção não existe);
 * nada fica no aparelho e o link nunca vai a log nem ao texto do aviso. Desde 23/11 o link não aparece na tela: vai no
 * "Copiar link" e no "Compartilhar"; só se a cópia falhar ele aparece, selecionável, para copiar à mão. Os dois botões são
 * secundários: é um convite opcional, não a tarefa da Conta.
 */
export function CartaoConvidarAmigo({ situacao, link, erro, recarregar }: {
  situacao: SituacaoDoConvite;
  link: string | undefined;
  erro: unknown;
  recarregar: () => void;
}) {
  const { avisar } = useAviso();
  const [aMao, setAMao] = useState(false);
  if (situacao === 'oculto') return null;

  const copiar = (texto: string) => {
    const recusada = () => {
      setAMao(true);
      avisar('Não foi possível copiar. O link apareceu abaixo: selecione e copie à mão.', 'neutro');
    };
    // Na web o `setStringAsync` não rejeita quando o navegador recusa: resolve `false`.
    Clipboard.setStringAsync(texto).then((ok) => (ok === false ? recusada() : avisar('Link copiado.', 'sucesso')), recusada);
  };
  const compartilhar = async (texto: string) => {
    try {
      if (Platform.OS === 'web') await navigator.share({ url: texto });
      else await Share.share({ message: texto });
    } catch (e: unknown) {
      if (!compartilharFoiCancelado(e)) avisar('Não foi possível compartilhar. Use "Copiar link".', 'neutro');
    }
  };
  const pronto = situacao === 'pronto' ? link : undefined;

  return (
    <SecaoDaConta chave="convite" titulo={TITULO_DO_CONVITE}>
      <BlocoDaConta>
        <Texto>{DESCRICAO_DO_CONVITE}</Texto>
        {situacao === 'carregando' ? <Esqueleto cartoes={1} texto="Carregando seu link de convite" /> : null}
        {situacao === 'erro' ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
        {pronto ? (
          <>
            <LinhaDeAcoes>
              <Botao rotulo="Copiar link" rotuloAcessivel="Copiar link de convite" tipo="secundario" Icone={Copy} aoTocar={() => copiar(pronto)} />
              {podeCompartilhar(Platform.OS, temShareDoNavegador()) ? (
                <Botao rotulo="Compartilhar" rotuloAcessivel="Compartilhar link de convite" tipo="secundario" Icone={Share2}
                  aoTocar={() => void compartilhar(pronto)} />
              ) : null}
            </LinhaDeAcoes>
            {aMao ? <Texto variante="suave" selectable>{pronto}</Texto> : null}
            <Texto variante="pequeno">{PRIVACIDADE_DO_CONVITE}</Texto>
          </>
        ) : null}
      </BlocoDaConta>
    </SecaoDaConta>
  );
}
