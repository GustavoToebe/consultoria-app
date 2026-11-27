import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Switch } from '../../../components/ui/switch';
import { coresDoDestaque, definir, MODELOS_PDF, PALETA_DE_DESTAQUE, type ConfigPdf, type ModeloPdf, type ValoresPdf } from '../../../dominio/configuracaoPdf';
import { OPCOES_DO_PDF, resumoDoGrupo, type GrupoDoEditor } from '../../../dominio/editorDoPdf';
import { useTema } from '../../../tema/TemaProvider';
import { espaco, RAIO_CONTROLE } from '../../../tema/tokens';
import { CabecalhoDeGrupo } from '../../../ui/CabecalhoDeGrupo';
import { Cartao } from '../../../ui/Cartao';
import { Escolha } from '../../../ui/Escolha';
import { GradeDeOpcoes } from '../../../ui/GradeDeOpcoes';
import { LinhaDeConfiguracao } from '../../../ui/LinhaDeConfiguracao';
import { LinkTexto } from '../../../ui/LinkTexto';
import { OpcaoCartao } from '../../../ui/OpcaoCartao';
import { Texto } from '../../../ui/Texto';

interface Props {
  config: ConfigPdf;
  valores: ValoresPdf;
  /** Cor da marca (`#RRGGBB`), a cor principal dos PDFs: só leitura aqui (D-F8). */
  corDaMarca: string;
  /** Grupo aberto (só um por vez: no 1024 o painel não vira uma lista sem fim) ou `null`. */
  aberto: GrupoDoEditor | null;
  aoAbrir: (grupo: GrupoDoEditor | null) => void;
  aoMudar: (config: ConfigPdf) => void;
  aoTrocarModelo: (modelo: ModeloPdf) => void;
}

const TITULOS: Record<GrupoDoEditor, string> = { modelo: 'Modelo', cores: 'Cores', texto: 'Texto', cabecalho: 'Cabeçalho', tabelas: 'Tabelas' };
const GRUPOS: readonly GrupoDoEditor[] = ['modelo', 'cores', 'texto', 'cabecalho', 'tabelas'];

/**
 * Painel de opções do editor dos PDFs (D-F5, D-F6): "Estilo de todos os documentos", um cartão recolhível por grupo com o
 * valor escolhido no cabeçalho fechado. O `Cartao recolhivel` guarda o aberto por dentro e não deixa a tela fechar os
 * outros; por isso o cabeçalho é a `CabecalhoDeGrupo` controlada (o padrão da Ajuda), e só um grupo fica aberto.
 * Nada aqui grava: cada mudança volta à tela como rascunho.
 */
export function PainelDeOpcoes({ config, valores, corDaMarca, aberto, aoAbrir, aoMudar, aoTrocarModelo }: Props) {
  const grupo = (g: GrupoDoEditor, corpo: ReactNode) => (
    <Cartao key={g} cabecalho={<CabecalhoDeGrupo titulo={TITULOS[g]} resumo={resumoDoGrupo(g, config, valores)} aberto={aberto === g} aoAlternar={() => aoAbrir(aberto === g ? null : g)} acoesJuntas />}>
      {aberto === g ? corpo : null}
    </Cartao>
  );
  const corpos: Record<GrupoDoEditor, ReactNode> = {
    modelo: (
      <GradeDeOpcoes rotulo="Modelo" descricao="Trocar de modelo volta as opções aos valores dele. Dá para desfazer.">
        {MODELOS_PDF.map((m) => <OpcaoCartao key={m.id} titulo={m.nome} descricao={m.descricao} selecionada={config.modelo === m.id} aoEscolher={() => aoTrocarModelo(m.id)} />)}
      </GradeDeOpcoes>
    ),
    cores: <Cores config={config} valores={valores} corDaMarca={corDaMarca} aoMudar={aoMudar} />,
    texto: (
      <Linhas>
        <LinhaDeConfiguracao nome="Fonte" descricao="Só fontes do sistema: no celular a letra pode sair um pouco diferente." forma="grade">
          <Escolha descricao="Fonte" segmentosIguais opcoes={[...OPCOES_DO_PDF.fonte]} valor={valores.texto.fonte} aoMudar={(v) => aoMudar(definir(config, 'texto', 'fonte', v))} />
        </LinhaDeConfiguracao>
        <LinhaDeConfiguracao nome="Tamanho do texto" forma="grade">
          <Escolha descricao="Tamanho do texto" segmentosIguais opcoes={[...OPCOES_DO_PDF.tamanhoDoTexto]} valor={valores.texto.tamanho} aoMudar={(v) => aoMudar(definir(config, 'texto', 'tamanho', v))} />
        </LinhaDeConfiguracao>
      </Linhas>
    ),
    cabecalho: (
      <Linhas>
        <LinhaDeConfiguracao nome="Estilo do cabeçalho" descricao="O topo do documento, com a logo e o nome." forma="grade">
          <Escolha descricao="Estilo do cabeçalho" segmentosIguais opcoes={[...OPCOES_DO_PDF.estiloDoCabecalho]} valor={valores.cabecalho.estilo} aoMudar={(v) => aoMudar(definir(config, 'cabecalho', 'estilo', v))} />
        </LinhaDeConfiguracao>
        <LinhaDeConfiguracao nome="Posição da logo" forma="grade">
          <Escolha descricao="Posição da logo" segmentosIguais opcoes={[...OPCOES_DO_PDF.logo]} valor={valores.cabecalho.logo} aoMudar={(v) => aoMudar(definir(config, 'cabecalho', 'logo', v))} />
        </LinhaDeConfiguracao>
        <LinhaDeConfiguracao nome="Tamanho da logo" forma="grade">
          <Escolha descricao="Tamanho da logo" segmentosIguais opcoes={[...OPCOES_DO_PDF.tamanhoDaLogo]} valor={valores.cabecalho.tamanhoLogo} aoMudar={(v) => aoMudar(definir(config, 'cabecalho', 'tamanhoLogo', v))} />
        </LinhaDeConfiguracao>
        <LinhaDeConfiguracao nome="Nome da consultoria" descricao="Ao lado da logo, no topo." forma="interruptor">
          <Switch checked={valores.cabecalho.mostrarNome} onCheckedChange={(v) => aoMudar(definir(config, 'cabecalho', 'mostrarNome', v))} accessibilityLabel="Nome da consultoria" />
        </LinhaDeConfiguracao>
      </Linhas>
    ),
    tabelas: (
      <Linhas>
        <LinhaDeConfiguracao nome="Estilo das tabelas" forma="grade">
          <Escolha descricao="Estilo das tabelas" segmentosIguais opcoes={[...OPCOES_DO_PDF.estiloDasTabelas]} valor={valores.tabelas.estilo} aoMudar={(v) => aoMudar(definir(config, 'tabelas', 'estilo', v))} />
        </LinhaDeConfiguracao>
        <LinhaDeConfiguracao nome="Densidade" descricao="O espaço entre as linhas das tabelas." forma="grade">
          <Escolha descricao="Densidade" segmentosIguais opcoes={[...OPCOES_DO_PDF.densidade]} valor={valores.tabelas.densidade} aoMudar={(v) => aoMudar(definir(config, 'tabelas', 'densidade', v))} />
        </LinhaDeConfiguracao>
      </Linhas>
    ),
  };
  return (
    <View style={estilos.painel}>
      <View style={estilos.titulo}>
        <Texto variante="bloco" nivel={2}>Estilo de todos os documentos</Texto>
        <Texto variante="suave">Vale para o treino, a dieta e os demais PDFs da consultoria.</Texto>
      </View>
      {GRUPOS.map((g) => grupo(g, corpos[g]))}
    </View>
  );
}

/** Cor principal só leitura (a da marca, D-F8) e a paleta de destaque de 8 cores, com o nome sempre à vista (D23). */
function Cores({ config, valores, corDaMarca, aoMudar }: Pick<Props, 'config' | 'valores' | 'corDaMarca' | 'aoMudar'>) {
  const { cores } = useTema();
  return (
    <Linhas>
      <LinhaDeConfiguracao nome="Cor principal" descricao="A cor da marca da consultoria. Muda na tela da Marca." forma="grade">
        <View style={estilos.principal}>
          <View aria-hidden style={[estilos.amostra, { backgroundColor: corDaMarca, borderColor: cores.divisor }]} />
          <Texto cor={cores.texto} style={estilos.nomeDaCor}>Cor da marca</Texto>
          <LinkTexto href="/treinador/marca" texto="Alterar na Marca" />
        </View>
      </LinhaDeConfiguracao>
      <View style={estilos.paleta}>
        <GradeDeOpcoes rotulo="Cor de destaque" descricao="Faixas, linhas e cabeçalhos das tabelas.">
          {PALETA_DE_DESTAQUE.map((p) => (
            <OpcaoCartao key={p.id} titulo={p.nome} selecionada={valores.cores.destaque === p.id} aoEscolher={() => aoMudar(definir(config, 'cores', 'destaque', p.id))}
              amostra={<View aria-hidden style={[estilos.amostra, { backgroundColor: coresDoDestaque(p.id, corDaMarca).fundo, borderColor: cores.divisor }]} />} />
          ))}
        </GradeDeOpcoes>
      </View>
    </Linhas>
  );
}

/** Linhas de configuração com o fio `divisor` entre elas (o mesmo da `SecaoDeConfiguracao`, sem o cartão dela). */
function Linhas({ children }: { children: ReactNode[] }) {
  const { cores } = useTema();
  return (
    <View style={estilos.linhas}>
      {children.map((linha, i) => (
        <View key={i} style={i < children.length - 1 ? { borderBottomWidth: 1, borderBottomColor: cores.divisor } : null}>{linha}</View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  painel: { gap: espaco(1.5) },
  titulo: { gap: 2, paddingBottom: espaco(0.5) },
  linhas: { marginVertical: -espaco(1) },
  principal: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1.5) },
  nomeDaCor: { flexGrow: 1 },
  // 34 px dentro da caixa de 40 da `OpcaoCartao`: o alvo (a opção inteira) continua com mais de 44.
  amostra: { width: 34, height: 34, borderRadius: RAIO_CONTROLE, borderWidth: 1 },
  paleta: { paddingVertical: espaco(1.5) },
});
