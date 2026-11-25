import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { TipoDoItem } from '../../api/vitrineTipos';
import { criarCategoriaDaVitrine, type CategoriaDaVitrine } from '../../api/vitrineCategorias';
import { categoriaDoDigitado } from '../../dominio/seletorDeCategoria';
import { erroDoNomeDaCategoria, NOME_DA_CATEGORIA_MAXIMO, sugestoesDeCategoria } from '../../dominio/vitrineCategorias';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, errosPorCampo, textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { SeletorDeCategoria } from '../SeletorDeCategoria';

/**
 * Campo "Categoria" do item: o `SeletorDeCategoria` (busca, "Sem categoria" e "Criar categoria “texto”") com a persistência
 * da Vitrine: criar vai à API e já escolhe. Sem nenhuma categoria ainda, sugestões pelo tipo do item; tocar numa sugestão
 * também cria. Nada nasce sozinho. Os erros da API (422 e 409 no nome) aparecem sob o campo; o limite de 30, como aviso
 * logo abaixo.
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
    const d = categoriaDoDigitado(nome, lista);
    if (!d) return;
    if ('existente' in d) { aoMudar(d.existente.id); return; }
    const limpo = d.nova;
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
    <SeletorDeCategoria<string | null> valor={valor} semCategoria={null} maximo={NOME_DA_CATEGORIA_MAXIMO}
      categorias={lista.map((c) => ({ valor: c.id, nome: c.nome }))} criando={!!criando} erro={mensagem}
      aoEscolher={(id) => { setErroDoNome(null); aoMudar(id); }}
      aoCriar={(nome) => { setErroDoNome(null); void criar(nome); }}>
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
    </SeletorDeCategoria>
  );
}

const estilos = StyleSheet.create({
  sugestoes: { gap: espaco(0.5), paddingTop: espaco(0.5) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
