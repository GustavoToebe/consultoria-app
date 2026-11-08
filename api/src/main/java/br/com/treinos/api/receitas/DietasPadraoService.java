package br.com.treinos.api.receitas;

import br.com.treinos.api.biblioteca.Alimento;
import br.com.treinos.api.biblioteca.AlimentoRepository;
import br.com.treinos.api.biblioteca.CatalogoAlimento;
import br.com.treinos.api.biblioteca.CatalogoAlimentoRepository;
import br.com.treinos.api.biblioteca.Exercicio;
import br.com.treinos.api.biblioteca.GrupoDoAlimento;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.web.Buscas;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Grava as dietas padrão na consultoria do {@code TenantContext}, depois dos suplementos.
 * Antes de resolver o {@code alimentoId}, copia do catálogo o que ainda falta (nome sem acento).
 * Copia kcal, macros, base e os fatores já gravados no catálogo; não estima. O item da receita leva a conta
 * proporcional desses números. Alimento que o treinador já tem (mesmo inativo) não é alterado nem recriado.
 * A segunda chamada não duplica receita nem alimento.
 */
@Service
public class DietasPadraoService {

    private final AlimentoRepository alimentos;
    private final CatalogoAlimentoRepository catalogo;
    private final ReceitaRepository receitas;
    private final JsonMapper json;

    public DietasPadraoService(AlimentoRepository alimentos, CatalogoAlimentoRepository catalogo,
                               ReceitaRepository receitas, JsonMapper json) {
        this.alimentos = alimentos;
        this.catalogo = catalogo;
        this.receitas = receitas;
        this.json = json;
    }

    @Transactional
    public void garantir() {
        Map<String, DietasPadrao.Nutrientes> nutrientes = nutrientesDaBiblioteca();
        for (String busca : DietasPadrao.buscasParaResolver()) {
            if (nutrientes.containsKey(busca)) {
                continue;
            }
            List<CatalogoAlimento> achados = catalogo.findByNomeBusca(busca);
            if (achados.size() != 1) {
                continue;
            }
            Alimento novo = alimentos.save(copiar(achados.get(0)));
            nutrientes.put(busca, nutrientesDe(novo));
        }
        Set<String> existentes = new HashSet<>();
        int ordem = 0;
        for (Receita receita : receitas.findAll()) {
            existentes.add(receita.getTipo() + "/" + receita.getNome());
            if (receita.getOrdem() > ordem) {
                ordem = receita.getOrdem();
            }
        }
        for (DietasPadrao.Modelo modelo : DietasPadrao.modelos()) {
            if (!existentes.add(Receita.Tipo.PLANO_DIETA + "/" + modelo.nome())) {
                continue;
            }
            ConteudoDieta conteudo = DietasPadrao.comAlimentoIds(modelo.conteudo(), nutrientes);
            receitas.save(new Receita(Receita.Tipo.PLANO_DIETA, modelo.nome(), modelo.descricao(),
                    json.writeValueAsString(conteudo), ++ordem));
        }
    }

    /** Ativo ganha de inativo quando os dois têm o mesmo nome sem acento. */
    private Map<String, DietasPadrao.Nutrientes> nutrientesDaBiblioteca() {
        Map<String, DietasPadrao.Nutrientes> nutrientes = new HashMap<>();
        Map<String, Boolean> ativo = new HashMap<>();
        for (Alimento alimento : alimentos.findAll()) {
            String busca = Buscas.semAcento(alimento.getNome());
            Boolean jaAtivo = ativo.get(busca);
            if (jaAtivo == null || (!jaAtivo && alimento.isAtivo())) {
                nutrientes.put(busca, nutrientesDe(alimento));
                ativo.put(busca, alimento.isAtivo());
            }
        }
        return nutrientes;
    }

    private static DietasPadrao.Nutrientes nutrientesDe(Alimento alimento) {
        return new DietasPadrao.Nutrientes(alimento.getId(), alimento.getBaseQuantidade(), alimento.getBaseUnidade(),
                alimento.getKcal(), alimento.getProteina(), alimento.getCarboidrato(), alimento.getGordura(),
                alimento.getGramasPorUnidade());
    }

    /** Sem {@code FatoresDeRendimento.completar}: o que o catálogo não tem continua nulo. */
    private static Alimento copiar(CatalogoAlimento c) {
        return new Alimento(Alimento.Valores.deAlimento(c.getNome(), c.getBaseQuantidade(), c.getBaseUnidade(),
                c.getKcal(), c.getProteina(), c.getCarboidrato(), c.getGordura(), c.getGramasPorUnidade(),
                c.getFonte(), c.getFatorCorrecao(), c.getFatorCoccao(), GrupoDoAlimento.doCatalogo(c.getGrupo())),
                Exercicio.Origem.CATALOGO);
    }
}
