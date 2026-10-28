package br.com.treinos.api.migration;

import br.com.treinos.api.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Toda migration nova sobe o total e entra na lista (como a Central). */
class FlywayMigrationIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void aplicouTodasAsMigrations() {
        Integer total = jdbcTemplate.queryForObject(
                "select count(*) from flyway_schema_history where type in ('SQL', 'JDBC') and success = true", Integer.class);
        List<String> descricoes = jdbcTemplate.queryForList(
                "select description from flyway_schema_history where type in ('SQL', 'JDBC') order by installed_rank",
                String.class);
        assertThat(total).isEqualTo(35);
        assertThat(descricoes).containsExactly("inicial", "catalogo taco", "catalogo exercicios ptbr", "aceite termo", "aluno anonimizado", "auth da plataforma", "fotos de atualizacao", "chave da foto por consultoria", "pedidos da reuniao de 17 10", "foto de perfil do aluno", "fatores dos alimentos", "inscricoes", "anamnese", "anamnese pendencia", "aluno cpf endereco", "mobilidade registro", "pagamentos do aluno", "pagamentos infinitepay", "aviso estorno avisado", "catalogo exercicio imagens", "exercicio catalogo e imagem", "formato novo de series", "receitas padrao do formato novo", "contrato de series e tecnicas", "senha provisoria", "receitas do catalogo", "fatores do catalogo", "suplementos heavy suppz", "uso de imagem", "calorias batel", "importacao", "sexo e ciclo menstrual", "etapas da execucao", "receitas de exemplo", "avaliacao fisica");
    }

    @Test
    void catalogoDeAlimentosVemDaTaco() {
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from catalogo_alimento where fonte like 'Valores de demonstração%'", Integer.class))
                .isZero();
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from catalogo_alimento where"
                        + " (fonte <> 'TACO 4ª ed. (2011), NEPA/UNICAMP' and fonte not like 'TACO (nutrientes de %'"
                        + " and fonte not like 'Batel Grill.%')"
                        + " or kcal < 0 or proteina < 0 or carboidrato < 0 or gordura < 0"
                        + " or nome_busca is null or nome_busca = ''", Integer.class)).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "select fator_correcao from catalogo_alimento where nome = 'Abobrinha, italiana, crua'", BigDecimal.class))
                .isEqualByComparingTo("1.27");
        assertThat(jdbcTemplate.queryForObject(
                "select fator_correcao from catalogo_alimento where nome = 'Abacaxi, cru'", BigDecimal.class)).isNull();
        assertThat(jdbcTemplate.queryForObject(
                "select fator_correcao from catalogo_alimento where nome = 'Abacaxi com casca'", BigDecimal.class))
                .isEqualByComparingTo("1.75");
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from catalogo_alimento where nome = 'Feijão, preto' and fator_correcao = 0.90",
                Integer.class)).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from catalogo_alimento where nome_busca like '%ã%' or nome_busca <> lower(nome_busca)",
                Integer.class)).isZero();
        // Alimento sem análise (leite integral, 458 da TACO) não pode ter entrado com zeros.
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from catalogo_alimento where codigo_fonte in ('450', '457', '458', '472', '540', '591')",
                Integer.class)).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "select tracos from catalogo_alimento where codigo_fonte = '9'", String.class)).isNull();
        // Tabule já estava na TACO com caloria: a tabela do Batel Grill não substitui.
        assertThat(jdbcTemplate.queryForObject(
                "select kcal from catalogo_alimento where nome = 'Tabule'", BigDecimal.class))
                .isEqualByComparingTo("57.45");
        assertThat(jdbcTemplate.queryForObject(
                "select proteina from catalogo_alimento where nome = 'Alcatra'", BigDecimal.class)).isNull();
        assertThat(jdbcTemplate.queryForObject(
                "select kcal from catalogo_alimento where nome = 'Alcatra'", BigDecimal.class))
                .isEqualByComparingTo("344");
    }

    @Test
    void catalogoDeExerciciosTemOsPropriosEOsDoExerciciosBdPtbr() {
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from catalogo_exercicio where fonte = 'Catálogo próprio'", Integer.class)).isEqualTo(52);
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from catalogo_exercicio where fonte like 'exercicios-bd-ptbr%'", Integer.class))
                .isEqualTo(825);
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from catalogo_exercicio where nome_busca is null or nome_busca = ''"
                        + " or nome_busca <> lower(nome_busca) or nome_busca like '%ã%' or char_length(nome) > 120",
                Integer.class)).isZero();
        // Nenhum exercício do dataset pode repetir um nome (sem acento) do catálogo.
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from (select nome_busca from catalogo_exercicio group by nome_busca having count(*) > 1) d",
                Integer.class)).isZero();
        // Exercício dos 52 continua com o mesmo id e ganha nome de busca.
        assertThat(jdbcTemplate.queryForObject(
                "select nome_busca from catalogo_exercicio where nome = 'Leg press 45º'", String.class))
                .isEqualTo("leg press 45º");
        // Nome do dataset e instruções vieram em português.
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from catalogo_exercicio where id = md5('catalogo-exercicio:fedb:' || 'Wide-Grip_Barbell_Bench_Press')::uuid"
                        + " and instrucoes is not null and modalidade = 'LIVRE' and grupo_muscular = 'Peito'",
                Integer.class)).isEqualTo(1);
    }

    @Test
    void catalogoPublicoTemIdsFixos() {
        Integer exercicios = jdbcTemplate.queryForObject("select count(*) from catalogo_exercicio", Integer.class);
        Integer alimentos = jdbcTemplate.queryForObject("select count(*) from catalogo_alimento", Integer.class);
        assertThat(exercicios).isEqualTo(877); // 52 próprios + 825 do exercicios-bd-ptbr (dados/relatorios/exercicios-importacao.md)
        assertThat(alimentos).isEqualTo(848); // 591 da TACO + 13 dos fatores (V027) + 244 do Batel Grill (V030)
        String id = jdbcTemplate.queryForObject("select id::text from catalogo_exercicio where nome = 'Prancha'",
                String.class);
        assertThat(id).isEqualTo(jdbcTemplate.queryForObject("select md5('catalogo-exercicio:Prancha')::uuid::text",
                String.class));
    }
}
