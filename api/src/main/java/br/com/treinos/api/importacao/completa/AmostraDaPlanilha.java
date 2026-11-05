package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.AlunoExistente;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.AlunoNovo;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Dono;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Montagem;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.PesoNovo;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.PlanosDoAluno;
import br.com.treinos.api.treino.ConteudoTreino;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Migração assistida, fase 2: a amostra revisável. Regra pura sobre a {@link Montagem} (a mesma da prévia e da confirmação):
 * mostra ao próprio treinador, para alguns alunos, <b>exatamente o que a confirmação vai gravar</b>, como rascunho. Como parte
 * da montagem, o que o perfil não pode gravar (pesos e objetivo sem dado sensível, dieta, ergogênicos) já está de fora.
 *
 * <p>Diferente do diagnóstico da fase 1 (que nunca devolve conteúdo), a amostra é o conteúdo do arquivo devolvido a quem o
 * enviou, como a amostra do assistente de uma aba e o nome do aluno da análise: só na resposta, nunca guardada, nunca em
 * log nem em auditoria (os records escondem o conteúdo no {@code toString}).
 */
public final class AmostraDaPlanilha {

    /** Quantos alunos vêm por chamada. */
    public static final int ALUNOS_POR_AMOSTRA = 5;
    /** Quantos pesos de cada aluno vêm na lista (o total vai em {@code pesos}). */
    static final int PESOS_MOSTRADOS = 10;

    private AmostraDaPlanilha() {
    }

    /**
     * {@code hash} = o da prévia (arquivo + respostas): a confirmação o aceita, então o revisado é o que será gravado.
     * {@code total} = alunos da planilha com cadastro novo, plano ou só pesos; {@code inicio} = posição (de 0) do primeiro da amostra.
     * {@code pasta} = o título da pasta de rascunho que cada aluno recebe, também o que já existe na consultoria.
     */
    public record Amostra(String hash, int total, int inicio, String pasta, List<AlunoDaAmostra> alunos) {
        @Override
        public String toString() {
            return "Amostra"; // o conteúdo é do aluno
        }
    }

    /**
     * {@code numero} = posição na planilha (de 1). {@code situacao}: {@code NOVO} (entra com o cadastro) ou {@code EXISTENTE}
     * (já é aluno da consultoria; só ganha a pasta). Cadastro, {@code pesos}, {@code treino} e {@code dieta} só vêm preenchidos
     * quando a confirmação vai gravá-los; {@code treino} e {@code dieta} são os mesmos conteúdos de plano do resto da API, em
     * rascunho (o exercício a criar na biblioteca ainda não tem {@code exercicioId}).
     */
    public record AlunoDaAmostra(int numero, String situacao, String nome, Boolean ativo, String email, String telefone,
                                 String objetivo, String observacoes, int pesos, List<Peso> ultimosPesos,
                                 ConteudoTreino treino, ConteudoDieta dieta) {
        @Override
        public String toString() {
            return "AlunoDaAmostra[numero=" + numero + "]"; // nunca nome, contatos, peso nem plano
        }
    }

    public record Peso(LocalDate data, BigDecimal kg) {
        @Override
        public String toString() {
            return "Peso"; // peso é dado sensível
        }
    }

    /**
     * {@code existentes} = os alunos que a consultoria já tem (o mesmo contexto da montagem): o nome do aluno que só recebe
     * pesos vem do cadastro dele, não do texto da planilha.
     */
    public static Amostra de(Montagem m, String hash, int inicio, List<AlunoExistente> existentes) {
        Map<Dono, AlunoNovo> novos = new HashMap<>();
        Map<Dono, PlanosDoAluno> planos = new HashMap<>();
        Map<Dono, List<PesoNovo>> pesos = new HashMap<>();
        Map<UUID, String> nomesDoCadastro = new HashMap<>();
        existentes.forEach(e -> nomesDoCadastro.put(e.id(), e.nome()));
        m.alunosNovos().forEach(a -> novos.put(a.dono(), a));
        m.planos().forEach(p -> planos.put(p.dono(), p));
        m.pesos().forEach(p -> pesos.computeIfAbsent(p.dono(), k -> new ArrayList<>()).add(p));

        List<Dono> ordem = ordemDosDonos(m);
        int de = Math.min(Math.max(0, inicio), ordem.size());
        int ate = Math.min(ordem.size(), de + ALUNOS_POR_AMOSTRA);
        List<AlunoDaAmostra> alunos = new ArrayList<>();
        for (int i = de; i < ate; i++) {
            Dono dono = ordem.get(i);
            AlunoNovo novo = novos.get(dono);
            PlanosDoAluno plano = planos.get(dono);
            List<PesoNovo> dele = pesos.getOrDefault(dono, List.of()).stream()
                    .sorted(java.util.Comparator.comparing(PesoNovo::data)).toList();
            List<Peso> ultimos = dele.subList(Math.max(0, dele.size() - PESOS_MOSTRADOS), dele.size()).stream()
                    .map(p -> new Peso(p.data(), p.kg())).toList();
            alunos.add(novo != null
                    ? new AlunoDaAmostra(i + 1, "NOVO", novo.nome(), novo.ativo(), novo.email(), novo.telefone(),
                            novo.objetivo(), novo.observacoes(), dele.size(), ultimos, plano == null ? null : plano.treino(),
                            plano == null ? null : plano.dieta())
                    // Aluno que já existe: sempre o nome oficial do cadastro (com plano ou só com pesos); o texto da
                    // planilha só entra se, por algum motivo, o cadastro não estiver na lista.
                    : new AlunoDaAmostra(i + 1, "EXISTENTE",
                            nomesDoCadastro.getOrDefault(dono.existente(), plano != null ? plano.nome() : null), null, null,
                            null, null, null, dele.size(), ultimos, plano == null ? null : plano.treino(),
                            plano == null ? null : plano.dieta()));
        }
        return new Amostra(hash, ordem.size(), de, MontagemDaImportacao.TITULO_PASTA, List.copyOf(alunos));
    }

    /**
     * A ordem dos alunos da planilha, a mesma da amostra (o {@code numero} de cada um é a posição + 1) e da lista de
     * ignorados da confirmação: cadastros novos, depois quem tem plano, depois o aluno que já existe e só recebe pesos.
     */
    static List<Dono> ordemDosDonos(Montagem m) {
        Set<Dono> donos = new LinkedHashSet<>();
        m.alunosNovos().forEach(a -> donos.add(a.dono()));
        m.planos().forEach(p -> donos.add(p.dono()));
        m.pesos().forEach(p -> donos.add(p.dono())); // já está na lista se tem cadastro novo ou plano
        return List.copyOf(donos);
    }
}
