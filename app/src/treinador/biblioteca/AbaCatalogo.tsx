import { Check, Download } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { catalogoAlimentos, catalogoExercicios, gruposDoCatalogo, importarDoCatalogo, type TipoBiblioteca } from '../../api/rotas';
import { CREDITOS_CATALOGO, passosDasInstrucoes, resumoNutrientes, textoMostrando } from '../../dominio/catalogo';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { MODALIDADES } from '../treino/FolhaBiblioteca';

interface ItemCatalogo {
  id: string;
  nome: string;
  detalhe: string;
  /** Passos de execução (só exercícios; a fonte já vem em português). */
  passos: string[];
}

interface ListaCatalogo {
  itens: ItemCatalogo[];
  total: number;
}

/** Catálogo público (só leitura): marcar vários e importar para a biblioteca da consultoria. */
export function AbaCatalogo() {
  const { cores, marca } = useTema();
  const { avisar } = useAviso();
  const [tipo, setTipo] = useState<TipoBiblioteca>('exercicios');
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState(false);
  const termo = useAtrasado(busca.trim(), 300);
  const grupos = useCarregar(`catalogo-grupos:${tipo}`, () => gruposDoCatalogo(tipo));
  const { dados, erro, carregando, recarregar } = useCarregar(
    `catalogo:${tipo}:${grupo}:${termo}`,
    async (): Promise<ListaCatalogo> => {
      if (tipo === 'exercicios') {
        const r = await catalogoExercicios(termo, grupo || undefined);
        return {
          total: r.total,
          itens: r.itens.map((e) => ({
            id: e.id,
            nome: e.nome,
            detalhe: [MODALIDADES[e.modalidade] ?? e.modalidade, e.grupoMuscular, e.equipamento].filter(Boolean).join(' · '),
            passos: passosDasInstrucoes(e.instrucoes),
          })),
        };
      }
      const r = await catalogoAlimentos(termo, grupo || undefined);
      return {
        total: r.total,
        itens: r.itens.map((a) => ({
          id: a.id,
          nome: a.nome,
          detalhe: [a.grupo, resumoNutrientes(a)].filter(Boolean).join(' · '),
          passos: [],
        })),
      };
    },
  );

  const alternar = (id: string) =>
    setMarcados((m) => {
      const novo = new Set(m);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const importar = () => {
    setImportando(true);
    importarDoCatalogo(tipo, [...marcados]).then(
      (r) => {
        setImportando(false);
        setMarcados(new Set());
        avisar(`${r.importados} importado(s)${r.ignorados ? `, ${r.ignorados} já estava(m) na biblioteca` : ''}.`, 'sucesso');
      },
      (e: unknown) => {
        setImportando(false);
        avisar(textoDoErro(e), 'perigo');
      },
    );
  };

  return (
    <View style={estilos.aba}>
      <Escolha
        descricao="Catálogo"
        opcoes={[
          { valor: 'exercicios', rotulo: 'Exercícios' },
          { valor: 'alimentos', rotulo: 'Alimentos' },
        ]}
        valor={tipo}
        aoMudar={(t) => {
          setTipo(t);
          setGrupo('');
          setAberto(null);
          setMarcados(new Set());
        }}
      />
      {grupos.dados?.length ? (
        <Escolha
          descricao="Grupo"
          opcoes={[{ valor: '', rotulo: 'Todos' }, ...grupos.dados.map((g) => ({ valor: g, rotulo: g }))]}
          valor={grupo}
          aoMudar={setGrupo}
        />
      ) : null}
      <View style={estilos.topo}>
        <View style={estilos.busca}>
          <Campo rotulo="Buscar no catálogo" valor={busca} aoMudar={setBusca} />
        </View>
        <Botao
          rotulo={`Importar selecionados (${marcados.size})`}
          Icone={Download}
          carregando={importando}
          desabilitado={marcados.size === 0}
          aoTocar={importar}
        />
      </View>
      <Texto variante="pequeno">Os que já estão na sua biblioteca (mesmo nome) são ignorados.</Texto>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && dados.itens.length === 0 ? <Vazio titulo="Nenhum resultado no catálogo" texto="Tente outro nome ou ajuste o filtro de grupo." /> : null}
      {dados?.itens.map((item) => {
        const sel = marcados.has(item.id);
        const expandido = aberto === item.id;
        return (
          <View key={item.id} style={[estilos.item, { borderColor: sel ? cores.texto : cores.borda, backgroundColor: cores.superficie }]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: sel }}
              accessibilityLabel={item.nome}
              onPress={() => alternar(item.id)}
              style={estilos.linha}>
              <View style={[estilos.caixa, { borderColor: sel ? cores.texto : cores.borda, backgroundColor: sel ? cores.texto : 'transparent' }]}>
                {sel ? <Check size={16} color={cores.fundo} strokeWidth={3} /> : null}
              </View>
              <View style={estilos.dados}>
                <Texto>{item.nome}</Texto>
                <Texto variante="pequeno">{item.detalhe}</Texto>
              </View>
            </Pressable>
            {item.passos.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: expandido }}
                accessibilityLabel={`${expandido ? 'Esconder' : 'Ver'} instruções de ${item.nome}`}
                onPress={() => setAberto(expandido ? null : item.id)}
                style={estilos.verInstrucoes}>
                <Texto variante="pequeno" cor={marca}>{expandido ? 'Esconder instruções' : 'Ver instruções'}</Texto>
              </Pressable>
            ) : null}
            {expandido ? (
              <View style={estilos.passos}>
                {item.passos.map((p, i) => (
                  <Texto key={i} variante="pequeno">{`${i + 1}. ${p}`}</Texto>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
      {dados && textoMostrando(dados.itens.length, dados.total) ? (
        <Texto variante="pequeno" accessibilityLiveRegion="polite">{textoMostrando(dados.itens.length, dados.total)}</Texto>
      ) : null}
      <View style={estilos.creditos}>
        <Texto variante="pequeno">{tipo === 'alimentos' ? CREDITOS_CATALOGO.alimentos : CREDITOS_CATALOGO.exercicios}</Texto>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  aba: { gap: espaco(1) },
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: espaco(1.5) },
  busca: { flex: 1, minWidth: 220, maxWidth: 480 },
  item: { borderWidth: 1, borderRadius: RAIO },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), padding: espaco(1.25) },
  verInstrucoes: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(1.25) },
  passos: { gap: espaco(0.5), paddingHorizontal: espaco(1.25), paddingBottom: espaco(1.25) },
  creditos: { marginTop: espaco(2) },
  caixa: { width: 22, height: 22, borderWidth: 2, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  dados: { flex: 1, gap: 2 },
});
