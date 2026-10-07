package br.com.treinos.api.execucao;

import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.PlanoTreino;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import br.com.treinos.api.treino.PlanoTreinoVersao;
import br.com.treinos.api.treino.PlanoTreinoVersaoRepository;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Carrega os {@link IndiceVersao} de várias versões de uma vez (já filtradas pela consultoria). Versão que não existe
 * nesta consultoria simplesmente não aparece no mapa. Chamar dentro de uma transação.
 */
@Component
public class IndicesDeVersao {

    private final PlanoTreinoVersaoRepository versoes;
    private final PlanoTreinoRepository planos;
    private final JsonMapper json;

    public IndicesDeVersao(PlanoTreinoVersaoRepository versoes, PlanoTreinoRepository planos, JsonMapper json) {
        this.versoes = versoes;
        this.planos = planos;
        this.json = json;
    }

    public Map<UUID, IndiceVersao> carregar(Collection<UUID> versaoIds) {
        Map<UUID, IndiceVersao> indices = new HashMap<>();
        if (versaoIds.isEmpty()) {
            return indices;
        }
        var lista = versoes.findByIdIn(new HashSet<>(versaoIds));
        Set<UUID> planoIds = lista.stream().map(PlanoTreinoVersao::getPlanoId).collect(Collectors.toSet());
        Map<UUID, UUID> alunoDoPlano = new HashMap<>();
        for (PlanoTreino p : planos.findAllById(planoIds)) {
            alunoDoPlano.put(p.getId(), p.getAlunoId());
        }
        for (PlanoTreinoVersao v : lista) {
            indices.put(v.getId(), new IndiceVersao(alunoDoPlano.get(v.getPlanoId()),
                    json.readValue(v.getConteudo(), ConteudoTreino.class)));
        }
        return indices;
    }
}
