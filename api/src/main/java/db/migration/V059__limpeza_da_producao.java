package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

/**
 * Limpeza da produção (05/11), a pedido do Gustavo, sem zerar o banco (o reset total quebraria a ligação com a Central e
 * apagaria conta, equipe e biblioteca). Duas partes, cada uma amarrada ao id (nunca varre as consultorias):
 * <ol>
 *   <li>apaga inteira a consultoria de teste do Gustavo (id e nome conferidos, ver {@link #apagarConsultoria}), com os
 *       usuários dela e o que eles têm no esquema {@code plataforma};</li>
 *   <li>na consultoria do Saraiva (só por id, antes do primeiro uso dele), apaga o conteúdo (receitas, questionários, alunos e
 *       tudo deles, agenda, interessados, importações e pagamentos do aluno) e mantém a consultoria, a marca, a equipe, os
 *       perfis, a biblioteca, a configuração da inscrição, os direitos e a auditoria ({@link #zerarConteudo}).</li>
 * </ol>
 * As demais consultorias (demonstração, dev, teste) não são tocadas; id ausente no banco = a parte não faz nada.
 * O padrão de fábrica (gatilhos e {@code ReceitasPadrao}) não muda: consultoria nova continua nascendo com ele.
 * <p>
 * Fotos: os objetos do bucket nunca são apagados daqui. Cada foto ainda não removida entra em {@code foto_remocao} (a fila não
 * tem FK para a consultoria, V008, então sobrevive à consultoria apagada) e a {@code FotosManutencao} apaga o objeto
 * {@code consultorias/<consultoriaId>/fotos/<fotoId>.jpg} pelos dois ids da própria linha; o job não consulta a consultoria.
 * Para varrer o prefixo inteiro da consultoria apagada, ver {@code docs/fotos.md}.
 * <p>
 * Roda com o papel do Flyway, fora do {@code TenantContext}: cada DELETE leva {@code consultoria_id} explícito. Fica no pacote
 * {@code db.migration}, fora do {@code ArquiteturaTest}. A lógica é pública e estática para o teste chamá-la com ids próprios.
 */
public class V059__limpeza_da_producao extends BaseJavaMigration {

    /** Consultoria de teste do Gustavo, apagada a pedido dele em 05/11. */
    public static final UUID ID_DA_CONSULTORIA_DE_TESTE = UUID.fromString("134b3333-ba9d-45ee-8651-bcd9a6be2125");
    public static final String NOME_DA_CONSULTORIA_DE_TESTE = "Toebe";
    /** Consultoria do Saraiva, zerada a pedido do Gustavo em 05/11 antes do primeiro uso; só por id, o nome não conta. */
    public static final UUID ID_DA_CONSULTORIA_DO_SARAIVA = UUID.fromString("2acdd04a-9898-4762-889e-eb48ad972b2a");

    private static final Logger log = LoggerFactory.getLogger(V059__limpeza_da_producao.class);

    /** O que a limpeza fez, para o log (sem dado de pessoa). */
    public record Resultado(boolean consultoriaDeTesteApagada, boolean consultoriaZerada) {
    }

    /** Tabelas do aluno e do conteúdo, na ordem das chaves estrangeiras (quase todas sem ação ao apagar). */
    private static final List<String> CONTEUDO = List.of(
            // o que o aluno gerou no dia a dia
            "push_envio", "push_token", "sessao_concluida_visto", "sessao_concluida", "mobilidade_registro", "execucao_serie",
            "agua_do_dia", "registro_peso", "avaliacao_fisica", "ciclo_dia", "ciclo_registro", "lesao_aluno",
            // atualizações e anamneses (as fotos entram na fila antes, em enfileirarFotos)
            "atualizacao_foto", "anamnese_pendencia", "anamnese", "atualizacao", "aluno_foto_perfil",
            // interessados (a configuração do link fica)
            "inscricao_evento", "inscricao_nota", "inscricao_retorno", "inscricao_modelo_mensagem", "inscricao",
            // agenda inteira, inclusive a pessoal da equipe
            "aviso_compromisso", "compromisso_aluno", "compromisso", "evento_agenda_excecao", "evento_agenda", "agenda_pessoal",
            // pagamentos do aluno (o plano comercial, a credencial, a configuração dos lembretes e os lançamentos avulsos
            // são da consultoria, não do aluno: ficam)
            "lembrete_cobranca", "aviso_de_pagamento", "cobranca_aluno", "contratacao_aluno",
            // planos e pastas do aluno
            "plano_treino_versao", "plano_dieta_versao", "plano_mobilidade_versao", "plano_treino", "plano_dieta",
            "plano_mobilidade", "pasta_plano", "importacao_resposta_salva", "importacao",
            // questionários de todas as finalidades e receitas (a receita aponta para a coleção)
            "questionario_imagem", "questionario_versao", "questionario", "receita", "pasta_modelo");

    /** Só a Toebe: o que sobra da consultoria depois do conteúdo, antes das pessoas. */
    private static final List<String> DA_CONSULTORIA = List.of(
            "inscricao_configuracao", "lembrete_configuracao", "credencial_pagamento", "lancamento_financeiro", "plano_comercial",
            "exercicio_imagem", "exercicio", "alimento", "ergogenico", "suplemento",
            "direitos_locais", "conta_comercial_local", "cobranca_local", "aceite_termo", "auditoria", "usuario_convite");

    /** Tabelas do módulo de autenticação (esquema plataforma) que guardam algo por usuário; "sujeito" é o id do usuário. */
    private static final List<String> POR_SUJEITO = List.of("refresh_token", "mfa", "mfa_recuperacao", "redefinicao_token");

    @Override
    public void migrate(Context context) throws Exception {
        Resultado r = limpar(context.getConnection(), ID_DA_CONSULTORIA_DE_TESTE, NOME_DA_CONSULTORIA_DE_TESTE,
                ID_DA_CONSULTORIA_DO_SARAIVA);
        log.info("V059: consultoria de teste apagada: {}; consultoria do Saraiva zerada: {}",
                r.consultoriaDeTesteApagada() ? "sim" : "não", r.consultoriaZerada() ? "sim" : "não");
    }

    /** As duas partes com os ids dados (a migration passa as constantes; o teste, ids próprios). */
    public static Resultado limpar(Connection conexao, UUID consultoriaDeTeste, String nomeEsperado, UUID consultoriaAZerar)
            throws SQLException {
        boolean apagada = apagarConsultoria(conexao, consultoriaDeTeste, nomeEsperado);
        boolean zerada = existe(conexao, consultoriaAZerar);
        if (zerada) {
            zerarConteudo(conexao, consultoriaAZerar);
        }
        return new Resultado(apagada, zerada);
    }

    /**
     * Apaga a consultoria inteira, só se existir uma com esse id E com esse nome (nome diferente ou id ausente: não apaga nada).
     * Devolve se apagou.
     */
    public static boolean apagarConsultoria(Connection conexao, UUID consultoria, String nomeEsperado) throws SQLException {
        if (!confere(conexao, consultoria, nomeEsperado)) {
            return false;
        }
        zerarConteudo(conexao, consultoria);
        for (String tabela : DA_CONSULTORIA) {
            apagar(conexao, tabela, consultoria);
        }
        apagarSujeitos(conexao, consultoria, false);
        // O ciclo usuario <-> aluno já foi desfeito em zerarConteudo (os alunos e seus usuários saíram); sobra a equipe.
        try (PreparedStatement ps = conexao.prepareStatement(
                "delete from perfil_permissao where perfil_id in (select id from perfil where consultoria_id = ?)")) {
            ps.setObject(1, consultoria);
            ps.executeUpdate();
        }
        apagar(conexao, "usuario", consultoria);
        apagar(conexao, "perfil", consultoria);
        try (PreparedStatement ps = conexao.prepareStatement("delete from consultoria where id = ?")) {
            ps.setObject(1, consultoria);
            ps.executeUpdate();
        }
        return true;
    }

    /**
     * Apaga o conteúdo da consultoria e os alunos com o usuário de papel ALUNO e as sessões dele, e mantém todo o resto
     * (consultoria, marca, equipe, perfis, convites de equipe, biblioteca, configuração da inscrição, direitos, auditoria,
     * pagamentos da consultoria).
     */
    public static void zerarConteudo(Connection conexao, UUID consultoria) throws SQLException {
        enfileirarFotos(conexao, consultoria);
        for (String tabela : CONTEUDO) {
            apagar(conexao, tabela, consultoria);
        }
        // Ciclo usuario.aluno_id <-> aluno.usuario_id: anula os dois lados antes de apagar.
        executar(conexao, "update usuario set aluno_id = null where consultoria_id = ? and papel = 'ALUNO'", consultoria);
        executar(conexao, "update aluno set usuario_id = null where consultoria_id = ?", consultoria);
        // A auditoria é mantida (a FK composta aponta para o usuário): o evento do aluno fica como evento do sistema, sem autor.
        // usuario_id é nulável e o resumo é fixo, sem dado pessoal, então é a saída menos destrutiva. Ip e user agent são dado
        // pessoal do aluno apagado e saem junto.
        executar(conexao, "update auditoria set usuario_id = null, ip = null, user_agent = null "
                + "where consultoria_id = ? and usuario_id in "
                + "(select id from usuario where consultoria_id = ? and papel = 'ALUNO')", consultoria, consultoria);
        executar(conexao, "delete from aceite_termo where consultoria_id = ? and usuario_id in "
                + "(select id from usuario where consultoria_id = ? and papel = 'ALUNO')", consultoria, consultoria);
        apagarSujeitos(conexao, consultoria, true);
        apagar(conexao, "aluno", consultoria);
        executar(conexao, "delete from usuario where consultoria_id = ? and papel = 'ALUNO'", consultoria);
    }

    /** Só a foto que ainda não foi removida: a removida já está na fila (ou já saiu do bucket). */
    private static void enfileirarFotos(Connection conexao, UUID consultoria) throws SQLException {
        executar(conexao, "insert into foto_remocao (objeto, consultoria_id) select id, consultoria_id from atualizacao_foto "
                + "where consultoria_id = ? and removida_em is null on conflict (objeto) do nothing", consultoria);
    }

    /**
     * Sessões, refresh, MFA e links de redefinição do esquema plataforma. A tabela pode não existir (módulo ainda não migrou),
     * por isso o to_regclass. O contador de login é um hash com sal que expira sozinho: não dá para apagar por usuário.
     */
    private static void apagarSujeitos(Connection conexao, UUID consultoria, boolean soAlunos) throws SQLException {
        String filtro = soAlunos ? " and papel = 'ALUNO'" : "";
        for (String tabela : POR_SUJEITO) {
            if (!existe(conexao, "plataforma." + tabela)) {
                continue;
            }
            executar(conexao, "delete from plataforma." + tabela + " where sujeito in "
                    + "(select id::text from usuario where consultoria_id = ?" + filtro + ")", consultoria);
        }
    }

    private static boolean confere(Connection conexao, UUID consultoria, String nomeEsperado) throws SQLException {
        try (PreparedStatement ps = conexao.prepareStatement("select nome from consultoria where id = ?")) {
            ps.setObject(1, consultoria);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() && nomeEsperado.equals(rs.getString("nome"));
            }
        }
    }

    private static boolean existe(Connection conexao, String tabela) throws SQLException {
        try (PreparedStatement ps = conexao.prepareStatement("select to_regclass(?) is not null")) {
            ps.setString(1, tabela);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() && rs.getBoolean(1);
            }
        }
    }

    /** O nome da tabela vem das listas constantes acima, nunca de entrada externa. */
    private static void apagar(Connection conexao, String tabela, UUID consultoria) throws SQLException {
        executar(conexao, "delete from " + tabela + " where consultoria_id = ?", consultoria);
    }

    private static void executar(Connection conexao, String sql, Object... parametros) throws SQLException {
        try (PreparedStatement ps = conexao.prepareStatement(sql)) {
            for (int i = 0; i < parametros.length; i++) {
                ps.setObject(i + 1, parametros[i]);
            }
            ps.executeUpdate();
        }
    }

    private static boolean existe(Connection conexao, UUID consultoria) throws SQLException {
        try (PreparedStatement ps = conexao.prepareStatement("select 1 from consultoria where id = ?")) {
            ps.setObject(1, consultoria);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }
}
