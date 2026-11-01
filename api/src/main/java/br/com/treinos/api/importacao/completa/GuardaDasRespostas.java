package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.importacao.completa.LigacaoDeAbas.AbaReconhecida;
import br.com.treinos.api.importacao.completa.RespostaSalva.Tipo;
import br.com.treinos.api.importacao.completa.RespostasDaPlanilha.NomeResolvido;
import br.com.treinos.api.importacao.completa.RespostasDaPlanilha.SuplementoClassificado;
import br.com.treinos.api.importacao.completa.RespostasDaPlanilha.TipoDaAba;
import br.com.treinos.api.importacao.completa.RespostasSalvas.NomeSalvo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * As respostas da planilha completa guardadas por consultoria (fase 2, V051): ao confirmar, o tipo de cada aba (pela
 * assinatura dos títulos das colunas), o destino de cada nome de exercício e de alimento e a classificação de cada nome
 * de suplemento ficam guardados; na próxima análise voltam como sugestão já marcada, e o treinador ainda vê e pode trocar
 * (a prévia e a confirmação só usam o que a tela manda). Nunca dado de aluno: a chave da aba é um hash e a dos nomes é o
 * nome comparável de exercício, alimento ou suplemento. O nome de suplemento pode ser de medicação, então só é guardado e
 * só volta a quem pode gravar a dieta ({@code PASTA_ALTERAR} + {@code DIETA_ALTERAR}), como os nomes da análise.
 *
 * <p>Não é dado do aluno: a exportação e a anonimização do aluno não mexem aqui. "Esquecer" apaga todas as da consultoria.
 * Teto de {@value #RESPOSTAS_MAXIMAS} por consultoria: acima dele só as que já existem são trocadas.
 */
@Service
public class GuardaDasRespostas {

    static final int RESPOSTAS_MAXIMAS = 10_000;
    private static final int CHAVE_MAXIMA = 200;

    private final RespostaSalvaRepository repositorio;
    private final Auditoria auditoria;

    public GuardaDasRespostas(RespostaSalvaRepository repositorio, Auditoria auditoria) {
        this.repositorio = repositorio;
        this.auditoria = auditoria;
    }

    /**
     * As respostas guardadas, para a análise. {@code comSuplementos} falso = sem os nomes de suplemento. A resposta
     * "biblioteca" cujo item não está mais entre os ativos ({@code exerciciosAtivos}, {@code alimentosAtivos}) não volta.
     */
    @Transactional(readOnly = true)
    public RespostasSalvas carregar(boolean comSuplementos, Set<UUID> exerciciosAtivos, Set<UUID> alimentosAtivos) {
        List<RespostaSalva> todas = repositorio.findAll();
        Map<String, String> abas = new HashMap<>();
        Map<String, NomeSalvo> exercicios = new HashMap<>();
        Map<String, NomeSalvo> alimentos = new HashMap<>();
        Map<String, String> suplementos = new HashMap<>();
        for (RespostaSalva r : todas) {
            switch (r.getTipo()) {
                case ABA -> abas.put(r.getChave(), r.getResposta());
                case EXERCICIO -> nome(r, exerciciosAtivos).ifPresent(n -> exercicios.put(r.getChave(), n));
                case ALIMENTO -> nome(r, alimentosAtivos).ifPresent(n -> alimentos.put(r.getChave(), n));
                case SUPLEMENTO -> {
                    if (comSuplementos) {
                        suplementos.put(r.getChave(), r.getResposta());
                    }
                }
            }
        }
        return new RespostasSalvas(Map.copyOf(abas), Map.copyOf(exercicios), Map.copyOf(alimentos), Map.copyOf(suplementos),
                todas.size());
    }

    private static java.util.Optional<NomeSalvo> nome(RespostaSalva r, Set<UUID> ativos) {
        boolean biblioteca = "BIBLIOTECA".equals(r.getResposta());
        if (biblioteca && (r.getItemId() == null || !ativos.contains(r.getItemId()))) {
            return java.util.Optional.empty();
        }
        return java.util.Optional.of(new NomeSalvo(r.getResposta(), biblioteca ? r.getItemId() : null));
    }

    /**
     * Guarda o que o treinador respondeu nesta confirmação (na transação dela): a mesma chave respondida de novo troca a
     * resposta. Só o que veio nas respostas; nome sem resposta não apaga a guardada.
     */
    @Transactional
    public void guardar(RespostasDaPlanilha respostas, LeituraDasAbas.Leitura leitura, boolean comSuplementos) {
        Map<String, RespostaSalva> existentes = new HashMap<>();
        for (RespostaSalva r : repositorio.findAll()) {
            existentes.put(r.getTipo() + "|" + r.getChave(), r);
        }
        int[] total = {existentes.size()};
        if (!respostas.abas().isEmpty()) {
            Map<Integer, AbaReconhecida> porIndice = new HashMap<>();
            AnaliseDaPlanilha.reconhecerAbas(leitura, Map.of()).forEach(a -> porIndice.put(a.indice(), a));
            for (TipoDaAba a : respostas.abas()) {
                AbaReconhecida aba = porIndice.get(a.indice());
                String assinatura = aba == null ? null : AnaliseDaPlanilha.assinaturaDosTitulos(leitura, aba);
                if (assinatura != null) {
                    guardar(existentes, total, Tipo.ABA, assinatura, a.tipo(), null);
                }
            }
        }
        for (NomeResolvido n : respostas.exercicios()) {
            guardar(existentes, total, Tipo.EXERCICIO, CasamentoDeNomes.chave(n.nome()), n.acao(),
                    "BIBLIOTECA".equals(n.acao()) ? n.id() : null);
        }
        for (NomeResolvido n : respostas.alimentos()) {
            guardar(existentes, total, Tipo.ALIMENTO, CasamentoDeNomes.chave(n.nome()), n.acao(),
                    "BIBLIOTECA".equals(n.acao()) ? n.id() : null);
        }
        if (comSuplementos) {
            for (SuplementoClassificado s : respostas.suplementos()) {
                guardar(existentes, total, Tipo.SUPLEMENTO, MontagemDaImportacao.nomeDeSuplemento(s.nome()), s.destino(), null);
            }
        }
    }

    private void guardar(Map<String, RespostaSalva> existentes, int[] total, Tipo tipo, String chave, String resposta,
                         UUID item) {
        if (chave == null || chave.isEmpty() || chave.length() > CHAVE_MAXIMA) {
            return;
        }
        RespostaSalva atual = existentes.get(tipo + "|" + chave);
        if (atual != null) {
            atual.responder(resposta, item);
            return;
        }
        if (total[0] >= RESPOSTAS_MAXIMAS) {
            return;
        }
        RespostaSalva nova = repositorio.save(new RespostaSalva(tipo, chave, resposta, item));
        existentes.put(tipo + "|" + chave, nova);
        total[0]++;
    }

    /** Apaga todas as respostas guardadas da consultoria; auditoria com resumo fixo, só se havia alguma. */
    @Transactional
    public int esquecer() {
        List<RespostaSalva> todas = repositorio.findAll();
        if (todas.isEmpty()) {
            return 0;
        }
        repositorio.deleteAllInBatch(todas);
        auditoria.registrarEvento("IMPORTACAO_RESPOSTAS_ESQUECIDAS", "IMPORTACAO", null,
                "Esqueceu as respostas salvas da planilha completa.");
        return todas.size();
    }
}
