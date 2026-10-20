import { ClipboardList, FileText } from 'lucide-react-native';
import { View } from 'react-native';

import { mostrarCartaoAnamnese } from '../dominio/anamnese';
import { mostrarCartaoAtualizacao } from '../dominio/atualizacao';
import { itemDaAtualizacao } from '../dominio/paraFazer';
import { espaco } from '../tema/tokens';
import { Cartao } from '../ui/Cartao';
import { ItemDeLista } from '../ui/ItemDeLista';
import { LinkTexto } from '../ui/LinkTexto';
import { useAnamnese } from './anamnese/useAnamnese';
import { PermissaoLembrete } from './atualizacao/PermissaoLembrete';
import { useAtualizacao } from './atualizacao/useAtualizacao';

/**
 * "Para fazer" no início do aluno, abaixo do Hoje e da semana: anamnese pendente e atualização, cada uma um item
 * inteiro tocável (`ItemDeLista`). Antes eram dois cartões com botão vermelho "Responder" acima do Hoje, que saía da
 * primeira tela em 390/360 e dividia o primário. Sem nada pendente, o bloco não aparece.
 */
export function ParaFazer() {
  const anamnese = useAnamnese().dados;
  const atualizacao = useAtualizacao().dados;
  const comAnamnese = !!anamnese && mostrarCartaoAnamnese(anamnese);
  const comAtualizacao = !!atualizacao && mostrarCartaoAtualizacao(atualizacao);
  if (!comAnamnese && !comAtualizacao) return null;
  const item = comAtualizacao ? itemDaAtualizacao(atualizacao) : null;
  return (
    <Cartao titulo="Para fazer">
      <View style={{ gap: espaco(1) }}>
        {comAnamnese ? (
          <ItemDeLista
            titulo="Responder a anamnese"
            detalhe="Seu treinador pediu algumas informações. O rascunho fica salvo neste aparelho."
            Icone={ClipboardList}
            selo={{ texto: 'Pendente', tipo: 'atencao' }}
            href="/aluno/anamnese"
          />
        ) : null}
        {item && atualizacao ? (
          <>
            <ItemDeLista titulo={item.titulo} detalhe={item.detalhe} Icone={FileText} selo={item.selo ?? undefined} href="/aluno/atualizacao" />
            {item.responder ? <LinkTexto texto="Vou atrasar" href="/aluno/atualizacao?atraso=sim" /> : null}
            <PermissaoLembrete atualizacao={atualizacao} />
          </>
        ) : null}
      </View>
    </Cartao>
  );
}
