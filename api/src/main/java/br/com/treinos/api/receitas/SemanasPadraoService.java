package br.com.treinos.api.receitas;

import br.com.treinos.api.biblioteca.Exercicio;
import br.com.treinos.api.biblioteca.ExercicioRepository;
import br.com.treinos.api.receitas.SemanasPadrao.ExercicioDaBiblioteca;
import br.com.treinos.api.receitas.SemanasPadrao.Modelo;
import br.com.treinos.api.web.Buscas;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Grava Semanas, Dias e mobilidades na consultoria do {@code TenantContext}. Nome que já existe não é recriado
 * nem alterado. Sem coleção. O exercício casa pelo nome sem acento; sem par, o id continua nulo.
 */
@Service
public class SemanasPadraoService {

    private final ExercicioRepository exercicios;
    private final ReceitaRepository receitas;
    private final JsonMapper json;

    public SemanasPadraoService(ExercicioRepository exercicios, ReceitaRepository receitas, JsonMapper json) {
        this.exercicios = exercicios;
        this.receitas = receitas;
        this.json = json;
    }

    @Transactional
    public void garantir() {
        Map<String, ExercicioDaBiblioteca> biblioteca = biblioteca();
        Set<String> existentes = new HashSet<>();
        int ordem = 0;
        for (Receita receita : receitas.findAll()) {
            existentes.add(receita.getTipo() + "/" + receita.getNome());
            if (receita.getOrdem() > ordem) {
                ordem = receita.getOrdem();
            }
        }
        for (Modelo modelo : SemanasPadrao.todos()) {
            if (!existentes.add(modelo.tipo() + "/" + modelo.nome())) {
                continue;
            }
            Modelo resolvido = SemanasPadrao.comExercicios(modelo, biblioteca);
            receitas.save(new Receita(resolvido.tipo(), resolvido.nome(), resolvido.descricao(),
                    json.writeValueAsString(resolvido.conteudo()), ++ordem));
        }
    }

    /** Ativo ganha de inativo quando os dois têm o mesmo nome sem acento. */
    private Map<String, ExercicioDaBiblioteca> biblioteca() {
        Map<String, ExercicioDaBiblioteca> porBusca = new HashMap<>();
        Map<String, Boolean> ativo = new HashMap<>();
        for (Exercicio exercicio : exercicios.findAll()) {
            String busca = Buscas.semAcento(exercicio.getNome());
            Boolean jaAtivo = ativo.get(busca);
            if (jaAtivo == null || (!jaAtivo && exercicio.isAtivo())) {
                porBusca.put(busca, new ExercicioDaBiblioteca(exercicio.getId(), exercicio.getNome(),
                        exercicio.getModalidade().name()));
                ativo.put(busca, exercicio.isAtivo());
            }
        }
        return porBusca;
    }
}
