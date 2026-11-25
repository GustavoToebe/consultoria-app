import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { TipoDoItem } from '../../api/vitrineTipos';
import { criarCategoriaDaVitrine, type CategoriaDaVitrine } from '../../api/vitrineCategorias';
import { categoriaDeMesmoNome, erroDoNomeDaCategoria, NOME_DA_CATEGORIA_MAXIMO, SEM_CATEGORIA, sugestoesDeCategoria } from '../../dominio/vitrineCategorias';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { MensagemDeErro } from '../../ui/Campo';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, errosPorCampo, textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';

/** Valor da opção "Criar categoria “…”" da busca: não é id de categoria (ids são UUID). */
const NOVA = 'nova:';

/**
 * Campo "Categoria" do item: escolha única com busca, "Sem categoria" e "Criar categoria “texto”" ali mesmo (cria pela API
 * e já escolhe). Sem nenhuma categoria ainda, sugestões pelo tipo do item; tocar numa sugestão também cria. Nada nasce
 * sozinho. Os erros da API (422 e 409 no nome) aparecem sob o campo; o limite de 30, como aviso logo abaixo.
 */
export function CampoCategoria({ valor, nomeAtual, tipo, categorias, aoMudar, aoCriar, erro }: {
  valor: string | null;
  /** Nome da categoria do item, para mostrar antes de a lista chegar (ou se ela falhou). */
  nomeAtual: string | null;
  tipo: TipoDoItem;
  /** `undefined` enquanto carrega ou se falhou: sem sugestões (não dá para dizer que não há categoria). */
  categorias: readonly CategoriaDaVitrine[] | undefined;
  aoMudar: (id: string | null) => void;
  aoCriar: (categoria: CategoriaDaVitrine) => void;
  erro?: string | null;
}) {
  const [criando, setCriando] = useState<string | null>(null);
  const [erroDoNome, setErroDoNome] = useState<string | null>(null);
  const [limite, setLimite] = useState<unknown>(null);
  const lista = categorias ?? (valor && nomeAtual ? [{ id: valor, nome: nomeAtual, ordem: 0, quantidade: 0 }] : []);

  const criar = async (nome: string) => {
    if (criando) return;
    const limpo = nome.trim();
    const existente = categoriaDeMesmoNome(lista, limpo);
    if (existente) { aoMudar(existente.id); return; }
    const problema = erroDoNomeDaCategoria(limpo, lista);
    if (problema) { setErroDoNome(problema); return; }
    setCriando(limpo);
    setErroDoNome(null);
    setLimite(null);
    try {
      const nova = await criarCategoriaDaVitrine(limpo);
      aoCriar(nova);
      aoMudar(nova.id);
    } catch (e) {
      // O limite não é do nome: vira aviso junto do campo (o aviso do rodapé ficaria por baixo da folha).
      if (codigoApi(e) === 'VITRINE_CATEGORIAS_LIMITE') setLimite(e);
      else setErroDoNome(errosPorCampo(e).nome ?? textoDoErro(e));
    } finally {
      setCriando(null);
    }
  };

  const sugestoes = categorias ? sugestoesDeCategoria(tipo, categorias.length) : [];
  const mensagem = erroDoNome ?? erro ?? null;
  return (
    <View style={estilos.campo}>
      <EscolhaSuspensa<string | null> rotulo="Categoria" titulo="Categoria do item" valor={valor}
        rotuloDaBusca="Buscar ou criar categoria" textoVazio="Nenhuma categoria encontrada."
        opcoes={[{ valor: null, rotulo: SEM_CATEGORIA }, ...lista.map((c) => ({ valor: c.id, rotulo: c.nome }))]}
        digitado={{
          maxLength: NOME_DA_CATEGORIA_MAXIMO,
          opcao: (t) => {
            const limpo = t.trim();
            if (!limpo) return null;
            const existente = categoriaDeMesmoNome(lista, limpo);
            return existente ? { valor: existente.id, rotulo: existente.nome } : { valor: `${NOVA}${limpo}`, rotulo: `Criar categoria “${limpo}”`, detalhe: 'Categoria nova' };
          },
        }}
        aoMudar={(v) => {
          setErroDoNome(null);
          if (v?.startsWith(NOVA)) void criar(v.slice(NOVA.length));
          else aoMudar(v);
        }} />
      {criando ? <Texto variante="pequeno" accessibilityLiveRegion="polite">Criando a categoria…</Texto> : null}
      {mensagem ? <MensagemDeErro erro={mensagem} /> : null}
      {limite ? <MensagemErro texto={textoDoErro(limite)} erro={limite} /> : null}
      {sugestoes.length ? (
        <View style={estilos.sugestoes}>
          <Texto variante="pequeno">Nenhuma categoria ainda. Crie com um toque:</Texto>
          <View style={estilos.linha}>
            {sugestoes.map((s) => (
              <Botao key={s} rotulo={s} rotuloAcessivel={`Criar categoria ${s}`} tipo="secundario" Icone={Plus}
                carregando={criando === s} desabilitado={!!criando && criando !== s} aoTocar={() => void criar(s)} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: espaco(0.5) },
  sugestoes: { gap: espaco(0.5), paddingTop: espaco(0.5) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
