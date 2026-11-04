import { ScrollView, StyleSheet } from 'react-native';

import { DEFINICOES_DE_BLOCO, type Bloco, type CampoDoBloco } from '../dominio/montador';
import { espaco } from '../tema/tokens';
import { Campo } from '../ui/Campo';
import { CampoNumerico, Interruptor } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { Escolha } from '../ui/Escolha';
import { EscolhaEmFolha } from '../ui/EscolhaEmFolha';
import { Texto } from '../ui/Texto';

interface Props {
  bloco: Bloco | null;
  nomeRascunho: string;
  observacoesRascunho: string;
  aoMudarNome: (nome: string) => void;
  aoMudarObservacoes: (observacoes: string) => void;
  aoAlterarProp: (id: string, chave: string, valor: unknown) => void;
}

export function Propriedades({
  bloco,
  nomeRascunho,
  observacoesRascunho,
  aoMudarNome,
  aoMudarObservacoes,
  aoAlterarProp,
}: Props) {
  const def = bloco ? DEFINICOES_DE_BLOCO[bloco.tipo] : null;

  return (
    <ScrollView style={estilos.painel} contentContainerStyle={estilos.conteudo}>
      {bloco && def ? (
        <Cartao titulo={`Bloco: ${def.rotulo}`} descricao={`Tipo: ${def.tipo}`}>
          {def.campos.length === 0 ? (
            <Texto variante="suave">Este bloco é apenas um contêiner e não possui propriedades editáveis.</Texto>
          ) : (
            def.campos.map((campo) => (
              <ControleDeCampo
                key={`${bloco.id}:${campo.chave}`}
                campo={campo}
                valor={bloco.props[campo.chave]}
                aoMudar={(novoValor) => aoAlterarProp(bloco.id, campo.chave, novoValor)}
              />
            ))
          )}
        </Cartao>
      ) : (
        <Cartao titulo="Nenhum bloco selecionado">
          <Texto variante="suave">
            Clique em um bloco na prancheta para editar seus textos, variantes e opções.
          </Texto>
        </Cartao>
      )}

      <Cartao titulo="Dados do rascunho">
        <Campo
          rotulo="Nome do rascunho"
          valor={nomeRascunho}
          aoMudar={aoMudarNome}
          maxLength={200}
        />
        <Campo
          rotulo="Observações para o Claude (opcional)"
          valor={observacoesRascunho}
          aoMudar={aoMudarObservacoes}
          linhas={3}
          maxLength={2000}
          ajuda="Explique o comportamento esperado, de onde vêm os dados ou o que muda no toque."
        />
      </Cartao>
    </ScrollView>
  );
}

function ControleDeCampo({
  campo,
  valor,
  aoMudar,
}: {
  campo: CampoDoBloco;
  valor: unknown;
  aoMudar: (valor: unknown) => void;
}) {
  switch (campo.tipo) {
    case 'texto':
      return (
        <Campo
          rotulo={campo.rotulo}
          valor={String(valor ?? '')}
          aoMudar={aoMudar}
          ajuda={campo.ajuda}
          maxLength={2000}
        />
      );
    case 'multilinhas':
      return (
        <Campo
          rotulo={campo.rotulo}
          valor={String(valor ?? '')}
          aoMudar={aoMudar}
          ajuda={campo.ajuda}
          linhas={campo.linhas ?? 3}
          maxLength={2000}
        />
      );
    case 'booleano':
      return (
        <Interruptor
          rotulo={campo.rotulo}
          valor={Boolean(valor)}
          aoMudar={aoMudar}
          ajuda={campo.ajuda}
        />
      );
    case 'numero':
      return (
        <CampoNumerico
          rotulo={campo.rotulo}
          valor={typeof valor === 'number' ? valor : 0}
          inteiro={campo.inteiro}
          ajuda={campo.ajuda}
          aoMudar={(n) => {
            if (n !== null) aoMudar(n);
          }}
        />
      );
    case 'escolha': {
      const atual = String(valor ?? campo.opcoes[0]?.valor ?? '');
      if (campo.opcoes.length > 6) {
        return (
          <EscolhaEmFolha
            rotulo={campo.rotulo}
            valor={atual}
            opcoes={campo.opcoes}
            aoMudar={aoMudar}
          />
        );
      }
      return (
        <Escolha
          rotulo={campo.rotulo}
          descricao={campo.rotulo}
          valor={atual}
          opcoes={[...campo.opcoes]}
          aoMudar={aoMudar}
        />
      );
    }
  }
}

const estilos = StyleSheet.create({
  painel: { flex: 1, minHeight: 0 },
  conteudo: { gap: espaco(2), paddingBottom: espaco(3) },
});
